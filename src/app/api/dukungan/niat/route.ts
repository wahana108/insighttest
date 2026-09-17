import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
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
 * Slice "niat-dukungan" (6b), URUTAN KEJADIAN diperbaiki di Slice
 * "urutan-dukungan" (6c) — SEMUA peran yang sudah login boleh memanggil
 * (tidak ada pemeriksaan role, beda dari route admin) — verifyRequest()
 * sudah cukup: token sah + akun aktif.
 *
 * PERUBAHAN 6c — route ini TIDAK LAGI MENGIRIM EMAIL SAMA SEKALI. Sebelum
 * 6c, kode akses terkirim SEBELUM peserta sempat membuka Saweria — begitu
 * formulir dikirim, kodenya sudah ada di kotak masuk, jadi tidak ada alasan
 * lagi membuka tautan dukungannya. Sekarang route ini HANYA mencatat niat
 * (status awal 'tercatat') dan mengembalikan urlSaweria supaya klien
 * membuka Saweria DULU — kode baru dibaca dari kegiatan_kode dan dikirim
 * lewat POST /api/dukungan/kirim-kode, dipanggil klien SETELAH tab Saweria
 * terbuka (src/app/kegiatan/[id]/dukungan/page.tsx). Berkas ini sekarang
 * TIDAK PERNAH menyentuh koleksi kegiatan_kode maupun kirimEmail() —
 * memperkecil permukaan KA-3, bukan cuma memindah teksnya.
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

    const niatRef = db.collection("niat_dukungan").doc(idNiatDukungan(kegiatanId, user.uid));
    const niatSnapAwal = await niatRef.get();
    if (niatSnapAwal.exists) {
      // Sudah pernah mengisi — JANGAN buat catatan baru atau kirim apa pun
      // di sini. Kalau peserta perlu kode lagi, itu tugas eksplisit POST
      // /api/dukungan/kirim-kode (dipanggil klien lewat tombol "Buka
      // Saweria" atau tautan "kirim ulang"), bukan efek samping mengisi
      // formulir yang sama lagi.
      const statusAwal =
        typeof niatSnapAwal.data()?.status === "string" ? niatSnapAwal.data()!.status : "tercatat";
      return Response.json({
        ok: true,
        sudahAda: true,
        urlSaweria,
        pesan: pesanDukungan,
        status: statusAwal,
      });
    }

    // Slice "urutan-dukungan" (6c) — batas 5/hari melindungi kuota TULIS
    // Firestore dari SATU akun yang membuat catatan di banyak kegiatan
    // sekaligus (route ini tidak lagi memanggil Brevo, jadi tidak ada lagi
    // kuota Brevo untuk dilindungi di sini — itu urusan POST
    // /api/dukungan/kirim-kode). TIDAK menggantikan pembatasan satu-kali-
    // per-kegiatan di atas (niatSnapAwal.exists) — keduanya berlaku
    // bersamaan, independen satu sama lain. Pemeriksaan awal di luar
    // transaksi, penghitung dinaikkan di transaksi terpisah setelah
    // create() sukses — pola yang SAMA dengan POST /api/email/uji (6a) dan
    // POST /api/dukungan/kirim-kode.
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

    const now = new Date().toISOString();
    try {
      // .create() (bukan .set()) — kalau dua permintaan datang nyaris
      // bersamaan (dobel klik), lolos-tidaknya niatSnapAwal.exists di atas
      // bukan jaminan atomik; .create() menolak keras kalau dokumen
      // ternyata sudah ada di antara pembacaan dan penulisan ini, ditangkap
      // di bawah sebagai kasus "sudah ada" alih-alih menimpa catatan yang
      // sudah tertulis.
      await niatRef.create({
        kegiatanId,
        uid: user.uid,
        email: user.email,
        namaDipakai,
        nominal,
        catatan,
        dibuatPada: now,
        dibuatOleh: "sendiri",
        status: "tercatat",
        alasanGagal: "",
        dikirimPada: null,
        jumlahKirim: 0,
      });
    } catch {
      // Kalah balapan — dokumen sudah ada (dibuat permintaan lain di antara
      // pembacaan dan penulisan). Perlakukan sama seperti sudahAda; JANGAN
      // menimpa catatan yang sudah tersimpan. Status pemenang balapan tidak
      // dibaca ulang di sini (percobaan tambahan untuk kasus yang sangat
      // jarang) — klien memperlakukan sudahAda:true tanpa status eksplisit
      // sebagai 'tercatat', aman karena itu status TERLONGGAR (paling
      // sedikit mengasumsikan kode sudah terkirim).
      return Response.json({ ok: true, sudahAda: true, urlSaweria, pesan: pesanDukungan });
    }

    // Dinaikkan HANYA setelah create() sukses, transaksi TERPISAH — sama
    // pola dengan POST /api/email/uji (6a): transaksi Firestore bisa
    // dicoba ulang SDK saat ada konflik, jadi operasi yang TIDAK boleh
    // terulang (di sini: pembuatan dokumen) tidak pernah ada di dalam
    // transaksi yang sama dengan penghitungnya.
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(kuotaRef);
      const jumlahSaatIni = typeof snap.data()?.[field] === "number" ? snap.data()![field] : 0;
      tx.set(kuotaRef, { [field]: jumlahSaatIni + 1 }, { merge: true });
    });

    return Response.json({
      ok: true,
      sudahAda: false,
      urlSaweria,
      pesan: pesanDukungan,
      status: "tercatat",
    });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof DukunganNiatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
