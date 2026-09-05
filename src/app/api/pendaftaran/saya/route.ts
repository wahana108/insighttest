import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { normalkanAmbangKeterlibatan } from "@/lib/atestasi-pernyataan";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AmbangKeterlibatan, KategoriModul, ModeAmbangKeterlibatan } from "@/types/kegiatan";
import type {
  HasilAtestasi,
  HasilModul,
  ModulSnapshotItem,
  PendaftaranRingkas,
  StatusPendaftaran,
} from "@/types/pendaftaran";

function isStatusPendaftaran(value: unknown): value is StatusPendaftaran {
  return value === "terdaftar" || value === "selesai";
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function isModeAmbangKeterlibatan(value: unknown): value is ModeAmbangKeterlibatan {
  return value === "persen" || value === "menit";
}

function mapAmbangKeterlibatan(value: unknown): AmbangKeterlibatan | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const data = value as Record<string, unknown>;
  return isModeAmbangKeterlibatan(data.mode) && typeof data.nilai === "number"
    ? { mode: data.mode, nilai: data.nilai }
    : null;
}

/**
 * Slice 7.5: modulSnapshot yang FROZEN sejak pendaftaran (KA-5) bisa
 * membawa ambangKeterlibatan yang mustahil dievaluasi (mode persen tanpa
 * durasi diketahui — bug migrasi 7.3). Dinormalkan DI SINI, saat dibaca,
 * supaya peserta lama ikut terkoreksi tanpa perlu menulis ulang dokumen
 * pendaftaran mereka.
 */
function mapModulSnapshot(value: unknown): ModulSnapshotItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const durasiDetik = typeof item.durasiDetik === "number" ? item.durasiDetik : null;
      const ambangMentah = mapAmbangKeterlibatan(item.ambangKeterlibatan);
      return {
        modulId: typeof item.modulId === "string" ? item.modulId : "",
        judul: typeof item.judul === "string" ? item.judul : "",
        kategori: isKategoriModul(item.kategori) ? item.kategori : "evaluasi",
        wajib: typeof item.wajib === "boolean" ? item.wajib : true,
        nilaiMinimum: typeof item.nilaiMinimum === "number" ? item.nilaiMinimum : null,
        ambangKeterlibatan: ambangMentah
          ? normalkanAmbangKeterlibatan(ambangMentah, durasiDetik).ambang
          : null,
        targetSkor: typeof item.targetSkor === "number" ? item.targetSkor : null,
        durasiDetik,
      };
    });
}

function mapReferensiDibuka(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapAtestasi(value: unknown): Record<string, HasilAtestasi> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const hasil: Record<string, HasilAtestasi> = {};
  for (const [modulId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const data = entry as Record<string, unknown>;
    hasil[modulId] = {
      gameId: typeof data.gameId === "string" ? data.gameId : "",
      hp: typeof data.hp === "number" ? data.hp : 0,
      score: typeof data.score === "number" ? data.score : 0,
      watchCreditSec: typeof data.watchCreditSec === "number" ? data.watchCreditSec : 0,
      currentTimeSec: typeof data.currentTimeSec === "number" ? data.currentTimeSec : 0,
      durationSec: typeof data.durationSec === "number" ? data.durationSec : null,
      chapterIndex: typeof data.chapterIndex === "number" ? data.chapterIndex : 0,
      nicknameCcl: typeof data.nicknameCcl === "string" ? data.nicknameCcl : "",
      dimulaiPada: typeof data.dimulaiPada === "string" ? data.dimulaiPada : "",
      laporTerakhirPada:
        typeof data.laporTerakhirPada === "string" ? data.laporTerakhirPada : "",
      gameBerubah: typeof data.gameBerubah === "boolean" ? data.gameBerubah : false,
      detikTersaksikan: typeof data.detikTersaksikan === "number" ? data.detikTersaksikan : 0,
      detikTersaksikanSesiTerakhir:
        typeof data.detikTersaksikanSesiTerakhir === "number"
          ? data.detikTersaksikanSesiTerakhir
          : 0,
      adaPemangkasan: typeof data.adaPemangkasan === "boolean" ? data.adaPemangkasan : false,
      detikDipangkas: typeof data.detikDipangkas === "number" ? data.detikDipangkas : 0,
    };
  }
  return hasil;
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

export async function GET(request: Request) {
  try {
    const user = await verifyRequest(request);

    const snapshot = await getAdminDb()
      .collection("pendaftaran")
      .where("uid", "==", user.uid)
      .get();

    const items: PendaftaranRingkas[] = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        kegiatanId: typeof data.kegiatanId === "string" ? data.kegiatanId : "",
        nomorUrut: typeof data.nomorUrut === "number" ? data.nomorUrut : 0,
        status: isStatusPendaftaran(data.status) ? data.status : "terdaftar",
        daftarPada: typeof data.daftarPada === "string" ? data.daftarPada : "",
        hasilModul: mapHasilModul(data.hasilModul),
        modulSnapshot: mapModulSnapshot(data.modulSnapshot),
        referensiDibuka: mapReferensiDibuka(data.referensiDibuka),
        atestasi: mapAtestasi(data.atestasi),
      };
    });

    return Response.json({ items });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
