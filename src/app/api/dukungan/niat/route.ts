import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { kirimEmail } from "@/lib/email/brevo";
import { templatEmailKodeAkses } from "@/lib/email/templat";
import { getAdminDb } from "@/lib/firebase/admin";
import { tanggalJakarta } from "@/lib/kuota-peserta";
import { idNiatDukungan, putuskanBatasNiatHarian } from "@/lib/niat-dukungan";

class DukunganNiatRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DukunganNiatRouteError";
    this.status = status;
  }
}

/**
 * Slice "niat-dukungan" (6b) — SEMUA peran yang sudah login boleh memanggil
 * (tidak ada pemeriksaan role, beda dari route admin) — verifyRequest()
 * sudah cukup: token sah + akun aktif.
 *
 * Tujuan email SELALU alamat akun yang sedang login, dari token
 * terverifikasi — TIDAK ADA parameter alamat email di body, aturan keras
 * sama seperti POST /api/email/uji (Slice 6a).
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new DukunganNiatRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    const namaDipakai = typeof parsed.namaDipakai === "string" ? parsed.namaDipakai.trim() : "";
    const nominal =
      typeof parsed.nominal === "number" && Number.isFinite(parsed.nominal) && parsed.nominal >= 0
        ? parsed.nominal
        : null;
    const catatan = typeof parsed.catatan === "string" ? parsed.catatan.trim() : "";

    if (!kegiatanId) {
      throw new DukunganNiatRouteError(400, "kegiatanId wajib diisi.");
    }
    if (!namaDipakai) {
      throw new DukunganNiatRouteError(400, "Nama yang dipakai wajib diisi.");
    }

    const db = getAdminDb();
    const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
    const kegiatanSnap = await kegiatanRef.get();
    if (!kegiatanSnap.exists) {
      throw new DukunganNiatRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const kegiatanData = kegiatanSnap.data() ?? {};
    const dukunganRaw =
      typeof kegiatanData.dukungan === "object" && kegiatanData.dukungan !== null
        ? (kegiatanData.dukungan as Record<string, unknown>)
        : {};
    if (dukunganRaw.aktif !== true) {
      throw new DukunganNiatRouteError(400, "Formulir dukungan tidak aktif untuk kegiatan ini.");
    }
    const urlSaweria = typeof dukunganRaw.urlSaweria === "string" ? dukunganRaw.urlSaweria : "";
    const pesanDukungan = typeof dukunganRaw.pesan === "string" ? dukunganRaw.pesan : "";
    const judulKegiatan = typeof kegiatanData.judul === "string" ? kegiatanData.judul : "";

    const niatRef = db.collection("niat_dukungan").doc(idNiatDukungan(kegiatanId, user.uid));
    const niatSnapAwal = await niatRef.get();
    if (niatSnapAwal.exists) {
      // Sudah pernah mengisi — JANGAN kirim ulang otomatis. Pakai POST
      // /api/dukungan/kirim-ulang secara eksplisit kalau memang perlu.
      return Response.json({ ok: true, sudahAda: true, urlSaweria, pesan: pesanDukungan });
    }

    // Slice "niat-dukungan" — batas 5/hari melindungi kuota Brevo dan kuota
    // tulis Firestore dari SATU akun yang mengisi formulir di banyak
    // kegiatan sekaligus. TIDAK menggantikan pembatasan satu-kali-per-
    // kegiatan di atas (niatSnapAwal.exists) — keduanya berlaku bersamaan,
    // independen satu sama lain. Pola SAMA PERSIS dengan POST /api/email/uji
    // (Slice 6a): pemeriksaan awal di luar transaksi (di sini), penghitung
    // dinaikkan setelah kirim SUKSES di transaksi terpisah (di bawah, dekat
    // akhir fungsi) — bukan di dalam transaksi yang sama dengan panggilan
    // Brevo, supaya percobaan ulang transaksi tidak mengirim email dua kali.
    const tanggalHariIni = tanggalJakarta(new Date());
    const kuotaRef = db.collection("kuota_email").doc(tanggalHariIni);
    const field = `dukunganNiat_${user.uid}`;
    const kuotaSnapAwal = await kuotaRef.get();
    const jumlahAwal =
      typeof kuotaSnapAwal.data()?.[field] === "number" ? kuotaSnapAwal.data()![field] : 0;
    const hasilBatasNiat = putuskanBatasNiatHarian(jumlahAwal);
    if (!hasilBatasNiat.ok) {
      throw new DukunganNiatRouteError(429, hasilBatasNiat.pesan ?? "Batas harian tercapai.");
    }

    // Slice "niat-dukungan" — kodeAkses dibaca DI SERVER dari koleksi
    // server-only (KA-3, sama seperti POST /api/pendaftaran). Variabel ini
    // HANYA dipakai untuk membangun isi email di bawah — TIDAK PERNAH
    // dimasukkan ke Response.json() mana pun di berkas ini.
    const kodeAksesSnap = await db.collection("kegiatan_kode").doc(kegiatanId).get();
    const kodeAkses =
      typeof kodeAksesSnap.data()?.kode === "string" ? (kodeAksesSnap.data()!.kode as string) : null;

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
    try {
      // .create() (bukan .set()) — kalau dua permintaan datang nyaris
      // bersamaan (dobel klik), lolos-tidaknya niatSnapAwal.exists di atas
      // bukan jaminan atomik; .create() menolak keras kalau dokumen
      // ternyata sudah ada di antara pembacaan dan penulisan ini, ditangkap
      // di bawah sebagai kasus "sudah ada" alih-alih menimpa catatan yang
      // sudah tertulis (dan berpotensi mengirim email dua kali).
      await niatRef.create({
        kegiatanId,
        uid: user.uid,
        email: user.email,
        namaDipakai,
        nominal,
        catatan,
        dibuatPada: now,
        dibuatOleh: "sendiri",
        status: terkirim ? "terkirim" : "gagal",
        alasanGagal,
        dikirimPada: terkirim ? now : null,
        jumlahKirim: terkirim ? 1 : 0,
      });
    } catch {
      // Kalah balapan — dokumen sudah ada (dibuat permintaan lain di antara
      // pembacaan dan penulisan). Perlakukan sama seperti sudahAda; JANGAN
      // menimpa catatan yang sudah tersimpan.
      return Response.json({ ok: true, sudahAda: true, urlSaweria, pesan: pesanDukungan });
    }

    if (terkirim) {
      // Dinaikkan HANYA setelah pengiriman sukses, transaksi TERPISAH dari
      // panggilan Brevo di atas — pola yang SAMA dengan POST /api/email/uji
      // (Slice 6a): transaksi Firestore bisa dicoba ulang SDK saat ada
      // konflik, dan mengulang panggilan jaringan di dalamnya berisiko
      // mengirim email yang sama dua kali. kuotaRef/field sudah dihitung di
      // atas (dipakai juga untuk pemeriksaan BATAS_NIAT_PER_HARI sebelum
      // kirimEmail() dipanggil) — dipakai ulang di sini, bukan dihitung
      // ulang, supaya keduanya SELALU merujuk dokumen/field yang sama.
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(kuotaRef);
        const jumlahSaatIni = typeof snap.data()?.[field] === "number" ? snap.data()![field] : 0;
        tx.set(kuotaRef, { [field]: jumlahSaatIni + 1 }, { merge: true });
      });
    }

    return Response.json({ ok: true, sudahAda: false, urlSaweria, pesan: pesanDukungan, terkirim, alasanGagal });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof DukunganNiatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
