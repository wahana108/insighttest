import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { kirimEmail } from "@/lib/email/brevo";
import { templatEmailKodeAkses } from "@/lib/email/templat";
import { getAdminDb } from "@/lib/firebase/admin";
import { tanggalJakarta } from "@/lib/kuota-peserta";
import { idNiatDukungan } from "@/lib/niat-dukungan";

class DukunganKirimKodeRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DukunganKirimKodeRouteError";
    this.status = status;
  }
}

const BATAS_KIRIM_KODE_PER_HARI = 5;

/**
 * Slice "niat-dukungan" (6b), diganti nama dari POST /api/dukungan/kirim-ulang
 * di Slice "urutan-dukungan" (6c) — sejak 6c ini SATU-SATUNYA tempat kode
 * akses dibaca dari kegiatan_kode dan dikirim ke email; POST
 * /api/dukungan/niat tidak lagi menyentuhnya sama sekali (lihat komentar di
 * sana). Dipanggil klien SETELAH tab Saweria dibuka
 * (src/app/kegiatan/[id]/dukungan/page.tsx) — itulah inti perbaikan urutan
 * kejadian di 6c.
 *
 * Sama aturan keras dengan POST /api/dukungan/niat: TIDAK ADA parameter
 * alamat email di body, tujuan SELALU akun yang sedang login. Menolak
 * kalau belum ada catatan niat_dukungan sama sekali — ini bukan jalur
 * untuk membuat catatan baru.
 *
 * Kalau status dokumen sudah 'terkirim' dari percobaan sebelumnya, route
 * ini TETAP memproses permintaan (mengirim lagi) selama batas harian belum
 * habis — TIDAK ada penolakan berbasis status "sudah pernah terkirim".
 * Klien (halaman formulir) yang memutuskan kapan memanggil ulang endpoint
 * ini secara otomatis vs menampilkan status yang sudah diketahui tanpa
 * memanggil lagi.
 *
 * PENGECUALIAN (Slice "persetujuan-dukungan" 6e): kalau kegiatan ini
 * dukungan.perluPersetujuan true DAN status dokumen MASIH 'menunggu' (belum
 * pernah disetujui admin), route ini MENOLAK 403 — penegakan WAJIB di
 * server, bukan sekadar menyembunyikan tombol di klien, karena permintaan
 * langsung ke endpoint ini (tanpa lewat UI) tetap harus tunduk pada aturan
 * yang sama. Kode hanya bisa dikirim untuk dokumen 'menunggu' lewat POST
 * /api/dukungan/setujui (admin/panitia). Begitu status sudah pernah
 * 'terkirim' (persetujuan pertama sudah terjadi), pemanggilan berikutnya ke
 * endpoint INI kembali diizinkan seperti biasa (mode otomatis) — larangan
 * ini HANYA berlaku selama status persis 'menunggu'.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new DukunganKirimKodeRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    if (!kegiatanId) {
      throw new DukunganKirimKodeRouteError(400, "kegiatanId wajib diisi.");
    }

    const db = getAdminDb();
    const niatRef = db.collection("niat_dukungan").doc(idNiatDukungan(kegiatanId, user.uid));
    const niatSnap = await niatRef.get();
    if (!niatSnap.exists) {
      throw new DukunganKirimKodeRouteError(
        404,
        "Anda belum mengisi formulir dukungan untuk kegiatan ini."
      );
    }
    const niatData = niatSnap.data() ?? {};

    const kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();
    const dukunganRaw =
      kegiatanSnap.exists &&
      typeof kegiatanSnap.data()?.dukungan === "object" &&
      kegiatanSnap.data()!.dukungan !== null
        ? (kegiatanSnap.data()!.dukungan as Record<string, unknown>)
        : {};
    const perluPersetujuan = dukunganRaw.perluPersetujuan === true;
    // PENEGAKAN WAJIB DI SERVER (lihat komentar berkas di atas) — ditolak
    // SEBELUM pemeriksaan batas harian di bawah, supaya percobaan yang
    // ditolak di sini tidak ikut memakan kuota kirim.
    if (perluPersetujuan && niatData.status === "menunggu") {
      throw new DukunganKirimKodeRouteError(
        403,
        "Permintaan Anda sedang menunggu konfirmasi admin. Kode akan dikirim ke email Anda setelah disetujui."
      );
    }

    // Field diberi awalan "dukunganKirimKode_" — batas 5/hari ini TIDAK
    // berbagi angka dengan batas email uji (5/hari, Slice 6a) maupun
    // pembuatan catatan niat dukungan (5/hari, POST /api/dukungan/niat),
    // lihat komentar di firestore.rules match /kuota_email/{tanggal}.
    // Naik dari 3 ke 5 di Slice 6c karena pemanggilan PERTAMA sekarang
    // dipakai oleh tombol "Buka Saweria" itu sendiri (bukan lagi murni
    // "kirim ulang") — 5 dipilih supaya masih ada beberapa kesempatan
    // kirim ulang sungguhan sesudahnya.
    const tanggalHariIni = tanggalJakarta(new Date());
    const kuotaRef = db.collection("kuota_email").doc(tanggalHariIni);
    const field = `dukunganKirimKode_${user.uid}`;
    const kuotaSnapAwal = await kuotaRef.get();
    const jumlahAwal = typeof kuotaSnapAwal.data()?.[field] === "number" ? kuotaSnapAwal.data()![field] : 0;
    if (jumlahAwal >= BATAS_KIRIM_KODE_PER_HARI) {
      throw new DukunganKirimKodeRouteError(
        429,
        `Anda sudah mengirim kode ${BATAS_KIRIM_KODE_PER_HARI} kali hari ini. Coba lagi besok.`
      );
    }

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
    if (err instanceof ApiAuthError || err instanceof DukunganKirimKodeRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
