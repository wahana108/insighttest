import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";
import { izinPanitia } from "@/lib/izin-panitia";
import { tanggalJakarta } from "@/lib/kuota-peserta";
import { mapNiatDukungan } from "@/lib/niat-dukungan";
import { keCsv, type SelRekap } from "@/lib/rekap-csv";

class DukunganAdminListRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DukunganAdminListRouteError";
    this.status = status;
  }
}

const LABEL_DIBUAT_OLEH: Record<string, string> = {
  sendiri: "Sendiri",
  admin: "Admin",
};

const LABEL_STATUS: Record<string, string> = {
  terkirim: "Terkirim",
  gagal: "Gagal",
};

/**
 * Slice "niat-dukungan" (6b) — daftar niat dukungan satu kegiatan untuk
 * admin/panitia (halaman /admin/kegiatan/[id]/dukungan). niat_dukungan
 * server-only (firestore.rules), jadi halaman admin TIDAK bisa membacanya
 * lewat client SDK sama sekali — route ini satu-satunya jalur baca.
 * `?format=csv` mengembalikan berkas unduhan, sama pola dengan GET
 * /api/admin/rekap/[kegiatanId].
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kegiatanId: string }> }
) {
  try {
    const user = await verifyRequest(request);
    const { kegiatanId } = await params;

    const db = getAdminDb();
    const kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();
    if (!kegiatanSnap.exists) {
      throw new DukunganAdminListRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const kegiatanData = kegiatanSnap.data() ?? {};
    if (!izinPanitia({ uid: user.uid, role: user.role }, kegiatanData).boleh) {
      throw new DukunganAdminListRouteError(
        403,
        "Anda tidak berwenang melihat daftar dukungan kegiatan ini."
      );
    }

    const snap = await db
      .collection("niat_dukungan")
      .where("kegiatanId", "==", kegiatanId)
      .get();
    const items = snap.docs
      .map((doc) => mapNiatDukungan(doc.id, doc.data()))
      .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada));

    const url = new URL(request.url);
    if (url.searchParams.get("format") !== "csv") {
      return Response.json({ ok: true, items });
    }

    const pemisah = url.searchParams.get("pemisah") === "koma" ? "," : ";";
    const header: SelRekap[] = [
      "Nama dipakai",
      "Email akun",
      "Nominal",
      "Catatan",
      "Waktu",
      "Dibuat oleh",
      "Status",
      "Alasan gagal",
    ];
    const baris: SelRekap[][] = [
      header,
      ...items.map((item) => [
        item.namaDipakai,
        item.email,
        item.nominal,
        item.catatan,
        item.dibuatPada,
        LABEL_DIBUAT_OLEH[item.dibuatOleh] ?? item.dibuatOleh,
        LABEL_STATUS[item.status] ?? item.status,
        item.alasanGagal,
      ]),
    ];
    // BOM UTF-8 — sama alasan dengan GET /api/admin/rekap/[kegiatanId]:
    // tanpa ini nama beraksen rusak saat dibuka di Excel.
    const BOM_UTF8 = String.fromCharCode(0xfeff);
    const isiBerkas = BOM_UTF8 + keCsv(baris, pemisah);
    const kode = typeof kegiatanData.kode === "string" ? kegiatanData.kode : kegiatanId;
    const namaBerkas = `dukungan-${kode}-${tanggalJakarta(new Date())}.csv`;

    return new Response(isiBerkas, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      },
    });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof DukunganAdminListRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
