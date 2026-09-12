import { randomInt } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { LABEL_TINGKAT_ATESTASI, normalkanAmbangKeterlibatan } from "@/lib/atestasi-pernyataan";
import type { HasilUntukNilaiAtestasi, TingkatAtestasi } from "@/lib/atestasi-pernyataan";
import { evaluasiKelayakan, putuskanPenerbitan, tentukanJenisSertifikat } from "@/lib/sertifikat-syarat";
import { periksaUrlGambar } from "@/lib/validasi-url-gambar";
import type {
  AmbangKeterlibatan,
  JenisSyaratSertifikat,
  KategoriModul,
  ModeAmbangKeterlibatan,
} from "@/types/kegiatan";
import type { HasilModul, ModulSnapshotItem } from "@/types/pendaftaran";
import type {
  ItemSertifikat,
  JenisSertifikat,
  RiwayatSertifikat,
  Sertifikat,
  SertifikatDetail,
  StatusSertifikat,
} from "@/types/sertifikat";


export class SertifikatRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SertifikatRouteError";
    this.status = status;
  }
}

const ALFABET_KODE_VERIFIKASI = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function buatKodeVerifikasi(): string {
  let hasil = "";
  for (let i = 0; i < 10; i += 1) {
    hasil += ALFABET_KODE_VERIFIKASI[randomInt(ALFABET_KODE_VERIFIKASI.length)];
  }
  return hasil;
}

/**
 * Acak, bukan diturunkan dari serial atau id apa pun — tidak boleh bisa
 * ditebak. Dicek unik terhadap sertifikat yang sudah ada; 36^10 kemungkinan
 * membuat tabrakan nyaris mustahil, tapi tetap dicek, bukan diasumsikan.
 */
export async function buatKodeVerifikasiUnik(db: Firestore): Promise<string> {
  for (let percobaan = 0; percobaan < 5; percobaan += 1) {
    const kandidat = buatKodeVerifikasi();
    const existing = await db
      .collection("sertifikat")
      .where("kodeVerifikasi", "==", kandidat)
      .limit(1)
      .get();
    if (existing.empty) {
      return kandidat;
    }
  }
  throw new SertifikatRouteError(500, "Gagal membuat kode verifikasi unik, coba lagi.");
}

export function isStatusSertifikat(value: unknown): value is StatusSertifikat {
  return value === "berlaku" || value === "dicabut";
}

// Slice 6.3 — sertifikat dari SEBELUM field ini ada tidak punya sama
// sekali (bukan galat, itu satu-satunya jenis yang pernah terbit). Jatuh
// ke 'kelulusan', TIDAK ditulis ulang ke dokumen lama.
export function isJenisSertifikat(value: unknown): value is JenisSertifikat {
  return value === "kelulusan" || value === "keikutsertaan";
}

export function mapItemsSertifikat(value: unknown): ItemSertifikat[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      modulId: typeof item.modulId === "string" ? item.modulId : "",
      judul: typeof item.judul === "string" ? item.judul : "",
      skor: typeof item.skor === "number" ? item.skor : 0,
      lulus: typeof item.lulus === "boolean" ? item.lulus : false,
    }));
}

function mapPernyataanAtestasi(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Menggabungkan snapshot sertifikat (KA-6, dibekukan) dengan template
 * sertifikat LIVE dari dokumen kegiatan saat ini — dipakai bersama oleh
 * GET /api/sertifikat/[id] dan GET /api/sertifikat/cetak/[kodeVerifikasi],
 * satu sumber kebenaran untuk bentuk respons keduanya.
 */
export function buildSertifikatDetail(
  sertifikatId: string,
  kegiatanId: string,
  data: DocumentData,
  kegiatanData: DocumentData
): SertifikatDetail {
  const templateRaw =
    typeof kegiatanData.templateSertifikat === "object" && kegiatanData.templateSertifikat !== null
      ? (kegiatanData.templateSertifikat as Record<string, unknown>)
      : {};

  return {
    id: sertifikatId,
    kegiatanId,
    serial: typeof data.serial === "string" ? data.serial : "",
    kodeVerifikasi: typeof data.kodeVerifikasi === "string" ? data.kodeVerifikasi : "",
    namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
    judulKegiatan: typeof data.judulKegiatan === "string" ? data.judulKegiatan : "",
    jenis: isJenisSertifikat(data.jenis) ? data.jenis : "kelulusan",
    nilaiAkhir: typeof data.nilaiAkhir === "number" ? data.nilaiAkhir : 0,
    items: mapItemsSertifikat(data.items),
    pernyataanAtestasi: mapPernyataanAtestasi(data.pernyataanAtestasi),
    status: isStatusSertifikat(data.status) ? data.status : "berlaku",
    terbitPada: typeof data.terbitPada === "string" ? data.terbitPada : "",
    template: {
      // logoUrl/kopUrl TETAP live — identitas lembaga, bukan pernyataan
      // perseorangan.
      logoUrl: typeof templateRaw.logoUrl === "string" ? templateRaw.logoUrl : "",
      kopUrl: typeof templateRaw.kopUrl === "string" ? templateRaw.kopUrl : "",
      // penandatanganNama/Jabatan/tandaTanganUrl DIBEKUKAN saat terbit —
      // beda dari logoUrl/kopUrl di atas. Field HADIR di dokumen sertifikat
      // (walau string kosong) berarti sudah dibekukan; mundur ke template
      // hidup hanya kalau field itu sama sekali tidak ada (sertifikat dari
      // sebelum fitur ini ada).
      penandatanganNama:
        typeof data.penandatanganNama === "string"
          ? data.penandatanganNama
          : typeof templateRaw.penandatanganNama === "string"
            ? templateRaw.penandatanganNama
            : "",
      penandatanganJabatan:
        typeof data.penandatanganJabatan === "string"
          ? data.penandatanganJabatan
          : typeof templateRaw.penandatanganJabatan === "string"
            ? templateRaw.penandatanganJabatan
            : "",
      tandaTanganUrl:
        typeof data.tandaTanganUrl === "string"
          ? data.tandaTanganUrl
          : typeof templateRaw.tandaTanganUrl === "string"
            ? templateRaw.tandaTanganUrl
            : "",
      teksTambahan: typeof templateRaw.teksTambahan === "string" ? templateRaw.teksTambahan : "",
    },
  };
}

function isJenisSyarat(value: unknown): value is JenisSyaratSertifikat {
  return value === "nilai_minimum" || value === "manual_admin";
}

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function isModeAmbangKeterlibatan(value: unknown): value is ModeAmbangKeterlibatan {
  return value === "persen" || value === "menit";
}

function mapAmbangKeterlibatanUntukSnapshot(value: unknown): AmbangKeterlibatan | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const data = value as Record<string, unknown>;
  return isModeAmbangKeterlibatan(data.mode) && typeof data.nilai === "number"
    ? { mode: data.mode, nilai: data.nilai }
    : null;
}

/**
 * Slice 7.5: ambangKeterlibatan mentah pada modulSnapshot beku (KA-5) bisa
 * mustahil dievaluasi (persen tanpa durasi diketahui — bug migrasi 7.3).
 * Dinormalkan di sini, di titik baca, jadi peserta lama ikut terkoreksi
 * tanpa menulis ulang dokumen pendaftaran. nilaiAtestasi() (dipanggil
 * evaluasiKelayakan() untuk modulSnapshot ini) juga menormalkan sendiri
 * sebagai pagar terakhir — dua lapis, bukan saling menggantikan.
 */
function mapModulSnapshotUntukKelayakan(value: unknown): ModulSnapshotItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const durasiDetik = typeof item.durasiDetik === "number" ? item.durasiDetik : null;
      const ambangMentah = mapAmbangKeterlibatanUntukSnapshot(item.ambangKeterlibatan);
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

function mapReferensiDibukaUntukKelayakan(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Hanya score dan detikTersaksikan — satu-satunya dua field HasilAtestasi
 * yang dibaca nilaiAtestasi(), dipakai BERSAMA oleh gerbang kelayakan
 * (evaluasiKelayakan()) dan kalimat pernyataan atestasi di bawah.
 */
function mapAtestasiUntukKelayakan(value: unknown): Record<string, HasilUntukNilaiAtestasi> {
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

function mapHasilModulUntukKelayakan(value: unknown): Record<string, HasilModul> {
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

export interface TerbitkanSertifikatInput {
  kegiatanId: string;
  targetUid: string;
  /**
   * true: peserta menerbitkan miliknya sendiri — hanya boleh untuk
   * syaratSertifikat.jenis 'nilai_minimum' dan hanya kalau
   * evaluasiKelayakan() bilang layak. false: admin menerbitkan (untuk diri
   * sendiri atau orang lain) — boleh untuk jenis apa pun, tidak digerbangi
   * kelayakan (§10, docs/arsitektur.md — admin yang mencoret pratinjau).
   */
  isSelfIssue: boolean;
  actingUid: string;
}

/**
 * SATU jalur penerbitan, dipakai POST /api/sertifikat/terbitkan (mandiri)
 * DAN POST /api/sertifikat/terbitkan-massal (admin) — tidak diduplikasi.
 * ID deterministik sertifikat/{kegiatanId}_{uid} (KA-3). Kalau sudah ada
 * dan 'berlaku', dikembalikan apa adanya — tidak diterbitkan ulang, tidak
 * ditimpa.
 */
export async function terbitkanSertifikatUntuk(
  db: Firestore,
  input: TerbitkanSertifikatInput
): Promise<Sertifikat> {
  const { kegiatanId, targetUid, isSelfIssue, actingUid } = input;

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

  const sertifikatDataLama = sertifikatSnap.exists ? sertifikatSnap.data() : undefined;
  if (sertifikatDataLama?.status === "berlaku") {
    return { id: sertifikatSnap.id, ...(sertifikatDataLama as Omit<Sertifikat, "id">) };
  }
  // Sertifikat lama berstatus 'dicabut' — ini penerbitan ULANG, bukan
  // penerbitan baru. serial/nomorUrut/kodeVerifikasi dipertahankan di
  // bawah; namaLengkap/judulKegiatan/items/penandatangan diambil ulang
  // (snapshot baru) supaya penerbitan ulang memperbaiki apa pun yang salah
  // pada terbitan sebelumnya.
  const sedangTerbitUlang = sertifikatDataLama?.status === "dicabut";

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
  const wajibBukaReferensiSyarat =
    typeof syaratRaw.wajibBukaReferensi === "boolean" ? syaratRaw.wajibBukaReferensi : false;
  const atestasiJadiSyaratSyarat =
    typeof syaratRaw.atestasiJadiSyarat === "boolean" ? syaratRaw.atestasiJadiSyarat : false;
  // Slice 6.3 — bawaan false SELALU, lihat komentar SyaratSertifikat.terbitkanKeikutsertaan.
  const terbitkanKeikutsertaanSyarat =
    typeof syaratRaw.terbitkanKeikutsertaan === "boolean" ? syaratRaw.terbitkanKeikutsertaan : false;

  // Penandatangan (nama, jabatan, DAN gambar tanda tangannya) DIBEKUKAN di
  // sertifikat — itu pernyataan seseorang, bukan branding. logo/kop TETAP
  // diambil live di buildSertifikatDetail(), tidak di sini.
  const templateRaw =
    typeof kegiatanData.templateSertifikat === "object" && kegiatanData.templateSertifikat !== null
      ? (kegiatanData.templateSertifikat as Record<string, unknown>)
      : {};
  const penandatanganNama =
    typeof templateRaw.penandatanganNama === "string" ? templateRaw.penandatanganNama : "";
  const penandatanganJabatan =
    typeof templateRaw.penandatanganJabatan === "string" ? templateRaw.penandatanganJabatan : "";
  const tandaTanganUrl =
    typeof templateRaw.tandaTanganUrl === "string" ? templateRaw.tandaTanganUrl : "";

  // Pagar terakhir — sertifikat tidak boleh membekukan tautan yang akan
  // mati. Form di /admin/kegiatan/[id] sudah memvalidasi ini juga, tapi
  // template kegiatan bisa saja diubah lewat jalur lain (atau formnya
  // diterobos), jadi diperiksa ulang di sini sebelum tandaTanganUrl
  // dibekukan ke dokumen sertifikat.
  const validasiTandaTangan = periksaUrlGambar(tandaTanganUrl);
  if (!validasiTandaTangan.valid) {
    throw new SertifikatRouteError(
      400,
      `URL gambar tanda tangan pada template kegiatan tidak valid: ${validasiTandaTangan.alasan}`
    );
  }

  const pendaftaranData = pendaftaranSnap.data() ?? {};
  const modulSnapshot = mapModulSnapshotUntukKelayakan(pendaftaranData.modulSnapshot);
  const hasilModul = mapHasilModulUntukKelayakan(pendaftaranData.hasilModul);
  const referensiDibuka = mapReferensiDibukaUntukKelayakan(pendaftaranData.referensiDibuka);
  const atestasiHasil = mapAtestasiUntukKelayakan(pendaftaranData.atestasi);
  const namaLengkap =
    typeof pendaftaranData.namaLengkap === "string" ? pendaftaranData.namaLengkap : "";
  const nomorUrut = typeof pendaftaranData.nomorUrut === "number" ? pendaftaranData.nomorUrut : 0;
  const daftarPada =
    typeof pendaftaranData.daftarPada === "string"
      ? pendaftaranData.daftarPada
      : new Date().toISOString();

  const { kelayakan, prasyaratMateri } = evaluasiKelayakan(
    { modulSnapshot, hasilModul, referensiDibuka, atestasi: atestasiHasil },
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

  // Pernyataan atestasi — KALIMAT, tidak pernah angka mentah/nickname
  // (§4, Slice 7.3: aman ditampilkan bahkan di halaman verifikasi
  // PUBLIK). Dibangun dari prasyaratMateri.atestasiPerModul (satu sumber
  // kebenaran yang sama dipakai gerbang kelayakan, Slice 7.4) — mencakup
  // SEMUA modul atestasi di modulSnapshot (wajib maupun opsional) yang
  // sudah mencapai minimal 'menuntaskan'. Modul yang belum tuntas tidak
  // dicetak sama sekali (sertifikat mendokumentasikan capaian, bukan yang
  // belum tercapai).
  const pernyataanAtestasi: string[] = prasyaratMateri.atestasiPerModul
    .filter(
      (modul): modul is { modulId: string; judul: string; wajib: boolean; tingkat: Exclude<TingkatAtestasi, "belum"> } =>
        modul.tingkat !== "belum"
    )
    .map((modul) => `${LABEL_TINGKAT_ATESTASI[modul.tingkat]} materi interaktif: ${modul.judul}.`);

  // putuskanPenerbitan() adalah SATU sumber kebenaran untuk "apakah nilai +
  // materi wajib memenuhi syarat kelayakan" — dipakai juga oleh
  // scripts/periksa-kelayakan.ts dan scripts/uji-atestasi.ts. Slice 6.3:
  // bisaTerbit dari sini (BUKAN kelayakan.layak sendirian) yang dioper ke
  // tentukanJenisSertifikat() sebagai "memenuhi syarat kelayakan" —
  // satu-satunya jalan mendapat jenis 'kelulusan'. Untuk 'manual_admin',
  // bisaTerbit SELALU true (sistem tidak pernah menilai otomatis di mode
  // itu), jadi jenis SELALU 'kelulusan' di sana — persis satu-satunya
  // perilaku yang pernah ada sebelum slice ini.
  const keputusanKelulusan = putuskanPenerbitan(jenisSyarat, { kelayakan, prasyaratMateri });

  // self-issue TIDAK PERNAH menerima 'keikutsertaan' — peserta hanya bisa
  // menerbitkan sendiri kalau benar-benar memenuhi syarat kelulusan, sama
  // persis seperti sebelum slice ini. Materi wajib yang belum tuntas
  // (dulu digerbang terpisah di sini) sekarang ikut tercakup oleh
  // keputusanKelulusan.bisaTerbit, jadi pesannya tetap sama.
  let jenis: JenisSertifikat;
  if (isSelfIssue) {
    if (jenisSyarat !== "nilai_minimum") {
      throw new SertifikatRouteError(400, "Kegiatan ini memerlukan penerbitan oleh admin.");
    }
    if (!keputusanKelulusan.bisaTerbit) {
      throw new SertifikatRouteError(400, keputusanKelulusan.alasan);
    }
    jenis = "kelulusan";
  } else {
    // Admin TIDAK bisa menurunkan orang yang layak jadi keikutsertaan
    // (bisaTerbit true selalu menang, terlepas dari terbitkanKeikutsertaan)
    // dan TIDAK bisa menaikkan yang tidak layak jadi kelulusan (satu-
    // satunya jalan ke 'kelulusan' adalah bisaTerbit true) — jenis
    // mengikuti kelayakan, kelayakan mengikuti data (Slice 6.3).
    const hasilJenis = tentukanJenisSertifikat(
      true, // pendaftaranSnap.exists sudah dipastikan di atas — targetUid TERDAFTAR
      keputusanKelulusan.bisaTerbit,
      terbitkanKeikutsertaanSyarat
    );
    if (!hasilJenis.bolehTerbit || !hasilJenis.jenis) {
      throw new SertifikatRouteError(400, hasilJenis.alasan);
    }
    jenis = hasilJenis.jenis;
  }

  // §10 (docs/arsitektur.md): nomorUrut dialokasikan saat pendaftaran, jadi
  // serial ikut stabil dari situ. Untuk penerbitan ulang, serial DAN
  // kodeVerifikasi dipertahankan persis dari dokumen lama — nomor urut
  // membuat orang yang sama di kegiatan yang sama tetap memegang serial
  // yang sama, dan kode verifikasi yang sudah pernah disebar (mis. lewat
  // QR yang sudah dicetak) tidak boleh berubah arti.
  const serialLama =
    sertifikatDataLama && typeof sertifikatDataLama.serial === "string"
      ? sertifikatDataLama.serial
      : "";
  const kodeVerifikasiLama =
    sertifikatDataLama && typeof sertifikatDataLama.kodeVerifikasi === "string"
      ? sertifikatDataLama.kodeVerifikasi
      : "";

  let serial: string;
  let kodeVerifikasi: string;
  if (sedangTerbitUlang && serialLama && kodeVerifikasiLama) {
    serial = serialLama;
    kodeVerifikasi = kodeVerifikasiLama;
  } else {
    const tahun = new Date(daftarPada).getFullYear();
    serial = `${kode}/${tahun}/${String(nomorUrut).padStart(4, "0")}`;
    kodeVerifikasi = await buatKodeVerifikasiUnik(db);
  }

  const now = new Date().toISOString();
  const entriRiwayat: RiwayatSertifikat = {
    aksi: "terbit",
    pada: Timestamp.now(),
    olehUid: actingUid,
  };

  const record: Omit<Sertifikat, "id" | "riwayat"> = {
    kegiatanId,
    uid: targetUid,
    serial,
    kodeVerifikasi,
    namaLengkap,
    judulKegiatan,
    jenis,
    nilaiAkhir: kelayakan.nilaiAkhir,
    items: kelayakan.items,
    pernyataanAtestasi,
    status: "berlaku",
    terbitPada: now,
    diterbitkanOleh: actingUid,
    penandatanganNama,
    penandatanganJabatan,
    tandaTanganUrl,
    dicabutPada: null,
    dicabutOleh: null,
    alasanPencabutan: null,
  };

  let riwayatBaru: RiwayatSertifikat[] = [];
  await db.runTransaction(async (tx) => {
    const recheck = await tx.get(sertifikatRef);
    const dataRecheck = recheck.exists ? recheck.data() : undefined;
    if (dataRecheck?.status === "berlaku") {
      throw new SertifikatRouteError(409, "Sertifikat ini baru saja diterbitkan.");
    }
    // SENGAJA TIDAK memakai FieldValue.arrayUnion di sini. Field transform
    // dievaluasi terhadap dokumen HASIL set() ini — dan set() non-merge
    // menghapus field apa pun yang tidak disertakan secara eksplisit
    // (termasuk riwayat lama) SEBELUM transform dijalankan. Jadi arrayUnion
    // di dalam tx.set() non-merge selalu menyatu dengan array kosong, bukan
    // riwayat yang sudah ada — dibuktikan lewat emulator Firestore. Karena
    // ini sudah di dalam transaksi (recheck di atas membaca versi terbaru),
    // tidak ada balapan yang perlu ditangani transform: riwayat lama diambil
    // dari recheck dan array baru disusun eksplisit sebagai nilai biasa.
    const riwayatLamaMentah = dataRecheck ? dataRecheck.riwayat : undefined;
    const riwayatLama = Array.isArray(riwayatLamaMentah) ? riwayatLamaMentah : [];
    riwayatBaru = [...riwayatLama, entriRiwayat];
    tx.set(sertifikatRef, { ...record, riwayat: riwayatBaru });
    if (kelayakan.layak) {
      tx.update(pendaftaranRef, { status: "selesai" });
    }
  });

  return {
    id: sertifikatRef.id,
    ...record,
    riwayat: riwayatBaru,
  };
}
