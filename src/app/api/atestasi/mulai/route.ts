import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";

class AtestasiMulaiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AtestasiMulaiRouteError";
    this.status = status;
  }
}

/**
 * Dipanggil SEKALI saat halaman modul atestasi dibuka — mencatat
 * dimulaiPada dengan WAKTU SERVER (bukan klien) supaya
 * POST /api/atestasi/lapor bisa memeriksa kewajaran watchCreditSec
 * terhadap selisih waktu sungguhan, bukan yang bisa dipalsukan klien.
 *
 * Dipanggil ulang tiap kali halaman dibuka MENIMPA dimulaiPada ke waktu
 * sekarang — itu disengaja: setiap sesi (setiap kali game dimuat ulang di
 * iframe) mulai dari watch_credit_sec 0 lagi di sisi CCL (tidak ada Auth
 * bersama antara portal dan CCL, lihat ARSITEKTUR §6), jadi jendela
 * kewajaran juga harus di-reset ke awal sesi itu, bukan diwarisi dari
 * kunjungan pertama berhari-hari lalu.
 *
 * Dot-path update ke atestasi.{modulId}.dimulaiPada TIDAK menyentuh field
 * lain di bawah atestasi.{modulId} (hp/score/dst dari sesi sebelumnya
 * tetap ada) — itu tanggung jawab POST /api/atestasi/lapor.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AtestasiMulaiRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    const modulId = typeof parsed.modulId === "string" ? parsed.modulId : "";
    if (!kegiatanId || !modulId) {
      throw new AtestasiMulaiRouteError(400, "kegiatanId dan modulId wajib diisi.");
    }

    const db = getAdminDb();
    const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${user.uid}`);
    const pendaftaranSnap = await pendaftaranRef.get();
    if (!pendaftaranSnap.exists) {
      throw new AtestasiMulaiRouteError(403, "Anda belum terdaftar di kegiatan ini.");
    }

    const data = pendaftaranSnap.data() ?? {};
    const modulSnapshot = Array.isArray(data.modulSnapshot) ? data.modulSnapshot : [];
    const modul = modulSnapshot.find(
      (item): item is Record<string, unknown> =>
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).modulId === modulId
    );
    if (!modul || modul.kategori !== "atestasi") {
      throw new AtestasiMulaiRouteError(
        400,
        "Modul ini bukan modul atestasi pada pendaftaran Anda."
      );
    }

    const now = new Date().toISOString();
    await pendaftaranRef.update({
      [`atestasi.${modulId}.dimulaiPada`]: now,
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof AtestasiMulaiRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
