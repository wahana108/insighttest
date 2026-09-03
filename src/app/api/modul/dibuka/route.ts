import { FieldValue } from "firebase-admin/firestore";
import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";

class ModulDibukaRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ModulDibukaRouteError";
    this.status = status;
  }
}

/**
 * Mencatat bahwa peserta sudah membuka satu modul referensi — dipakai
 * evaluasiKelayakan() saat syaratSertifikat.wajibBukaReferensi true.
 * pendaftaran/{id} hanya boleh ditulis server (firestore.rules), jadi
 * klien tidak bisa menandai "sudah dibuka" untuk dirinya sendiri langsung.
 *
 * modulId diperiksa terhadap modulSnapshot MILIK PENDAFTARAN ini, bukan
 * modul kegiatan yang sekarang hidup (KA-5) — konsisten dengan bagaimana
 * evaluasiKelayakan() membaca wajib/kategori-nya nanti.
 *
 * update() dengan FieldValue.arrayUnion aman dipakai di sini (beda dari
 * kasus di terbitkanSertifikatUntuk() — lihat komentar di sana): update()
 * memakai field mask parsial, bukan replace penuh dokumen, jadi transform-
 * nya dievaluasi terhadap referensiDibuka yang sudah ada. arrayUnion juga
 * idempoten — dipanggil ulang untuk modulId yang sama tidak menggandakan
 * entri maupun menghabiskan kuota tulis harian secara berarti.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ModulDibukaRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    const modulId = typeof parsed.modulId === "string" ? parsed.modulId : "";
    if (!kegiatanId || !modulId) {
      throw new ModulDibukaRouteError(400, "kegiatanId dan modulId wajib diisi.");
    }

    const db = getAdminDb();
    const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${user.uid}`);
    const pendaftaranSnap = await pendaftaranRef.get();
    if (!pendaftaranSnap.exists) {
      throw new ModulDibukaRouteError(403, "Anda belum terdaftar di kegiatan ini.");
    }

    const data = pendaftaranSnap.data() ?? {};
    const modulSnapshot = Array.isArray(data.modulSnapshot) ? data.modulSnapshot : [];
    const modul = modulSnapshot.find(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && (item as Record<string, unknown>).modulId === modulId
    );
    if (!modul || modul.kategori !== "referensi") {
      throw new ModulDibukaRouteError(
        400,
        "Modul ini bukan modul referensi pada pendaftaran Anda."
      );
    }

    await pendaftaranRef.update({
      referensiDibuka: FieldValue.arrayUnion(modulId),
    });

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof ModulDibukaRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
