import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { normalisasiKodeAkses } from "@/lib/akses-kegiatan";
import { getAdminDb } from "@/lib/firebase/admin";
import { izinPanitia } from "@/lib/izin-panitia";

class KodeAksesRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "KodeAksesRouteError";
    this.status = status;
  }
}

/**
 * kegiatan_kode/{kegiatanId} — SATU-SATUNYA jalur baca/tulis kode akses
 * (Slice "akses-kegiatan"). Koleksi ini `allow read, write: if false` di
 * firestore.rules, TERMASUK untuk admin — dokumen kegiatan/{id} sendiri
 * boleh dibaca publik (caraMasuk termasuk field publik), jadi kodenya
 * WAJIB tidak pernah lewat client SDK sama sekali (KA-3). Admin/panitia
 * dengan suntingKegiatan menyunting dan melihatnya lewat Route Handler ini
 * (Admin SDK), bukan lewat halaman kegiatan biasa.
 */
async function pastikanBerwenang(request: Request, kegiatanId: string) {
  const user = await verifyRequest(request);
  const db = getAdminDb();
  const kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();
  if (!kegiatanSnap.exists) {
    throw new KodeAksesRouteError(404, "Kegiatan tidak ditemukan.");
  }
  const kegiatanData = kegiatanSnap.data() ?? {};
  if (!izinPanitia(user, kegiatanData).suntingKegiatan) {
    throw new KodeAksesRouteError(
      403,
      "Anda tidak berhak menyunting kode akses kegiatan ini."
    );
  }
  return db;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kegiatanId: string }> }
) {
  try {
    const { kegiatanId } = await params;
    const db = await pastikanBerwenang(request, kegiatanId);
    const snap = await db.collection("kegiatan_kode").doc(kegiatanId).get();
    const kode = snap.exists && typeof snap.data()?.kode === "string" ? snap.data()!.kode : null;
    return Response.json({ kode });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof KodeAksesRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ kegiatanId: string }> }
) {
  try {
    const { kegiatanId } = await params;
    const db = await pastikanBerwenang(request, kegiatanId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new KodeAksesRouteError(400, "Body permintaan harus JSON.");
    }
    const kodeMasuk =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>).kode : undefined;
    if (typeof kodeMasuk !== "string") {
      throw new KodeAksesRouteError(400, "kode wajib diisi.");
    }
    // Disimpan dalam bentuk kanonik SEKALIGUS (bukan cuma dinormalkan saat
    // dicocokkan) — beda dari kodeVerifikasi sertifikat (KA-6, tidak pernah
    // ditulis ulang): kode akses selalu ditulis ulang lewat jalur ini, jadi
    // tidak ada nilai lama yang perlu "diselamatkan" apa adanya.
    const kode = normalisasiKodeAkses(kodeMasuk);
    if (!kode) {
      throw new KodeAksesRouteError(400, "Kode akses tidak boleh kosong.");
    }

    await db.collection("kegiatan_kode").doc(kegiatanId).set({
      kode,
      updatedAt: new Date().toISOString(),
    });
    return Response.json({ ok: true, kode });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof KodeAksesRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
