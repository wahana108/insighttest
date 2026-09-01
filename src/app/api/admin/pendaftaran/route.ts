import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";
import { evaluasiKelayakan } from "@/lib/sertifikat-syarat";
import type { JenisSyaratSertifikat, KategoriModul } from "@/types/kegiatan";
import type { HasilModul, ModulSnapshotItem, StatusPendaftaran } from "@/types/pendaftaran";
import type { StatusSertifikat } from "@/types/sertifikat";
import type { PesertaAdminRingkas } from "@/types/admin-pendaftaran";

class AdminPendaftaranRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminPendaftaranRouteError";
    this.status = status;
  }
}

function isJenisSyarat(value: unknown): value is JenisSyaratSertifikat {
  return value === "nilai_minimum" || value === "manual_admin";
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function isStatusPendaftaran(value: unknown): value is StatusPendaftaran {
  return value === "terdaftar" || value === "selesai";
}

function isStatusSertifikat(value: unknown): value is StatusSertifikat {
  return value === "berlaku" || value === "dicabut";
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
 * Pratinjau penerbitan massal (§10, docs/arsitektur.md) — daftar peserta
 * terdaftar di satu kegiatan, digabung dengan evaluasiKelayakan() (satu
 * sumber kebenaran yang sama dipakai penerbitan mandiri & massal) dan
 * status sertifikat masing-masing.
 */
export async function GET(request: Request) {
  try {
    const user = await verifyRequest(request);
    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    if (!isAdminRole) {
      throw new AdminPendaftaranRouteError(403, "Hanya admin yang boleh membuka ini.");
    }

    const url = new URL(request.url);
    const kegiatanId = url.searchParams.get("kegiatanId");
    if (!kegiatanId) {
      throw new AdminPendaftaranRouteError(400, "kegiatanId wajib diisi.");
    }

    const db = getAdminDb();
    const [kegiatanSnap, pendaftaranSnap, sertifikatSnap] = await Promise.all([
      db.collection("kegiatan").doc(kegiatanId).get(),
      db.collection("pendaftaran").where("kegiatanId", "==", kegiatanId).get(),
      db.collection("sertifikat").where("kegiatanId", "==", kegiatanId).get(),
    ]);

    if (!kegiatanSnap.exists) {
      throw new AdminPendaftaranRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const kegiatanData = kegiatanSnap.data() ?? {};
    const syaratRaw =
      typeof kegiatanData.syaratSertifikat === "object" && kegiatanData.syaratSertifikat !== null
        ? (kegiatanData.syaratSertifikat as Record<string, unknown>)
        : {};
    const jenisSyarat: JenisSyaratSertifikat = isJenisSyarat(syaratRaw.jenis)
      ? syaratRaw.jenis
      : "manual_admin";
    const nilaiMinimumSyarat = typeof syaratRaw.nilaiMinimum === "number" ? syaratRaw.nilaiMinimum : 0;

    const sertifikatByUid = new Map<string, { id: string; serial: string; status: StatusSertifikat }>();
    sertifikatSnap.docs.forEach((doc) => {
      const data = doc.data();
      const uid = typeof data.uid === "string" ? data.uid : "";
      if (!uid) {
        return;
      }
      sertifikatByUid.set(uid, {
        id: doc.id,
        serial: typeof data.serial === "string" ? data.serial : "",
        status: isStatusSertifikat(data.status) ? data.status : "berlaku",
      });
    });

    const items: PesertaAdminRingkas[] = pendaftaranSnap.docs.map((doc) => {
      const data = doc.data();
      const uid = typeof data.uid === "string" ? data.uid : "";
      const modulSnapshot = mapModulSnapshot(data.modulSnapshot);
      const hasilModul = mapHasilModul(data.hasilModul);
      const kelayakan = evaluasiKelayakan(
        { modulSnapshot, hasilModul },
        { syaratSertifikat: { jenis: jenisSyarat, nilaiMinimum: nilaiMinimumSyarat } }
      );
      return {
        uid,
        namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
        email: typeof data.email === "string" ? data.email : "",
        institusi: typeof data.institusi === "string" ? data.institusi : "",
        nomorUrut: typeof data.nomorUrut === "number" ? data.nomorUrut : 0,
        status: isStatusPendaftaran(data.status) ? data.status : "terdaftar",
        hasilModul,
        layak: kelayakan.layak,
        statusKelayakan: kelayakan.status,
        alasanKelayakan: kelayakan.alasan,
        nilaiAkhir: kelayakan.nilaiAkhir,
        items: kelayakan.items,
        sertifikat: sertifikatByUid.get(uid) ?? null,
      };
    });

    items.sort((a, b) => a.nomorUrut - b.nomorUrut);

    return Response.json({ items });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof AdminPendaftaranRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
