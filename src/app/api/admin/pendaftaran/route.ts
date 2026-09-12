import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import type { HasilUntukNilaiAtestasi } from "@/lib/atestasi-pernyataan";
import { getAdminDb } from "@/lib/firebase/admin";
import { izinPanitia } from "@/lib/izin-panitia";
import { evaluasiKelayakan, putuskanPenerbitan, tentukanJenisSertifikat } from "@/lib/sertifikat-syarat";
import type {
  AmbangKeterlibatan,
  JenisSyaratSertifikat,
  KategoriModul,
  ModeAmbangKeterlibatan,
} from "@/types/kegiatan";
import type {
  HasilModul,
  ModulSnapshotItem,
  StatusPendaftaran,
  SumberPendaftaran,
} from "@/types/pendaftaran";
import type { JenisSertifikat, StatusSertifikat } from "@/types/sertifikat";
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

// Slice 6.2 — pendaftaran dari SEBELUM field ini ada tidak punya sama
// sekali (bukan galat, itu satu-satunya jalur yang ada dulu); jatuh ke
// 'mandiri', jangan ditulis ulang.
function isSumberPendaftaran(value: unknown): value is SumberPendaftaran {
  return value === "mandiri" || value === "impor";
}

function isStatusSertifikat(value: unknown): value is StatusSertifikat {
  return value === "berlaku" || value === "dicabut";
}

// Slice 6.3 — sertifikat lama tanpa field jenis jatuh ke 'kelulusan',
// bukan galat (satu-satunya jenis yang pernah terbit sebelum slice ini).
function isJenisSertifikat(value: unknown): value is JenisSertifikat {
  return value === "kelulusan" || value === "keikutsertaan";
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
      ambangKeterlibatan: mapAmbangKeterlibatan(item.ambangKeterlibatan),
      targetSkor: typeof item.targetSkor === "number" ? item.targetSkor : null,
      durasiDetik: typeof item.durasiDetik === "number" ? item.durasiDetik : null,
    }));
}

function mapReferensiDibuka(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapAtestasi(value: unknown): Record<string, HasilUntukNilaiAtestasi> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const hasil: Record<string, HasilUntukNilaiAtestasi> = {};
  for (const [modulId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const data = entry as Record<string, unknown>;
    hasil[modulId] = {
      score: typeof data.score === "number" ? data.score : 0,
      detikTersaksikan: typeof data.detikTersaksikan === "number" ? data.detikTersaksikan : 0,
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
      kedaluwarsa: typeof data.kedaluwarsa === "boolean" ? data.kedaluwarsa : false,
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

    // Slice 8.1: admin/superadmin selalu lolos; panitia hanya kalau
    // ditugaskan di KEGIATAN INI — izinPanitia() adalah satu-satunya
    // sumber kebenaran, tidak ditulis ulang di sini.
    if (!izinPanitia(user, kegiatanData).lihatPeserta) {
      throw new AdminPendaftaranRouteError(
        403,
        "Anda tidak berhak melihat peserta kegiatan ini."
      );
    }
    const syaratRaw =
      typeof kegiatanData.syaratSertifikat === "object" && kegiatanData.syaratSertifikat !== null
        ? (kegiatanData.syaratSertifikat as Record<string, unknown>)
        : {};
    const jenisSyarat: JenisSyaratSertifikat = isJenisSyarat(syaratRaw.jenis)
      ? syaratRaw.jenis
      : "manual_admin";
    const nilaiMinimumSyarat = typeof syaratRaw.nilaiMinimum === "number" ? syaratRaw.nilaiMinimum : 0;
    const wajibBukaReferensiSyarat =
      typeof syaratRaw.wajibBukaReferensi === "boolean" ? syaratRaw.wajibBukaReferensi : false;
    const atestasiJadiSyaratSyarat =
      typeof syaratRaw.atestasiJadiSyarat === "boolean" ? syaratRaw.atestasiJadiSyarat : false;
    // Slice 6.3 — bawaan false SELALU, lihat komentar SyaratSertifikat.terbitkanKeikutsertaan.
    const terbitkanKeikutsertaanSyarat =
      typeof syaratRaw.terbitkanKeikutsertaan === "boolean" ? syaratRaw.terbitkanKeikutsertaan : false;

    const sertifikatByUid = new Map<
      string,
      {
        id: string;
        serial: string;
        status: StatusSertifikat;
        kodeVerifikasi: string;
        jenis: JenisSertifikat;
      }
    >();
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
        kodeVerifikasi: typeof data.kodeVerifikasi === "string" ? data.kodeVerifikasi : "",
        jenis: isJenisSertifikat(data.jenis) ? data.jenis : "kelulusan",
      });
    });

    const items: PesertaAdminRingkas[] = pendaftaranSnap.docs.map((doc) => {
      const data = doc.data();
      const uid = typeof data.uid === "string" ? data.uid : "";
      const modulSnapshot = mapModulSnapshot(data.modulSnapshot);
      const hasilModul = mapHasilModul(data.hasilModul);
      const referensiDibuka = mapReferensiDibuka(data.referensiDibuka);
      const atestasi = mapAtestasi(data.atestasi);
      const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
        { modulSnapshot, hasilModul, referensiDibuka, atestasi },
        {
          syaratSertifikat: {
            jenis: jenisSyarat,
            nilaiMinimum: nilaiMinimumSyarat,
            wajibBukaReferensi: wajibBukaReferensiSyarat,
            atestasiJadiSyarat: atestasiJadiSyaratSyarat,
            terbitkanKeikutsertaan: terbitkanKeikutsertaanSyarat,
          },
        }
      );
      const keputusan = putuskanPenerbitan(jenisSyarat, { kelayakan, prasyaratMateri });
      // Slice 6.3 (BAGIAN d) — jenis yang AKAN dibekukan kalau admin
      // menerbitkan sekarang, dihitung dengan fungsi murni yang SAMA
      // dipakai terbitkanSertifikatUntuk() — supaya proyeksi yang admin
      // lihat di rekap/konfirmasi tidak bisa diam-diam berbeda dari yang
      // sungguhan terjadi saat tombol ditekan.
      const hasilJenis = tentukanJenisSertifikat(
        true,
        keputusan.bisaTerbit,
        terbitkanKeikutsertaanSyarat
      );
      return {
        uid,
        namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
        email: typeof data.email === "string" ? data.email : "",
        institusi: typeof data.institusi === "string" ? data.institusi : "",
        sumber: isSumberPendaftaran(data.sumber) ? data.sumber : "mandiri",
        nomorUrut: typeof data.nomorUrut === "number" ? data.nomorUrut : 0,
        status: isStatusPendaftaran(data.status) ? data.status : "terdaftar",
        hasilModul,
        layak: kelayakan.layak,
        statusKelayakan: kelayakan.status,
        alasanKelayakan: kelayakan.alasan,
        nilaiAkhir: kelayakan.nilaiAkhir,
        items: kelayakan.items,
        prasyaratMateri,
        bisaTerbit: keputusan.bisaTerbit,
        alasanPenerbitan: keputusan.alasan,
        // Slice 6.3 — proyeksi jenis KALAU admin menerbitkan sekarang; null
        // kalau tidak boleh terbit sama sekali (belum memenuhi syarat, dan
        // kegiatan ini tidak mengizinkan keikutsertaan).
        jenisSertifikatProyeksi: hasilJenis.jenis,
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
