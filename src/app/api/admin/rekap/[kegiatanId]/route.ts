import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import type { HasilUntukNilaiAtestasi } from "@/lib/atestasi-pernyataan";
import { getAdminDb } from "@/lib/firebase/admin";
import { izinPanitia } from "@/lib/izin-panitia";
import {
  keCsv,
  susunBarisRekap,
  type RekapKegiatanInfo,
  type RekapModulInfo,
  type RekapPesertaBaris,
} from "@/lib/rekap-csv";
import { evaluasiKelayakan, statusPrasyaratMateri } from "@/lib/sertifikat-syarat";
import type {
  AmbangKeterlibatan,
  JenisSyaratSertifikat,
  KategoriModul,
  ModeAmbangKeterlibatan,
} from "@/types/kegiatan";
import type { HasilModul, ModulSnapshotItem, StatusPendaftaran } from "@/types/pendaftaran";
import type { StatusSertifikat } from "@/types/sertifikat";

class RekapRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RekapRouteError";
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
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
    };
  }
  return hasil;
}

/** Format tanggal untuk nama berkas — YYYY-MM-DD, zona waktu lokal server tidak relevan (tanggal ekspor, bukan tanggal acara). */
function tanggalHariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/admin/rekap/[kegiatanId] — ekspor CSV rekap peserta satu
 * kegiatan (Slice 8.3). Digerbangi izinPanitia().lihatPeserta — sama
 * seperti GET /api/admin/pendaftaran (tabel di layar), supaya siapa pun
 * yang boleh MELIHAT peserta juga boleh MENGUNDUH rekapnya; panitia untuk
 * kegiatan yang bukan tugasnya ditolak, termasuk kalau ia mengetik
 * kegiatanId-nya langsung.
 *
 * ?pemisah=koma memilih koma sebagai pemisah kolom — bawaannya titik koma
 * (Excel dengan region Indonesia mengharapkan itu).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kegiatanId: string }> }
) {
  try {
    const user = await verifyRequest(request);
    const { kegiatanId } = await params;

    const db = getAdminDb();
    const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
    const [kegiatanSnap, pendaftaranSnap, sertifikatSnap, modulSnap] = await Promise.all([
      kegiatanRef.get(),
      db.collection("pendaftaran").where("kegiatanId", "==", kegiatanId).get(),
      db.collection("sertifikat").where("kegiatanId", "==", kegiatanId).get(),
      kegiatanRef.collection("modul").get(),
    ]);

    if (!kegiatanSnap.exists) {
      throw new RekapRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const kegiatanData = kegiatanSnap.data() ?? {};

    if (!izinPanitia(user, kegiatanData).lihatPeserta) {
      throw new RekapRouteError(403, "Anda tidak berhak mengekspor rekap kegiatan ini.");
    }

    const kode = typeof kegiatanData.kode === "string" && kegiatanData.kode ? kegiatanData.kode : kegiatanId;
    const judul = typeof kegiatanData.judul === "string" ? kegiatanData.judul : "";
    const syaratRaw =
      typeof kegiatanData.syaratSertifikat === "object" && kegiatanData.syaratSertifikat !== null
        ? (kegiatanData.syaratSertifikat as Record<string, unknown>)
        : {};
    const jenisSyarat: JenisSyaratSertifikat = isJenisSyarat(syaratRaw.jenis) ? syaratRaw.jenis : "manual_admin";
    const nilaiMinimumSyarat = typeof syaratRaw.nilaiMinimum === "number" ? syaratRaw.nilaiMinimum : 0;
    const wajibBukaReferensiSyarat =
      typeof syaratRaw.wajibBukaReferensi === "boolean" ? syaratRaw.wajibBukaReferensi : false;
    const atestasiJadiSyaratSyarat =
      typeof syaratRaw.atestasiJadiSyarat === "boolean" ? syaratRaw.atestasiJadiSyarat : false;

    const modul: RekapModulInfo[] = modulSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        judul: typeof data.judul === "string" ? data.judul : "",
        kategori: isKategoriModul(data.kategori) ? data.kategori : "evaluasi",
        urutan: typeof data.urutan === "number" ? data.urutan : 0,
      };
    });
    const kegiatanInfo: RekapKegiatanInfo = { judul, modul };

    const sertifikatByUid = new Map<
      string,
      { serial: string; status: StatusSertifikat; terbitPada: string; kodeVerifikasi: string }
    >();
    sertifikatSnap.docs.forEach((doc) => {
      const data = doc.data();
      const uid = typeof data.uid === "string" ? data.uid : "";
      if (!uid) {
        return;
      }
      sertifikatByUid.set(uid, {
        serial: typeof data.serial === "string" ? data.serial : "",
        status: isStatusSertifikat(data.status) ? data.status : "berlaku",
        terbitPada: typeof data.terbitPada === "string" ? data.terbitPada : "",
        kodeVerifikasi: typeof data.kodeVerifikasi === "string" ? data.kodeVerifikasi : "",
      });
    });

    // nomorIdentitas/noTelepon HANYA ada di profil pengguna (users/{uid}),
    // tidak pernah dibekukan ke dokumen pendaftaran (lihat POST
    // /api/pendaftaran) — satu getAll() untuk semua peserta sekaligus,
    // bukan satu per satu.
    const uids = pendaftaranSnap.docs
      .map((doc) => doc.data().uid)
      .filter((uid): uid is string => typeof uid === "string" && uid.length > 0);
    const userSnaps =
      uids.length > 0 ? await db.getAll(...uids.map((uid) => db.collection("users").doc(uid))) : [];
    const userByUid = new Map<string, { nomorIdentitas: string; noTelepon: string }>();
    userSnaps.forEach((snap) => {
      if (!snap.exists) {
        return;
      }
      const data = snap.data() ?? {};
      userByUid.set(snap.id, {
        nomorIdentitas: typeof data.nomorIdentitas === "string" ? data.nomorIdentitas : "",
        noTelepon: typeof data.noTelepon === "string" ? data.noTelepon : "",
      });
    });

    const daftarPeserta: RekapPesertaBaris[] = pendaftaranSnap.docs.map((doc) => {
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
          },
        }
      );

      // Slice 8.3a: modulId evaluasi yang ADA di snapshot BEKU peserta ini
      // (KA-5) — dikerjakan atau belum — supaya susunBarisRekap() bisa
      // membedakan "modul ada, belum dikerjakan" (sel kosong) dari "modul
      // belum ada saat peserta ini mendaftar" (sel "-"). Tanpa ini kedua
      // keadaan itu sama-sama kosong dan nilai akhir 67 dari dua modul
      // bernilai 100 tidak masuk akal dibaca dari CSV-nya saja.
      const modulEvaluasiDiSnapshot = modulSnapshot
        .filter((m) => m.kategori === "evaluasi")
        .map((m) => m.modulId);

      const hasilEvaluasi: RekapPesertaBaris["hasilEvaluasi"] = {};
      for (const [modulId, hasil] of Object.entries(hasilModul)) {
        hasilEvaluasi[modulId] = { skor: hasil.skorTertinggi, lulus: hasil.lulus };
      }
      const hasilAtestasi: RekapPesertaBaris["hasilAtestasi"] = {};
      for (const item of prasyaratMateri.atestasiPerModul) {
        hasilAtestasi[item.modulId] = item.tingkat;
      }

      const identitas = userByUid.get(uid);

      return {
        nomorUrut: typeof data.nomorUrut === "number" ? data.nomorUrut : 0,
        namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
        email: typeof data.email === "string" ? data.email : "",
        institusi: typeof data.institusi === "string" ? data.institusi : "",
        nomorIdentitas: identitas?.nomorIdentitas ?? "",
        noTelepon: identitas?.noTelepon ?? "",
        status: isStatusPendaftaran(data.status) ? data.status : "terdaftar",
        nilaiAkhir: kelayakan.nilaiAkhir,
        modulEvaluasiDiSnapshot,
        hasilEvaluasi,
        hasilAtestasi,
        jumlahReferensiDibuka: referensiDibuka.length,
        statusKelayakan: kelayakan.status,
        statusPrasyaratMateri: statusPrasyaratMateri(prasyaratMateri),
        sertifikat: sertifikatByUid.get(uid) ?? null,
      };
    });

    daftarPeserta.sort((a, b) => a.nomorUrut - b.nomorUrut);

    const url = new URL(request.url);
    const pemisah = url.searchParams.get("pemisah") === "koma" ? "," : ";";
    const csv = susunBarisRekap(kegiatanInfo, daftarPeserta);
    // BOM UTF-8 (U+FEFF, ditulis lewat fromCharCode supaya tidak ada
    // karakter tak terlihat tersimpan langsung di berkas sumber) — tanpa
    // ini nama beraksen rusak saat dibuka di Excel (Slice 8.3 §3).
    // Ditambahkan di sini, bukan di keCsv(), supaya fungsi itu tetap murni
    // teks CSV tanpa awalan tak terlihat.
    const BOM_UTF8 = String.fromCharCode(0xfeff);
    const isiBerkas = BOM_UTF8 + keCsv(csv, pemisah);
    const namaBerkas = `rekap-${kode}-${tanggalHariIni()}.csv`;

    return new Response(isiBerkas, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      },
    });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof RekapRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
