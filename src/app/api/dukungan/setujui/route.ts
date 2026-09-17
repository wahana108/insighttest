import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { kirimEmail } from "@/lib/email/brevo";
import { templatEmailKodeAkses } from "@/lib/email/templat";
import { getAdminDb } from "@/lib/firebase/admin";
import { izinPanitia } from "@/lib/izin-panitia";
import { tanggalJakarta } from "@/lib/kuota-peserta";
import { idNiatDukungan, putuskanBatasDukunganAdminHarian } from "@/lib/niat-dukungan";

class DukunganSetujuiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DukunganSetujuiRouteError";
    this.status = status;
  }
}

/**
 * Slice "persetujuan-dukungan" (6e) — dipanggil admin/panitia dari tombol
 * "Kirim kode" pada baris berstatus 'menunggu' di halaman daftar dukungan
 * (/admin/kegiatan/[id]/dukungan), SETELAH mencocokkan peserta ini dengan
 * daftar donatur Saweria. Ini SATU-SATUNYA jalan keluar dari status
 * 'menunggu' — POST /api/dukungan/kirim-kode menolak 403 selama status
 * masih ini (lihat komentar di sana).
 *
 * PENGECUALIAN TERKENDALI dari aturan "email hanya pernah dikirim ke akun
 * sendiri" (POST /api/dukungan/kirim-kode, POST /api/email/uji) — SAMA
 * seperti POST /api/dukungan/admin: route ini MENGIRIM KE AKUN LAIN. Ini
 * aman karena TIGA syarat sekaligus, bukan satu: (1) penerimanya WAJIB
 * peserta yang SUDAH mengisi formulir dukungan sendiri — dokumen
 * niat_dukungan harus sudah ada (bukan dibuat di sini, beda dari
 * /api/dukungan/admin yang boleh membuat baru); (2) alamatnya dibaca
 * SERVER dari catatan users/{uid} akun itu sendiri, BUKAN dari string body
 * permintaan — body hanya berisi uid untuk MENCARI akunnya, tidak pernah
 * untuk MENENTUKAN ke mana email pergi; (3) pemanggilnya wajib
 * admin/superadmin atau panitia yang DITUGASKAN pada kegiatan itu
 * (izinPanitia().boleh), diperiksa sebelum apa pun yang lain.
 *
 * Batas harian SENGAJA berbagi penghitung dan angka yang SAMA dengan POST
 * /api/dukungan/admin (dukunganAdmin_${uid ADMIN pemanggil},
 * BATAS_DUKUNGAN_ADMIN_PER_HARI = 20, putuskanBatasDukunganAdminHarian())
 * — bukan penghitung baru: keduanya adalah tindakan ADMIN yang mengirim
 * email ke ORANG LAIN, jenis aksi yang sama persis dari sudut pandang
 * "seberapa sering satu admin memakai kewenangan mengirim-ke-akun-lain
 * ini hari ini", terlepas dari apakah baris niat_dukungan-nya baru dibuat
 * atau sudah ada.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new DukunganSetujuiRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    const uid = typeof parsed.uid === "string" ? parsed.uid : "";

    if (!kegiatanId) {
      throw new DukunganSetujuiRouteError(400, "kegiatanId wajib diisi.");
    }
    if (!uid) {
      throw new DukunganSetujuiRouteError(400, "uid peserta wajib diisi.");
    }

    const db = getAdminDb();
    const kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();
    if (!kegiatanSnap.exists) {
      throw new DukunganSetujuiRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const kegiatanData = kegiatanSnap.data() ?? {};

    // Pola pemeriksaan peran SAMA dengan POST /api/dukungan/admin dan Route
    // Handler admin lain yang memakai izinPanitia() — jangan menulis pola
    // baru.
    if (!izinPanitia({ uid: user.uid, role: user.role }, kegiatanData).boleh) {
      throw new DukunganSetujuiRouteError(
        403,
        "Anda tidak berwenang menyetujui dukungan untuk kegiatan ini."
      );
    }

    const niatRef = db.collection("niat_dukungan").doc(idNiatDukungan(kegiatanId, uid));
    const niatSnap = await niatRef.get();
    if (!niatSnap.exists) {
      throw new DukunganSetujuiRouteError(
        404,
        "Peserta ini belum mengisi formulir dukungan untuk kegiatan ini."
      );
    }
    const niatData = niatSnap.data() ?? {};

    // Alamat yang DIPAKAI mengirim adalah alamat TERSIMPAN pada dokumen
    // users/{uid} peserta itu sendiri — lihat komentar panjang di atas
    // fungsi ini untuk alasan kenapa route ini boleh mengirim ke akun
    // SELAIN pemanggilnya.
    const userSnap = await db.collection("users").doc(uid).get();
    const emailTujuan = userSnap.exists && typeof userSnap.data()?.email === "string"
      ? (userSnap.data()!.email as string)
      : "";
    if (!emailTujuan) {
      throw new DukunganSetujuiRouteError(400, "Akun peserta ini tidak punya alamat email tersimpan.");
    }

    // Batas: SAMA PERSIS dengan POST /api/dukungan/admin — lihat komentar
    // berkas di atas untuk alasan berbagi penghitung, bukan membuat baru.
    const tanggalHariIni = tanggalJakarta(new Date());
    const kuotaRef = db.collection("kuota_email").doc(tanggalHariIni);
    const field = `dukunganAdmin_${user.uid}`;
    const kuotaSnapAwal = await kuotaRef.get();
    const jumlahAwal =
      typeof kuotaSnapAwal.data()?.[field] === "number" ? kuotaSnapAwal.data()![field] : 0;
    const hasilBatasAdmin = putuskanBatasDukunganAdminHarian(jumlahAwal);
    if (!hasilBatasAdmin.ok) {
      throw new DukunganSetujuiRouteError(429, hasilBatasAdmin.pesan ?? "Batas harian tercapai.");
    }

    // Slice "niat-dukungan" — kodeAkses dibaca DI SERVER dari koleksi
    // server-only (KA-3). HANYA dipakai untuk isi email di bawah — TIDAK
    // PERNAH dimasukkan ke Response.json() mana pun di berkas ini.
    const kodeAksesSnap = await db.collection("kegiatan_kode").doc(kegiatanId).get();
    const kodeAkses =
      typeof kodeAksesSnap.data()?.kode === "string" ? (kodeAksesSnap.data()!.kode as string) : null;
    const judulKegiatan = typeof kegiatanData.judul === "string" ? kegiatanData.judul : "";

    const namaDipakai = typeof niatData.namaDipakai === "string" ? niatData.namaDipakai : "";
    const namaProfil =
      userSnap.exists && typeof userSnap.data()?.namaLengkap === "string"
        ? (userSnap.data()!.namaLengkap as string)
        : "";
    const namaTujuan = namaDipakai || namaProfil || emailTujuan;

    let terkirim = false;
    let alasanGagal = "";
    if (!kodeAkses) {
      alasanGagal = "Kegiatan ini belum punya kode akses — hubungi admin.";
    } else {
      const templat = templatEmailKodeAkses(namaTujuan, judulKegiatan, kodeAkses);
      const hasilKirim = await kirimEmail({
        ke: emailTujuan,
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
      ...(terkirim ? { dikirimPada: now, jumlahKirim: jumlahKirimSaatIni + 1 } : {}),
    });

    if (terkirim) {
      // Dinaikkan HANYA setelah pengiriman sukses, transaksi TERPISAH dari
      // panggilan Brevo di atas — pola yang SAMA dengan POST
      // /api/dukungan/admin, POST /api/dukungan/kirim-kode, dan POST
      // /api/email/uji (6a).
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(kuotaRef);
        const jumlahSaatIni = typeof snap.data()?.[field] === "number" ? snap.data()![field] : 0;
        tx.set(kuotaRef, { [field]: jumlahSaatIni + 1 }, { merge: true });
      });
    }

    return Response.json({ ok: true, ke: emailTujuan, terkirim, alasanGagal });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof DukunganSetujuiRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
