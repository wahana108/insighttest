import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { buatModulSnapshot } from "@/lib/api/pendaftaran-server";
import { getAdminDb } from "@/lib/firebase/admin";
import { mapFormulirPeserta, periksaFormulirPeserta } from "@/lib/formulir-peserta";
import {
  putuskanBatasHarian,
  putuskanKuotaKegiatan,
  tanggalJakarta,
} from "@/lib/kuota-peserta";

class PendaftaranRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PendaftaranRouteError";
    this.status = status;
  }
}

/**
 * Semua pemeriksaan kelayakan pendaftaran ada di server — klien tidak
 * pernah menentukan nomorUrut atau menulis pendaftaran langsung (KA-7 di
 * semangat yang sama, firestore.rules menolak semua tulisan klien ke
 * pendaftaran/{id}).
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new PendaftaranRouteError(400, "Body permintaan harus JSON.");
    }
    const kegiatanId =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>).kegiatanId
        : undefined;
    if (typeof kegiatanId !== "string" || !kegiatanId) {
      throw new PendaftaranRouteError(400, "kegiatanId wajib diisi.");
    }

    if (!user.namaLengkap.trim()) {
      throw new PendaftaranRouteError(
        400,
        "Lengkapi nama lengkap di halaman Profil sebelum mendaftar."
      );
    }

    const db = getAdminDb();
    const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
    const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${user.uid}`);

    let nomorUrutHasil = 0;

    await db.runTransaction(async (tx) => {
      const kegiatanSnap = await tx.get(kegiatanRef);
      if (!kegiatanSnap.exists) {
        throw new PendaftaranRouteError(404, "Kegiatan tidak ditemukan.");
      }
      const kegiatanData = kegiatanSnap.data() ?? {};
      if (kegiatanData.isPublished !== true) {
        throw new PendaftaranRouteError(400, "Kegiatan ini belum diterbitkan.");
      }
      if (kegiatanData.isArchived === true) {
        throw new PendaftaranRouteError(400, "Kegiatan ini sudah diarsipkan.");
      }

      const now = new Date();
      const dibukaPada =
        typeof kegiatanData.dibukaPada === "string" ? new Date(kegiatanData.dibukaPada) : null;
      const ditutupPada =
        typeof kegiatanData.ditutupPada === "string" ? new Date(kegiatanData.ditutupPada) : null;
      if (dibukaPada && now < dibukaPada) {
        throw new PendaftaranRouteError(400, "Pendaftaran untuk kegiatan ini belum dibuka.");
      }
      if (ditutupPada && now > ditutupPada) {
        throw new PendaftaranRouteError(400, "Pendaftaran untuk kegiatan ini sudah ditutup.");
      }

      // Slice 6.1: penegakan SESUNGGUHNYA formulirPeserta ada di sini, bukan
      // di klien — penjaga di src/app/kegiatan/[id]/page.tsx cuma
      // kenyamanan. Hanya dijalankan saat pendaftaran BARU dibuat; peserta
      // yang sudah terdaftar tidak pernah divalidasi ulang lewat jalur ini
      // (KA-5, semangat yang sama dengan modulSnapshot).
      const hasilFormulir = periksaFormulirPeserta(mapFormulirPeserta(kegiatanData.formulirPeserta), {
        institusi: user.institusi,
        nomorIdentitas: user.nomorIdentitas,
        noTelepon: user.noTelepon,
      });
      if (!hasilFormulir.valid) {
        throw new PendaftaranRouteError(400, hasilFormulir.pesan ?? "Data belum lengkap.");
      }

      const pendaftaranSnap = await tx.get(pendaftaranRef);
      if (pendaftaranSnap.exists) {
        throw new PendaftaranRouteError(409, "Anda sudah terdaftar di kegiatan ini.");
      }

      // KA-5 — SATU implementasi dipakai sama oleh jalur mandiri ini dan
      // jalur impor daftar hadir (Slice 6.2), lihat src/lib/api/pendaftaran-server.ts.
      const modulSnapshot = await buatModulSnapshot(kegiatanRef, tx);

      const nomorUrutTerakhir =
        typeof kegiatanData.nomorUrutTerakhir === "number" ? kegiatanData.nomorUrutTerakhir : 0;
      const nomorUrut = nomorUrutTerakhir + 1;
      nomorUrutHasil = nomorUrut;

      // LAPIS 1 (docs/kickoff.md §R) — berlaku untuk jalur mandiri MAUPUN
      // impor admin (lihat pemeriksaan yang sama di .../impor-hadir/route.ts).
      // kuotaPeserta 0 = tak terbatas.
      const kuotaPeserta =
        typeof kegiatanData.kuotaPeserta === "number" ? kegiatanData.kuotaPeserta : 0;
      const hasilKuota = putuskanKuotaKegiatan(kuotaPeserta, nomorUrut);
      if (!hasilKuota.ok) {
        throw new PendaftaranRouteError(
          409,
          hasilKuota.pesan ?? "Kuota peserta kegiatan ini sudah penuh."
        );
      }

      // LAPIS 2 — HANYA jalur mandiri (impor admin sengaja dikecualikan,
      // docs/kickoff.md §R). parameter/global dibaca DI DALAM transaksi ini
      // (bukan getSystemParameter(), yang memakai client SDK) supaya
      // konsisten dengan pembacaan lain dalam transaksi yang sama.
      const parameterRef = db.collection("parameter").doc("global");
      const parameterSnap = await tx.get(parameterRef);
      const parameterData = parameterSnap.data() ?? {};
      const batasHarian =
        typeof parameterData.batasPendaftaranBaruPerHari === "number"
          ? parameterData.batasPendaftaranBaruPerHari
          : 0;

      // Kunci tanggal Asia/Jakarta — BUKAN UTC (lihat komentar
      // tanggalJakarta(), src/lib/kuota-peserta.ts: UTC mereset kuota
      // harian pukul 07.00 pagi WIB dan tidak ada yang akan mengerti
      // kenapa) — dibaca DI DALAM transaksi yang sama supaya penghitungnya
      // konsisten dengan pembuatan pendaftaran: gagal mendaftar berarti
      // TIDAK ikut menaikkan penghitung harian.
      const tanggalHariIni = tanggalJakarta(now);
      const kuotaHarianRef = db.collection("kuota_harian").doc(tanggalHariIni);
      const kuotaHarianSnap = await tx.get(kuotaHarianRef);
      const jumlahHariIniSaatIni =
        typeof kuotaHarianSnap.data()?.jumlah === "number" ? kuotaHarianSnap.data()!.jumlah : 0;
      const jumlahHariIniBaru = jumlahHariIniSaatIni + 1;

      const hasilBatasHarian = putuskanBatasHarian(batasHarian, jumlahHariIniBaru);
      if (!hasilBatasHarian.ok) {
        throw new PendaftaranRouteError(
          429,
          hasilBatasHarian.pesan ?? "Kuota pendaftaran hari ini sudah penuh. Coba lagi besok."
        );
      }

      tx.update(kegiatanRef, { nomorUrutTerakhir: nomorUrut });
      // PERINGATAN (jebakan 5.0c, docs/kickoff.md §R): jumlahHariIniBaru
      // ditulis SEBAGAI NILAI EKSPLISIT dibaca dari tx.get() di atas — TIDAK
      // memakai FieldValue.increment(), yang di dalam set() non-merge
      // dijalankan SETELAH dokumen direset dan akan mulai dari nol lagi.
      tx.set(
        kuotaHarianRef,
        { tanggal: tanggalHariIni, jumlah: jumlahHariIniBaru },
        { merge: true }
      );
      tx.set(pendaftaranRef, {
        kegiatanId,
        uid: user.uid,
        email: user.email,
        namaLengkap: user.namaLengkap,
        institusi: user.institusi,
        // Slice 6.1a: dibekukan sama seperti institusi — sebelumnya hanya
        // ada di profil dan dibaca live saat rekap dibuka (KA-5/KA-6).
        nomorIdentitas: user.nomorIdentitas,
        noTelepon: user.noTelepon,
        nomorUrut,
        modulSnapshot,
        status: "terdaftar",
        daftarPada: now.toISOString(),
        hasilModul: {},
        referensiDibuka: [],
        atestasi: {},
        // Slice 6.2: jejak asal — pendaftaran lewat jalur ini SELALU
        // 'mandiri'. Lihat src/app/api/admin/kegiatan/[kegiatanId]/impor-hadir/route.ts
        // untuk jalur 'impor'.
        sumber: "mandiri",
        diimporOleh: null,
        diimporPada: null,
      });
    });

    return Response.json({ ok: true, nomorUrut: nomorUrutHasil });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof PendaftaranRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
