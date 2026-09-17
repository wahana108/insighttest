import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { buatModulSnapshot } from "@/lib/api/pendaftaran-server";
import {
  mapCaraMasuk,
  putuskanAksesMandiri,
  putuskanBatasPemakaianKode,
  putuskanCatatanDukunganWajib,
} from "@/lib/akses-kegiatan";
import { getAdminDb } from "@/lib/firebase/admin";
import { mapFormulirPeserta, periksaFormulirPeserta } from "@/lib/formulir-peserta";
import {
  putuskanBatasHarian,
  putuskanKuotaKegiatan,
  tanggalJakarta,
} from "@/lib/kuota-peserta";
import { idNiatDukungan } from "@/lib/niat-dukungan";

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
    // Slice "akses-kegiatan" — hanya dipakai kalau kegiatan.caraMasuk
    // 'kode'; diabaikan (bukan galat) untuk 'terbuka'/'hanya_admin', supaya
    // klien tidak perlu tahu caraMasuk kegiatan SEBELUM mengirim permintaan.
    const kodeAksesInput =
      typeof body === "object" && body !== null &&
      typeof (body as Record<string, unknown>).kodeAkses === "string"
        ? ((body as Record<string, unknown>).kodeAkses as string)
        : "";

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
      const caraMasuk = mapCaraMasuk(kegiatanData.caraMasuk);
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
      // impor admin (lihat pemeriksaan yang sama di .../impor-hadir/route.ts)
      // dan untuk SEMUA caraMasuk, termasuk 'kode' — kapasitas kegiatan
      // adalah janji tentang acaranya, tidak dijual kepada siapa pun.
      // kuotaPeserta 0 = tak terbatas.
      const kuotaPeserta =
        typeof kegiatanData.kuotaPeserta === "number" ? kegiatanData.kuotaPeserta : 0;
      const hasilKuota = putuskanKuotaKegiatan(kuotaPeserta, nomorUrut);

      // LAPIS 2 — HANYA relevan untuk caraMasuk 'terbuka' (putuskanAksesMandiri()
      // di bawah yang memutuskan apakah ini benar-benar ditegakkan — pemegang
      // kode akses yang benar melewatinya). parameter/global dibaca DI DALAM
      // transaksi ini (bukan getSystemParameter(), yang memakai client SDK)
      // supaya konsisten dengan pembacaan lain dalam transaksi yang sama.
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

      // Slice "akses-kegiatan" — kode akses TIDAK PERNAH ada di dokumen
      // kegiatan (KA-3), selalu di koleksi terpisah ini, server-only. Dibaca
      // apa pun caraMasuk-nya (murah, satu dokumen) — putuskanAksesMandiri()
      // di bawah yang memutuskan relevan atau tidak.
      const kodeAksesRef = db.collection("kegiatan_kode").doc(kegiatanId);
      const kodeAksesSnap = await tx.get(kodeAksesRef);
      const kodeAksesData = kodeAksesSnap.data() ?? {};
      const kodeTersimpan =
        typeof kodeAksesData.kode === "string" ? (kodeAksesData.kode as string) : null;
      // Slice "kode-akses-terukur" — 0/tanpa field berarti tak terbatas
      // (KA-1), sama seperti kuotaPeserta/batasHarian. jumlahDipakaiBaru
      // dihitung di sini (nilai tersimpan + 1), BUKAN dari increment(),
      // supaya bisa dinilai putuskanBatasPemakaianKode() SEBELUM ditulis —
      // dan supaya tulisannya nanti (di bawah) memakai nilai eksplisit yang
      // sama, bukan transform yang dievaluasi ulang saat commit.
      const jumlahDipakaiSaatIni =
        typeof kodeAksesData.jumlahDipakai === "number" ? kodeAksesData.jumlahDipakai : 0;
      const kodeMaksPakai =
        typeof kodeAksesData.kodeMaksPakai === "number" ? kodeAksesData.kodeMaksPakai : 0;
      const jumlahDipakaiBaru = jumlahDipakaiSaatIni + 1;
      const hasilBatasPemakaianKode = putuskanBatasPemakaianKode(kodeMaksPakai, jumlahDipakaiBaru);

      // Slice "niat-dukungan" (6b) — dukungan.wajibCatatan bawaan false
      // (KA-1): kegiatan lama/tanpa peta dukungan sama sekali berperilaku
      // PERSIS seperti sebelum slice ini, putuskanCatatanDukunganWajib()
      // langsung lolos tanpa pernah membaca niat_dukungan. Hanya kalau
      // true, satu pembacaan tambahan (deterministik lewat idNiatDukungan(),
      // bukan query) dilakukan DI DALAM transaksi yang sama.
      const dukunganData =
        typeof kegiatanData.dukungan === "object" && kegiatanData.dukungan !== null
          ? (kegiatanData.dukungan as Record<string, unknown>)
          : {};
      const wajibCatatanDukungan = dukunganData.wajibCatatan === true;
      let punyaCatatanDukungan = true;
      if (wajibCatatanDukungan) {
        const niatSnap = await tx.get(
          db.collection("niat_dukungan").doc(idNiatDukungan(kegiatanId, user.uid))
        );
        punyaCatatanDukungan = niatSnap.exists;
      }
      const hasilCatatanDukungan = putuskanCatatanDukunganWajib({
        wajibCatatan: wajibCatatanDukungan,
        punyaCatatan: punyaCatatanDukungan,
      });

      const keputusanAkses = putuskanAksesMandiri({
        caraMasuk,
        kodeDimasukkan: kodeAksesInput,
        kodeTersimpan,
        hasilKuotaKegiatan: hasilKuota,
        hasilBatasHarian,
        hasilBatasPemakaianKode,
        hasilCatatanDukungan,
      });
      if (!keputusanAkses.ok) {
        throw new PendaftaranRouteError(
          keputusanAkses.status,
          keputusanAkses.pesan ?? "Pendaftaran tidak diizinkan."
        );
      }

      tx.update(kegiatanRef, { nomorUrutTerakhir: nomorUrut });
      if (caraMasuk === "kode") {
        // PERINGATAN (jebakan 5.0c, sama seperti kuota_harian di bawah):
        // jumlahDipakaiBaru ditulis SEBAGAI NILAI EKSPLISIT dibaca dari
        // tx.get() di atas — TIDAK memakai FieldValue.increment(). merge:
        // true supaya kode/kodeMaksPakai yang tersimpan di dokumen yang
        // sama tidak ikut tertimpa. Hanya pendaftaran yang BERHASIL lewat
        // jalur 'kode' yang menaikkan ini — kalau keputusanAkses di atas
        // menolak, baris ini tidak pernah tercapai.
        tx.set(kodeAksesRef, { jumlahDipakai: jumlahDipakaiBaru }, { merge: true });
      }
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
