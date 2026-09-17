import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { kirimEmail } from "@/lib/email/brevo";
import { templatEmailKodeAkses } from "@/lib/email/templat";
import { getAdminDb } from "@/lib/firebase/admin";
import { tanggalJakarta } from "@/lib/kuota-peserta";
import { idNiatDukungan } from "@/lib/niat-dukungan";

class DukunganKirimUlangRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DukunganKirimUlangRouteError";
    this.status = status;
  }
}

const BATAS_KIRIM_ULANG_PER_HARI = 3;

/**
 * Slice "niat-dukungan" (6b) — mengirim ULANG kode ke alamat akun yang
 * sedang login (sama aturan keras dengan POST /api/dukungan/niat: TIDAK ADA
 * parameter alamat email di body). Menolak kalau belum ada catatan
 * niat_dukungan sama sekali — ini bukan jalur untuk membuat catatan baru.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new DukunganKirimUlangRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    if (!kegiatanId) {
      throw new DukunganKirimUlangRouteError(400, "kegiatanId wajib diisi.");
    }

    const db = getAdminDb();
    const niatRef = db.collection("niat_dukungan").doc(idNiatDukungan(kegiatanId, user.uid));
    const niatSnap = await niatRef.get();
    if (!niatSnap.exists) {
      throw new DukunganKirimUlangRouteError(
        404,
        "Anda belum mengisi formulir dukungan untuk kegiatan ini."
      );
    }
    const niatData = niatSnap.data() ?? {};

    // Field diberi awalan "dukunganKirimUlang_" — batas 3/hari ini TIDAK
    // berbagi angka dengan batas email uji (5/hari, Slice 6a) maupun
    // pengiriman awal niat dukungan, lihat komentar di
    // firestore.rules match /kuota_email/{tanggal}.
    const tanggalHariIni = tanggalJakarta(new Date());
    const kuotaRef = db.collection("kuota_email").doc(tanggalHariIni);
    const field = `dukunganKirimUlang_${user.uid}`;
    const kuotaSnapAwal = await kuotaRef.get();
    const jumlahAwal = typeof kuotaSnapAwal.data()?.[field] === "number" ? kuotaSnapAwal.data()![field] : 0;
    if (jumlahAwal >= BATAS_KIRIM_ULANG_PER_HARI) {
      throw new DukunganKirimUlangRouteError(
        429,
        `Anda sudah mengirim ulang kode ${BATAS_KIRIM_ULANG_PER_HARI} kali hari ini. Coba lagi besok.`
      );
    }

    const kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();
    const judulKegiatan =
      kegiatanSnap.exists && typeof kegiatanSnap.data()?.judul === "string"
        ? (kegiatanSnap.data()!.judul as string)
        : "";

    // Slice "niat-dukungan" — kodeAkses dibaca DI SERVER dari koleksi
    // server-only (KA-3). HANYA dipakai untuk isi email di bawah — TIDAK
    // PERNAH dimasukkan ke Response.json() mana pun di berkas ini.
    const kodeAksesSnap = await db.collection("kegiatan_kode").doc(kegiatanId).get();
    const kodeAkses =
      typeof kodeAksesSnap.data()?.kode === "string" ? (kodeAksesSnap.data()!.kode as string) : null;

    const namaDipakai = typeof niatData.namaDipakai === "string" ? niatData.namaDipakai : "";
    const namaTujuan = namaDipakai || user.namaLengkap.trim() || user.email;

    let terkirim = false;
    let alasanGagal = "";
    if (!kodeAkses) {
      alasanGagal = "Kegiatan ini belum punya kode akses — hubungi admin.";
    } else {
      const templat = templatEmailKodeAkses(namaTujuan, judulKegiatan, kodeAkses);
      const hasilKirim = await kirimEmail({
        ke: user.email,
        keNama: namaTujuan,
        subjek: templat.subjek,
        isiTeks: templat.isiTeks,
        isiHtml: templat.isiHtml,
      });
      terkirim = hasilKirim.terkirim;
      alasanGagal = hasilKirim.terkirim ? "" : (hasilKirim.alasan ?? "Gagal mengirim email.");
    }

    const now = new Date().toISOString();
    const jumlahKirimSaatIni = typeof niatData.jumlahKirim === "number" ? niatData.jumlahKirim : 0;
    await niatRef.update({
      status: terkirim ? "terkirim" : "gagal",
      alasanGagal,
      // dikirimPada HANYA diperbarui saat sukses — menyimpan waktu
      // pengiriman BERHASIL terakhir, bukan waktu percobaan terakhir
      // (yang mungkin gagal). alasanGagal di atas yang mencerminkan
      // percobaan paling baru.
      ...(terkirim ? { dikirimPada: now, jumlahKirim: jumlahKirimSaatIni + 1 } : {}),
    });

    if (terkirim) {
      // Dinaikkan HANYA setelah pengiriman sukses, transaksi TERPISAH dari
      // panggilan Brevo di atas — pola yang SAMA dengan POST
      // /api/email/uji (Slice 6a) dan POST /api/dukungan/niat.
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(kuotaRef);
        const jumlahSaatIni = typeof snap.data()?.[field] === "number" ? snap.data()![field] : 0;
        tx.set(kuotaRef, { [field]: jumlahSaatIni + 1 }, { merge: true });
      });
    }

    return Response.json({ ok: true, terkirim, alasanGagal });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof DukunganKirimUlangRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
