import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { kirimEmail } from "@/lib/email/brevo";
import { templatEmailKodeAkses } from "@/lib/email/templat";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { izinPanitia } from "@/lib/izin-panitia";
import { tanggalJakarta } from "@/lib/kuota-peserta";
import { idNiatDukungan, putuskanBatasDukunganAdminHarian } from "@/lib/niat-dukungan";

class DukunganAdminRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DukunganAdminRouteError";
    this.status = status;
  }
}

/**
 * Slice "niat-dukungan" (6b) — "buatkan catatan untuk peserta", dipakai
 * admin saat mencocokkan daftar donatur Saweria dengan orang yang tidak
 * (atau belum sempat) mengisi formulir sendiri.
 *
 * PENGECUALIAN TERKENDALI dari aturan "email hanya pernah dikirim ke akun
 * sendiri" (POST /api/dukungan/kirim-kode, POST /api/email/uji): route ini
 * MENGIRIM KE AKUN LAIN. Ini aman karena TIGA syarat sekaligus, bukan
 * satu: (1) penerimanya WAJIB akun terdaftar —
 * server mencari lewat getUserByEmail(), menolak keras kalau tidak ada,
 * tidak pernah membuat akun baru dari sini; (2) alamatnya dibaca SERVER
 * dari catatan Firebase Auth akun itu sendiri (userRecord.email), BUKAN
 * dari string body permintaan — body hanya dipakai untuk MENCARI akunnya,
 * tidak pernah untuk MENENTUKAN ke mana email pergi; (3) pemanggilnya
 * wajib admin/superadmin atau panitia yang DITUGASKAN pada kegiatan itu
 * (izinPanitia().boleh), diperiksa sebelum apa pun yang lain.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new DukunganAdminRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    const emailDicari = typeof parsed.email === "string" ? parsed.email.trim() : "";
    const namaDipakai = typeof parsed.namaDipakai === "string" ? parsed.namaDipakai.trim() : "";
    const nominal =
      typeof parsed.nominal === "number" && Number.isFinite(parsed.nominal) && parsed.nominal >= 0
        ? parsed.nominal
        : null;
    const catatan = typeof parsed.catatan === "string" ? parsed.catatan.trim() : "";

    if (!kegiatanId) {
      throw new DukunganAdminRouteError(400, "kegiatanId wajib diisi.");
    }
    if (!emailDicari) {
      throw new DukunganAdminRouteError(400, "Email calon peserta wajib diisi.");
    }
    if (!namaDipakai) {
      throw new DukunganAdminRouteError(400, "Nama yang dipakai wajib diisi.");
    }

    const db = getAdminDb();
    const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
    const kegiatanSnap = await kegiatanRef.get();
    if (!kegiatanSnap.exists) {
      throw new DukunganAdminRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const kegiatanData = kegiatanSnap.data() ?? {};

    // Pola pemeriksaan peran SAMA dengan Route Handler admin lain yang
    // memakai izinPanitia() (mis. kode-akses, impor-hadir) — admin/
    // superadmin di kegiatan mana pun, atau panitia yang uid-nya ada di
    // panitiaUids kegiatan INI.
    if (!izinPanitia({ uid: user.uid, role: user.role }, kegiatanData).boleh) {
      throw new DukunganAdminRouteError(
        403,
        "Anda tidak berwenang membuat catatan dukungan untuk kegiatan ini."
      );
    }

    // Server MENCARI akun dengan email itu — tidak pernah membuat akun
    // baru dari sini. Lihat komentar panjang di atas fungsi ini untuk
    // alasan kenapa route ini boleh mengirim ke akun SELAIN pemanggilnya.
    let userRecord;
    try {
      userRecord = await getAdminAuth().getUserByEmail(emailDicari);
    } catch {
      throw new DukunganAdminRouteError(
        400,
        "Akun dengan email ini belum ada — buat atau impor akunnya dulu sebelum membuatkan catatan dukungan."
      );
    }
    // Alamat yang DIPAKAI mengirim adalah alamat TERSIMPAN pada akun itu
    // (userRecord.email), BUKAN string emailDicari dari body — keduanya
    // seharusnya sama persis (getUserByEmail mencari berdasarkan alamat
    // tersimpan), tapi memakai userRecord.email eksplisit membuat niatnya
    // tidak ambigu di kode ini: tujuan SELALU dari catatan akun, tidak
    // pernah dari input pemanggil.
    const emailTujuan = userRecord.email ?? emailDicari;

    const niatRef = db
      .collection("niat_dukungan")
      .doc(idNiatDukungan(kegiatanId, userRecord.uid));
    const niatSnapAwal = await niatRef.get();
    if (niatSnapAwal.exists) {
      return Response.json({
        ok: true,
        sudahAda: true,
        ke: emailTujuan,
      });
    }

    // Slice "urutan-dukungan" (6c) — SEBELUM ini route tidak punya batas
    // sama sekali: satu akun admin bisa mengirim email lewat Brevo tanpa
    // henti. field dukunganAdmin_${uid} pakai UID ADMIN yang memanggil
    // (user.uid), BUKAN uid peserta yang dibuatkan catatan (userRecord.uid)
    // — yang dibatasi adalah SEBERAPA SERING admin ini memakai route ini,
    // bukan berapa banyak peserta berbeda yang dibuatkan catatan. Pola
    // pemeriksaan SAMA PERSIS dengan POST /api/dukungan/niat dan POST
    // /api/email/uji (6a): pemeriksaan awal di luar transaksi, penghitung
    // dinaikkan di transaksi terpisah setelah create() sukses.
    const tanggalHariIni = tanggalJakarta(new Date());
    const kuotaRef = db.collection("kuota_email").doc(tanggalHariIni);
    const field = `dukunganAdmin_${user.uid}`;
    const kuotaSnapAwal = await kuotaRef.get();
    const jumlahAwal =
      typeof kuotaSnapAwal.data()?.[field] === "number" ? kuotaSnapAwal.data()![field] : 0;
    const hasilBatasAdmin = putuskanBatasDukunganAdminHarian(jumlahAwal);
    if (!hasilBatasAdmin.ok) {
      throw new DukunganAdminRouteError(429, hasilBatasAdmin.pesan ?? "Batas harian tercapai.");
    }

    // Slice "niat-dukungan" — kodeAkses dibaca DI SERVER dari koleksi
    // server-only (KA-3). HANYA dipakai untuk isi email di bawah — TIDAK
    // PERNAH dimasukkan ke Response.json() mana pun di berkas ini.
    const kodeAksesSnap = await db.collection("kegiatan_kode").doc(kegiatanId).get();
    const kodeAkses =
      typeof kodeAksesSnap.data()?.kode === "string" ? (kodeAksesSnap.data()!.kode as string) : null;
    const judulKegiatan = typeof kegiatanData.judul === "string" ? kegiatanData.judul : "";

    let terkirim = false;
    let alasanGagal = "";
    if (!kodeAkses) {
      alasanGagal = "Kegiatan ini belum punya kode akses — hubungi admin.";
    } else {
      const templat = templatEmailKodeAkses(namaDipakai, judulKegiatan, kodeAkses);
      const hasilKirim = await kirimEmail({
        ke: emailTujuan,
        keNama: namaDipakai,
        subjek: templat.subjek,
        isiTeks: templat.isiTeks,
        isiHtml: templat.isiHtml,
      });
      terkirim = hasilKirim.terkirim;
      alasanGagal = hasilKirim.terkirim ? "" : (hasilKirim.alasan ?? "Gagal mengirim email.");
    }

    const now = new Date().toISOString();
    try {
      await niatRef.create({
        kegiatanId,
        uid: userRecord.uid,
        email: emailTujuan,
        namaDipakai,
        nominal,
        catatan,
        dibuatPada: now,
        dibuatOleh: "admin",
        status: terkirim ? "terkirim" : "gagal",
        alasanGagal,
        dikirimPada: terkirim ? now : null,
        jumlahKirim: terkirim ? 1 : 0,
      });
    } catch {
      return Response.json({ ok: true, sudahAda: true, ke: emailTujuan });
    }

    if (terkirim) {
      // Dinaikkan HANYA setelah pengiriman sukses, transaksi TERPISAH dari
      // panggilan Brevo di atas — pola yang SAMA dengan POST
      // /api/email/uji (6a), POST /api/dukungan/niat, dan POST
      // /api/dukungan/kirim-kode.
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(kuotaRef);
        const jumlahSaatIni = typeof snap.data()?.[field] === "number" ? snap.data()![field] : 0;
        tx.set(kuotaRef, { [field]: jumlahSaatIni + 1 }, { merge: true });
      });
    }

    return Response.json({ ok: true, sudahAda: false, ke: emailTujuan, terkirim, alasanGagal });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof DukunganAdminRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
