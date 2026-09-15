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
    const data = snap.data() ?? {};
    const kode = typeof data.kode === "string" ? data.kode : null;
    // Slice "kode-akses-terukur" — dokumen lama tanpa field ini sama
    // sekali dibaca sebagai 0 (KA-1): jumlahDipakai 0 = belum pernah
    // dipakai, kodeMaksPakai 0 = tak terbatas.
    const jumlahDipakai = typeof data.jumlahDipakai === "number" ? data.jumlahDipakai : 0;
    const kodeMaksPakai = typeof data.kodeMaksPakai === "number" ? data.kodeMaksPakai : 0;
    return Response.json({ kode, jumlahDipakai, kodeMaksPakai });
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
    // ditulis ulang): kode akses selalu ditulis ulang lewat jalur ini.
    const kode = normalisasiKodeAkses(kodeMasuk);
    if (!kode) {
      throw new KodeAksesRouteError(400, "Kode akses tidak boleh kosong.");
    }

    // Slice "kode-akses-terukur" — 0 = tak terbatas (BAWAAN), sama seperti
    // kuotaPeserta. Nilai bukan angka/negatif diperlakukan sebagai 0,
    // bukan galat (form angka HTML bisa mengirim string kosong).
    const kodeMaksPakaiMasuk = (body as Record<string, unknown>).kodeMaksPakai;
    const kodeMaksPakai =
      typeof kodeMaksPakaiMasuk === "number" &&
      Number.isFinite(kodeMaksPakaiMasuk) &&
      kodeMaksPakaiMasuk >= 0
        ? Math.floor(kodeMaksPakaiMasuk)
        : 0;

    // merge: true — SENGAJA, beda dari sebelum slice ini: dokumen yang
    // sama kini juga menyimpan jumlahDipakai (penghitung pemakaian), dan
    // menyunting kode/batas di sini TIDAK BOLEH menimpanya ke nol secara
    // diam-diam. Atur ulang penghitung punya jalur eksplisit sendiri (POST
    // di bawah), bukan efek samping menyimpan kode.
    await db.collection("kegiatan_kode").doc(kegiatanId).set(
      {
        kode,
        kodeMaksPakai,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return Response.json({ ok: true, kode, kodeMaksPakai });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof KodeAksesRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}

/**
 * Slice "kode-akses-terukur" — "Atur ulang penghitung" di form admin, untuk
 * saat admin memutar kode ke edisi berikutnya. Route terpisah dari PUT
 * (bukan field tersembunyi di body PUT) supaya aksinya eksplisit: menyimpan
 * kode/batas TIDAK PERNAH ikut mereset jumlahDipakai (lihat komentar PUT di
 * atas), dan mereset jumlahDipakai TIDAK PERNAH ikut mengubah kode/batas.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kegiatanId: string }> }
) {
  try {
    const { kegiatanId } = await params;
    const db = await pastikanBerwenang(request, kegiatanId);
    await db.collection("kegiatan_kode").doc(kegiatanId).set(
      { jumlahDipakai: 0 },
      { merge: true }
    );
    return Response.json({ ok: true, jumlahDipakai: 0 });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof KodeAksesRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
