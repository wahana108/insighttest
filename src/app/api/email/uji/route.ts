import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { kirimEmail } from "@/lib/email/brevo";
import { templatEmailUji } from "@/lib/email/templat";
import { getAdminDb } from "@/lib/firebase/admin";
import { tanggalJakarta } from "@/lib/kuota-peserta";

class EmailUjiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "EmailUjiRouteError";
    this.status = status;
  }
}

const BATAS_EMAIL_UJI_PER_HARI = 5;

/**
 * Slice "email-brevo" (6a) — membuktikan pengiriman email bekerja, bukan
 * fitur pengguna. Tujuan email SELALU alamat akun yang sedang login,
 * diambil dari token yang sudah diverifikasi verifyRequest() — TIDAK ADA
 * parameter alamat tujuan di body permintaan, aturan keras (supaya route
 * ini tidak bisa dijadikan pengirim email sembarangan ke alamat siapa pun).
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);
    // Pola yang SAMA dengan admin route lain (mis. impor-hadir) — bukan
    // pola baru.
    if (user.role !== "admin" && user.role !== "superadmin") {
      throw new EmailUjiRouteError(403, "Hanya admin/superadmin yang boleh mengirim email uji.");
    }
    if (!user.email) {
      throw new EmailUjiRouteError(400, "Akun ini tidak punya alamat email di profilnya.");
    }

    const db = getAdminDb();
    // kuota_email/{tanggal}: SATU dokumen per hari (Asia/Jakarta, sama
    // seperti kuota_harian — lihat tanggalJakarta(), src/lib/kuota-peserta.ts),
    // berisi peta {uid: jumlah} — batasnya PER AKUN, bukan per hari
    // total, jadi satu dokumen dipakai bersama semua admin dan tiap admin
    // punya field sendiri di dalamnya.
    const tanggalHariIni = tanggalJakarta(new Date());
    const kuotaRef = db.collection("kuota_email").doc(tanggalHariIni);

    // Pemeriksaan awal (best-effort, di luar transaksi) — cukup untuk
    // menolak lebih awal sebelum memanggil Brevo. Penghitung SEBENARNYA
    // dinaikkan di transaksi terpisah SETELAH pengiriman sukses di bawah
    // (lihat komentar di sana kenapa tidak bisa satu transaksi).
    const kuotaSnapAwal = await kuotaRef.get();
    const jumlahAwal =
      typeof kuotaSnapAwal.data()?.[user.uid] === "number" ? kuotaSnapAwal.data()![user.uid] : 0;
    if (jumlahAwal >= BATAS_EMAIL_UJI_PER_HARI) {
      throw new EmailUjiRouteError(
        429,
        `Anda sudah mengirim ${BATAS_EMAIL_UJI_PER_HARI} email uji hari ini. Coba lagi besok.`
      );
    }

    const namaTujuan = user.namaLengkap.trim() || user.email;
    const templat = templatEmailUji(namaTujuan);
    const hasilKirim = await kirimEmail({
      ke: user.email,
      keNama: namaTujuan,
      subjek: templat.subjek,
      isiTeks: templat.isiTeks,
      isiHtml: templat.isiHtml,
    });
    if (!hasilKirim.terkirim) {
      throw new EmailUjiRouteError(502, hasilKirim.alasan ?? "Gagal mengirim email.");
    }

    // Dinaikkan HANYA setelah pengiriman sukses — batasnya "maksimal 5
    // PANGGILAN SUKSES per akun per hari", bukan percobaan. Transaksi
    // TERPISAH dari panggilan Brevo di atas dengan sengaja: transaksi
    // Firestore bisa dicoba ulang SDK saat ada konflik tulis, dan
    // mengulang panggilan jaringan di dalam transaksi berarti berisiko
    // mengirim email yang sama dua kali.
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(kuotaRef);
      const jumlahSaatIni =
        typeof snap.data()?.[user.uid] === "number" ? snap.data()![user.uid] : 0;
      // PERINGATAN (jebakan 5.0c, docs/kickoff.md §R, pola yang sama
      // dengan kuota_harian di POST /api/pendaftaran): nilai eksplisit
      // dibaca dari tx.get() di atas — TIDAK memakai FieldValue.increment().
      // merge: true supaya penghitung admin LAIN dalam dokumen hari yang
      // sama tidak ikut tertimpa (satu dokumen dipakai bersama, keyed per
      // uid).
      tx.set(kuotaRef, { [user.uid]: jumlahSaatIni + 1 }, { merge: true });
    });

    return Response.json({ ok: true, ke: user.email, idPesan: hasilKirim.idPesan ?? null });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof EmailUjiRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
