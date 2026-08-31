import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { buatKodeVerifikasiUnik, SertifikatRouteError } from "@/lib/api/sertifikat-server";
import { getAdminDb } from "@/lib/firebase/admin";
import { evaluasiKelayakan } from "@/lib/sertifikat-syarat";
import type { JenisSyaratSertifikat, KategoriModul } from "@/types/kegiatan";
import type { HasilModul, ModulSnapshotItem } from "@/types/pendaftaran";

function isJenisSyarat(value: unknown): value is JenisSyaratSertifikat {
  return value === "nilai_minimum" || value === "manual_admin";
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function mapModulSnapshot(value: unknown): ModulSnapshotItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      modulId: typeof item.modulId === "string" ? item.modulId : "",
      judul: typeof item.judul === "string" ? item.judul : "",
      kategori: isKategoriModul(item.kategori) ? item.kategori : "evaluasi",
      wajib: typeof item.wajib === "boolean" ? item.wajib : true,
      nilaiMinimum: typeof item.nilaiMinimum === "number" ? item.nilaiMinimum : null,
    }));
}

function mapHasilModul(value: unknown): Record<string, HasilModul> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const hasil: Record<string, HasilModul> = {};
  for (const [modulId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const data = entry as Record<string, unknown>;
    hasil[modulId] = {
      skorTertinggi: typeof data.skorTertinggi === "number" ? data.skorTertinggi : 0,
      lulus: typeof data.lulus === "boolean" ? data.lulus : false,
      percobaan: typeof data.percobaan === "number" ? data.percobaan : 0,
    };
  }
  return hasil;
}

/**
 * Tanpa `uid`: peserta menerbitkan sertifikatnya sendiri — hanya boleh
 * untuk syaratSertifikat.jenis 'nilai_minimum' dan hanya kalau
 * evaluasiKelayakan() bilang layak (src/lib/sertifikat-syarat.ts, dipakai
 * bersama dengan penerbitan massal nanti). Dengan `uid`: admin/superadmin
 * saja, boleh untuk jenis apa pun — evaluasiKelayakan tetap dihitung untuk
 * mengisi nilaiAkhir/items sertifikat, tapi hasilnya tidak menggerbangi izin.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new SertifikatRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    if (!kegiatanId) {
      throw new SertifikatRouteError(400, "kegiatanId wajib diisi.");
    }
    const requestedUid = typeof parsed.uid === "string" && parsed.uid ? parsed.uid : null;
    const isSelfIssue = !requestedUid;
    const targetUid = requestedUid ?? user.uid;

    if (!isSelfIssue) {
      const isAdminRole = user.role === "admin" || user.role === "superadmin";
      if (!isAdminRole) {
        throw new SertifikatRouteError(
          403,
          "Hanya admin yang boleh menerbitkan sertifikat untuk pengguna lain."
        );
      }
    }

    const db = getAdminDb();
    const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
    const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${targetUid}`);
    const sertifikatRef = db.collection("sertifikat").doc(`${kegiatanId}_${targetUid}`);

    const [kegiatanSnap, pendaftaranSnap, sertifikatSnap] = await Promise.all([
      kegiatanRef.get(),
      pendaftaranRef.get(),
      sertifikatRef.get(),
    ]);

    if (!kegiatanSnap.exists) {
      throw new SertifikatRouteError(404, "Kegiatan tidak ditemukan.");
    }
    if (!pendaftaranSnap.exists) {
      throw new SertifikatRouteError(404, "Pendaftaran tidak ditemukan.");
    }

    // Sudah pernah terbit dan masih berlaku — kembalikan apa adanya, jangan
    // menerbitkan ulang dan jangan menimpa.
    if (sertifikatSnap.exists && sertifikatSnap.data()?.status === "berlaku") {
      return Response.json({ id: sertifikatSnap.id, ...(sertifikatSnap.data() ?? {}) });
    }

    const kegiatanData = kegiatanSnap.data() ?? {};
    const kode = typeof kegiatanData.kode === "string" ? kegiatanData.kode : "";
    if (!kode) {
      throw new SertifikatRouteError(
        400,
        "Kegiatan ini belum punya kode — isi kode kegiatan dulu di /admin/kegiatan sebelum menerbitkan sertifikat."
      );
    }
    const judulKegiatan = typeof kegiatanData.judul === "string" ? kegiatanData.judul : "";
    const syaratRaw =
      typeof kegiatanData.syaratSertifikat === "object" && kegiatanData.syaratSertifikat !== null
        ? (kegiatanData.syaratSertifikat as Record<string, unknown>)
        : {};
    const jenisSyarat: JenisSyaratSertifikat = isJenisSyarat(syaratRaw.jenis)
      ? syaratRaw.jenis
      : "manual_admin";
    const nilaiMinimumSyarat = typeof syaratRaw.nilaiMinimum === "number" ? syaratRaw.nilaiMinimum : 0;

    const pendaftaranData = pendaftaranSnap.data() ?? {};
    const modulSnapshot = mapModulSnapshot(pendaftaranData.modulSnapshot);
    const hasilModul = mapHasilModul(pendaftaranData.hasilModul);
    const namaLengkap = typeof pendaftaranData.namaLengkap === "string" ? pendaftaranData.namaLengkap : "";
    const nomorUrut = typeof pendaftaranData.nomorUrut === "number" ? pendaftaranData.nomorUrut : 0;
    const daftarPada =
      typeof pendaftaranData.daftarPada === "string" ? pendaftaranData.daftarPada : new Date().toISOString();

    const kelayakan = evaluasiKelayakan(
      { modulSnapshot, hasilModul },
      { syaratSertifikat: { jenis: jenisSyarat, nilaiMinimum: nilaiMinimumSyarat } }
    );

    if (isSelfIssue) {
      if (jenisSyarat !== "nilai_minimum") {
        throw new SertifikatRouteError(400, "Kegiatan ini memerlukan penerbitan oleh admin.");
      }
      if (!kelayakan.layak) {
        throw new SertifikatRouteError(400, kelayakan.alasan);
      }
    }

    const tahun = new Date(daftarPada).getFullYear();
    const serial = `${kode}/${tahun}/${String(nomorUrut).padStart(4, "0")}`;
    const kodeVerifikasi = await buatKodeVerifikasiUnik(db);
    const now = new Date().toISOString();

    const record = {
      kegiatanId,
      uid: targetUid,
      serial,
      kodeVerifikasi,
      namaLengkap,
      judulKegiatan,
      nilaiAkhir: kelayakan.nilaiAkhir,
      items: kelayakan.items,
      status: "berlaku" as const,
      terbitPada: now,
      diterbitkanOleh: user.uid,
    };

    await db.runTransaction(async (tx) => {
      const recheck = await tx.get(sertifikatRef);
      if (recheck.exists && recheck.data()?.status === "berlaku") {
        throw new SertifikatRouteError(409, "Sertifikat ini baru saja diterbitkan.");
      }
      tx.set(sertifikatRef, record);
      // §10 (docs/arsitektur.md): nomorUrut sudah dialokasikan saat
      // pendaftaran — tidak ada penghitung yang dinaikkan di sini.
      if (kelayakan.layak) {
        tx.update(pendaftaranRef, { status: "selesai" });
      }
    });

    return Response.json({ id: sertifikatRef.id, ...record });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof SertifikatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
