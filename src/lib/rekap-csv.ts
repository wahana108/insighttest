import { LABEL_TINGKAT_ATESTASI, type TingkatAtestasi } from "@/lib/atestasi-pernyataan";
import type { StatusKelayakan, StatusPrasyaratMateri } from "@/lib/sertifikat-syarat";
import type { StatusPendaftaran, SumberPendaftaran } from "@/types/pendaftaran";
import type { JenisSertifikat, StatusSertifikat } from "@/types/sertifikat";

/**
 * Satu sel CSV — sengaja termasuk `number` (bukan cuma string), supaya 0
 * (skor, nilai akhir) tetap angka sungguhan sampai ke keCsv(), bukan
 * diketik jadi string kosong di tengah jalan. undefined/null berarti
 * "tidak ada data untuk peserta ini" — dicetak sel kosong, BUKAN teks
 * "undefined"/"null" (Slice 8.3 §4).
 */
export type SelRekap = string | number | null | undefined;

export interface RekapModulInfo {
  id: string;
  judul: string;
  kategori: "referensi" | "atestasi" | "evaluasi";
  urutan: number;
}

/** Kegiatan + daftar modulnya SAAT INI — menentukan kolom mana yang ada, apa pun isi modulSnapshot masing-masing peserta. */
export interface RekapKegiatanInfo {
  judul: string;
  modul: RekapModulInfo[];
}

export interface RekapPesertaBaris {
  nomorUrut: number;
  namaLengkap: string;
  email: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
  /**
   * Slice 6.1a: true kalau nomorIdentitas DAN/ATAU noTelepon di atas TIDAK
   * berasal dari dokumen pendaftaran yang beku, melainkan fallback live
   * dari users/{uid} — karena pendaftaran ini dibuat SEBELUM Slice 6.1a
   * (field itu belum ada sama sekali saat itu). Dipakai susunBarisRekap()
   * untuk mengisi kolom "Sumber Identitas" secara EKSPLISIT, bukan
   * membiarkan sel kosong berbohong tentang dari mana nilainya datang
   * (pelajaran Slice 8.3a — sel yang ambigu sudah pernah menggigit).
   */
  identitasDariProfil: boolean;
  /**
   * Slice 6.2: dari mana pendaftaran ini berasal — 'mandiri' (peserta
   * sendiri) atau 'impor' (dibuatkan admin lewat impor daftar hadir).
   * Penting untuk 6.3: peserta yang diimpor karena hadir belum tentu
   * mengerjakan evaluasi, dan CSV harus mengatakannya, bukan menyiratkan
   * mereka "belum mengerjakan" seolah mereka sama dengan yang mandiri.
   */
  sumber: SumberPendaftaran;
  status: StatusPendaftaran;
  nilaiAkhir: number;
  /**
   * Slice 8.3a: modulId modul evaluasi yang ADA di modulSnapshot peserta
   * ini (KA-5, dibekukan saat mendaftar) — dikerjakan atau belum, tidak
   * peduli. Dipakai membedakan "modul ada tapi belum dikerjakan" (sel
   * kosong) dari "modul ini belum ada saat peserta mendaftar" (sel "-")
   * pada kolom yang dibangun dari daftar modul kegiatan SAAT INI, yang
   * bisa saja sudah bertambah sejak peserta ini mendaftar. Tanpa ini,
   * kedua keadaan itu SAMA-SAMA kosong dan tidak bisa dibedakan — padahal
   * maknanya beda: yang pertama dihitung 0 ke nilai akhir, yang kedua
   * tidak dihitung sama sekali.
   */
  modulEvaluasiDiSnapshot: string[];
  /**
   * Kunci = modulId modul evaluasi. Tidak ada entri = peserta belum pernah
   * mengerjakan modul itu (tapi lihat modulEvaluasiDiSnapshot untuk tahu
   * apakah modulnya ada di snapshotnya). kedaluwarsa (Slice "ujian-berwaktu"):
   * true kalau attempt yang menentukan skor ini dikirim setelah ditutupPada
   * kegiatan — admin harus melihat ini SEBELUM memutuskan menerbitkan,
   * karena `lulus` di sini sudah TIDAK dipercaya evaluasiKelayakan() untuk
   * kelayakan otomatis walau nilainya di atas ambang.
   */
  hasilEvaluasi: Record<string, { skor: number; lulus: boolean; kedaluwarsa: boolean }>;
  /**
   * Kunci = modulId modul atestasi. Beda dari hasilEvaluasi: entrinya
   * SELALU ada untuk setiap modul atestasi di modulSnapshot peserta,
   * dikerjakan atau belum (nilaiAtestasi() default ke "belum", bukan
   * "tidak ada data") — jadi tidak ada makna ganda untuk kolom ini sendiri.
   * Tidak ada entri di sini murni berarti modulnya tidak ada di snapshot.
   */
  hasilAtestasi: Record<string, TingkatAtestasi>;
  jumlahReferensiDibuka: number;
  statusKelayakan: StatusKelayakan;
  statusPrasyaratMateri: StatusPrasyaratMateri;
  sertifikat: {
    serial: string;
    status: StatusSertifikat;
    terbitPada: string;
    kodeVerifikasi: string;
    /** Slice 6.3 — jenis sertifikat yang SUDAH terbit (bukan proyeksi). */
    jenis: JenisSertifikat;
  } | null;
}

const LABEL_STATUS_PENDAFTARAN: Record<StatusPendaftaran, string> = {
  terdaftar: "Terdaftar",
  selesai: "Selesai",
};

const LABEL_STATUS_KELAYAKAN: Record<StatusKelayakan, string> = {
  layak: "Layak",
  belum_layak: "Belum layak",
  ditentukan_admin: "Ditentukan admin",
};

const LABEL_STATUS_PRASYARAT: Record<StatusPrasyaratMateri, string> = {
  tuntas: "Tuntas",
  belum_tuntas_menghalangi: "Belum tuntas (menghalangi)",
  belum_tuntas_tidak_menghalangi: "Belum tuntas (gerbang nonaktif)",
};

const LABEL_STATUS_SERTIFIKAT: Record<StatusSertifikat, string> = {
  berlaku: "Berlaku",
  dicabut: "Dicabut",
};

const LABEL_JENIS_SERTIFIKAT: Record<JenisSertifikat, string> = {
  kelulusan: "Kelulusan",
  keikutsertaan: "Keikutsertaan",
};

const LABEL_SUMBER_IDENTITAS = {
  beku: "Dibekukan saat mendaftar",
  profil: "Profil saat ini (belum dibekukan)",
};

const LABEL_SUMBER_PENDAFTARAN: Record<SumberPendaftaran, string> = {
  mandiri: "Mandiri",
  impor: "Impor daftar hadir",
};

/**
 * Fungsi murni — tidak menyentuh Firestore. Kolom modul evaluasi/atestasi
 * ditentukan dari kegiatan.modul (urutan SAAT INI), bukan dari gabungan
 * modulSnapshot tiap peserta — supaya satu tabel punya kolom yang sama
 * untuk semua peserta terlepas dari kapan mereka mendaftar.
 *
 * Slice 8.3a: karena itu, sel kosong bisa berarti DUA hal yang berbeda —
 * dibedakan secara eksplisit, bukan sama-sama kosong:
 *   - modul TIDAK ADA di modulSnapshot peserta (belum ada saat ia
 *     mendaftar) → sel "-", tidak pernah dihitung ke nilai akhir.
 *   - modul ADA di snapshotnya tapi belum dikerjakan → sel KOSONG
 *     (skor/lulus), dihitung 0 ke nilai akhir (lihat evaluasiKelayakan()).
 * Temuan nyata yang memicu ini: peserta dengan dua modul bernilai 100 dan
 * dua sel kosong bisa punya nilai akhir 67 (satu sel kosong dihitung 0,
 * satunya sama sekali tidak dihitung) — tanpa tanda "-" ini tidak mungkin
 * dibedakan dari CSV-nya saja. Kolom atestasi tidak punya masalah yang
 * sama (nilaiAtestasi() selalu mengembalikan tingkat konkret, "belum"
 * bukan "tidak ada data"), tapi diberi tanda "-" yang sama untuk modul di
 * luar snapshot supaya konsisten dengan kolom evaluasi.
 */
export function susunBarisRekap(
  kegiatan: RekapKegiatanInfo,
  daftarPeserta: RekapPesertaBaris[]
): SelRekap[][] {
  const modulEvaluasi = kegiatan.modul
    .filter((m) => m.kategori === "evaluasi")
    .sort((a, b) => a.urutan - b.urutan);
  const modulAtestasi = kegiatan.modul
    .filter((m) => m.kategori === "atestasi")
    .sort((a, b) => a.urutan - b.urutan);

  const header: SelRekap[] = [
    "No.",
    "Nama",
    "Email",
    "Institusi",
    "Nomor Identitas",
    "No. Telepon",
    "Sumber Identitas",
    "Sumber Pendaftaran",
    "Status Pendaftaran",
    "Nilai Akhir",
    ...modulEvaluasi.flatMap((m) => [
      `Skor: ${m.judul}`,
      `Lulus: ${m.judul}`,
      `Kedaluwarsa: ${m.judul}`,
    ]),
    ...modulAtestasi.map((m) => `Atestasi: ${m.judul}`),
    "Referensi Dibuka",
    "Hasil Kelayakan",
    "Status Prasyarat Materi",
    "Serial Sertifikat",
    "Jenis Sertifikat",
    "Status Sertifikat",
    "Tanggal Terbit",
    "Kode Verifikasi",
  ];

  const baris: SelRekap[][] = daftarPeserta.map((peserta) => {
    const modulEvaluasiSnapshot = new Set(peserta.modulEvaluasiDiSnapshot);
    const kolomEvaluasi = modulEvaluasi.flatMap((m) => {
      const hasil = peserta.hasilEvaluasi[m.id];
      if (hasil) {
        return [
          hasil.skor,
          hasil.lulus ? "Ya" : "Tidak",
          // Slice "ujian-berwaktu" — SENGAJA cuma "Ya"/kosong, bukan
          // "Ya"/"Tidak": kolom "Tidak ada" untuk modul yang tidak pernah
          // kedaluwarsa akan penuh kata "Tidak" di semua baris dan
          // menenggelamkan yang benar-benar perlu perhatian admin.
          hasil.kedaluwarsa ? "Ya" : "",
        ];
      }
      return modulEvaluasiSnapshot.has(m.id) ? [undefined, undefined, undefined] : ["-", "-", "-"];
    });
    const kolomAtestasi = modulAtestasi.map((m) => {
      const tingkat = peserta.hasilAtestasi[m.id];
      return tingkat ? LABEL_TINGKAT_ATESTASI[tingkat] : "-";
    });

    return [
      peserta.nomorUrut,
      peserta.namaLengkap,
      peserta.email,
      peserta.institusi,
      peserta.nomorIdentitas,
      peserta.noTelepon,
      peserta.identitasDariProfil ? LABEL_SUMBER_IDENTITAS.profil : LABEL_SUMBER_IDENTITAS.beku,
      LABEL_SUMBER_PENDAFTARAN[peserta.sumber],
      LABEL_STATUS_PENDAFTARAN[peserta.status],
      peserta.nilaiAkhir,
      ...kolomEvaluasi,
      ...kolomAtestasi,
      peserta.jumlahReferensiDibuka,
      LABEL_STATUS_KELAYAKAN[peserta.statusKelayakan],
      LABEL_STATUS_PRASYARAT[peserta.statusPrasyaratMateri],
      peserta.sertifikat?.serial,
      peserta.sertifikat ? LABEL_JENIS_SERTIFIKAT[peserta.sertifikat.jenis] : undefined,
      peserta.sertifikat ? LABEL_STATUS_SERTIFIKAT[peserta.sertifikat.status] : undefined,
      peserta.sertifikat?.terbitPada,
      // Ada untuk status apa pun (berlaku MAUPUN dicabut) — sertifikat yang
      // dicabut tetap punya kode, kolom "Status Sertifikat" di sebelahnya
      // sudah membedakan mana yang masih berlaku (Slice 9.3b §2b).
      peserta.sertifikat?.kodeVerifikasi,
    ];
  });

  return [header, ...baris];
}

function escapeSel(sel: SelRekap, pemisah: string): string {
  const teks = sel === undefined || sel === null ? "" : String(sel);
  const perluDikutip = teks.includes(pemisah) || teks.includes('"') || teks.includes("\n") || teks.includes("\r");
  if (!perluDikutip) {
    return teks;
  }
  return `"${teks.replace(/"/g, '""')}"`;
}

/**
 * Fungsi murni. Aturan pengutipan CSV standar (RFC 4180): sel dibungkus
 * kutip ganda kalau mengandung pemisah, kutip ganda, atau baris baru;
 * kutip ganda di dalamnya digandakan. 0 dan string kosong TETAP dicetak
 * apa adanya ("0", ""), bukan diperlakukan sebagai "tidak ada nilai" —
 * cuma undefined/null yang jadi sel kosong. Baris dipisah CRLF (\r\n),
 * standar CSV/Excel. TIDAK menambahkan BOM — itu urusan pemanggil
 * (Route Handler) saat membangun isi berkas akhir, supaya fungsi ini
 * tetap murni teks CSV yang mudah dites tanpa awalan tak terlihat.
 */
export function keCsv(baris: SelRekap[][], pemisah: ";" | "," = ";"): string {
  return baris.map((row) => row.map((sel) => escapeSel(sel, pemisah)).join(pemisah)).join("\r\n");
}
