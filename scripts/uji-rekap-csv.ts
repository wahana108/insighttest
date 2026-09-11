/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji keCsv() dan susunBarisRekap() (src/lib/rekap-csv.ts) sebagai
 * fungsi murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-rekap-csv.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { keCsv, susunBarisRekap, type RekapKegiatanInfo, type RekapPesertaBaris } from "../src/lib/rekap-csv";

let lulus = 0;
let gagal = 0;

function uji(nama: string, fn: () => void): void {
  try {
    fn();
    lulus += 1;
    console.log(`OK    ${nama}`);
  } catch (err) {
    gagal += 1;
    console.error(`GAGAL ${nama}`);
    console.error(`      ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------
// keCsv() — di sinilah bug bersembunyi.
// ---------------------------------------------------------------------

uji("keCsv: nilai yang mengandung pemisah itu sendiri dibungkus kutip", () => {
  const hasil = keCsv([["a;b", "c"]], ";");
  assert.equal(hasil, '"a;b";c');
});

uji("keCsv: nilai yang mengandung tanda kutip ganda dibungkus dan digandakan", () => {
  const hasil = keCsv([['bilang "halo"']], ";");
  assert.equal(hasil, '"bilang ""halo"""');
});

uji("keCsv: nilai yang mengandung baris baru dibungkus kutip", () => {
  const hasil = keCsv([["baris satu\nbaris dua"]], ";");
  assert.equal(hasil, '"baris satu\nbaris dua"');
});

uji("keCsv: nilai kosong (string \"\") tetap sel kosong, tidak dibungkus kutip", () => {
  const hasil = keCsv([["", "a"]], ";");
  assert.equal(hasil, ";a");
});

uji("keCsv: undefined dan null jadi sel kosong, BUKAN teks \"undefined\"/\"null\"", () => {
  const hasil = keCsv([[undefined, null, "a"]], ";");
  assert.equal(hasil, ";;a");
});

uji("keCsv: angka nol TETAP tercetak \"0\", bukan sel kosong", () => {
  const hasil = keCsv([[0, "a"]], ";");
  assert.equal(hasil, "0;a");
});

uji("keCsv: angka nol di antara undefined tetap jelas mana yang 0 dan mana yang kosong", () => {
  const hasil = keCsv([[0, undefined, 0]], ";");
  assert.equal(hasil, "0;;0");
});

uji("keCsv: pemisah koma sebagai alternatif", () => {
  const hasil = keCsv([["a", "b,c"]], ",");
  assert.equal(hasil, 'a,"b,c"');
});

uji("keCsv: dengan pemisah koma, titik koma dalam nilai TIDAK perlu dikutip", () => {
  const hasil = keCsv([["a;b", "c"]], ",");
  assert.equal(hasil, "a;b,c");
});

uji("keCsv: banyak baris dipisah CRLF", () => {
  const hasil = keCsv([["a", "b"], ["c", "d"]], ";");
  assert.equal(hasil, "a;b\r\nc;d");
});

uji("keCsv: gabungan kutip DAN pemisah dalam satu sel", () => {
  const hasil = keCsv([['dia bilang "aman;aman"']], ";");
  assert.equal(hasil, '"dia bilang ""aman;aman"""');
});

// ---------------------------------------------------------------------
// susunBarisRekap()
// ---------------------------------------------------------------------

const KEGIATAN: RekapKegiatanInfo = {
  judul: "Diklat Contoh",
  modul: [
    { id: "eval-1", judul: "Evaluasi Satu", kategori: "evaluasi", urutan: 1 },
    { id: "eval-2", judul: "Evaluasi Dua", kategori: "evaluasi", urutan: 2 },
    { id: "at-1", judul: "Atestasi Satu", kategori: "atestasi", urutan: 3 },
  ],
};

function pesertaDasar(override: Partial<RekapPesertaBaris>): RekapPesertaBaris {
  return {
    nomorUrut: 1,
    namaLengkap: "Nama",
    email: "nama@contoh.com",
    institusi: "",
    nomorIdentitas: "",
    noTelepon: "",
    identitasDariProfil: false,
    sumber: "mandiri",
    status: "terdaftar",
    nilaiAkhir: 0,
    // Bawaan: kedua modul evaluasi SUDAH ada di snapshot peserta ini —
    // kasus "modul belum ada saat mendaftar" diuji terpisah lewat override
    // eksplisit yang mengecilkan daftar ini.
    modulEvaluasiDiSnapshot: ["eval-1", "eval-2"],
    hasilEvaluasi: {},
    hasilAtestasi: {},
    jumlahReferensiDibuka: 0,
    statusKelayakan: "belum_layak",
    statusPrasyaratMateri: "tuntas",
    sertifikat: null,
    ...override,
  };
}

uji("susunBarisRekap: header memuat satu pasang kolom per modul evaluasi dan satu kolom per modul atestasi", () => {
  const [header] = susunBarisRekap(KEGIATAN, []);
  assert.deepEqual(header, [
    "No.", "Nama", "Email", "Institusi", "Nomor Identitas", "No. Telepon", "Sumber Identitas",
    "Sumber Pendaftaran", "Status Pendaftaran", "Nilai Akhir",
    "Skor: Evaluasi Satu", "Lulus: Evaluasi Satu",
    "Skor: Evaluasi Dua", "Lulus: Evaluasi Dua",
    "Atestasi: Atestasi Satu",
    "Referensi Dibuka", "Hasil Kelayakan", "Status Prasyarat Materi",
    "Serial Sertifikat", "Jenis Sertifikat", "Status Sertifikat", "Tanggal Terbit", "Kode Verifikasi",
  ]);
});

// Slice 8.3a: tiga keadaan berbeda untuk kolom skor/lulus per modul
// evaluasi — HARUS bisa dibedakan dari CSV-nya saja, tanpa membuka
// pendaftaran mentahnya. Indeks kolom: 8 = Skor eval-1, 9 = Lulus eval-1,
// 10 = Skor eval-2, 11 = Lulus eval-2 (setelah 8 kolom tetap di depan).
const IDX_SKOR_EVAL_1 = 10;
const IDX_LULUS_EVAL_1 = 11;
const IDX_SKOR_EVAL_2 = 12;
const IDX_LULUS_EVAL_2 = 13;

uji("susunBarisRekap: modul TIDAK ADA di modulSnapshot peserta -> sel \"-\" (bukan kosong, bukan 0)", () => {
  const peserta = pesertaDasar({
    // eval-2 belum ada saat peserta ini mendaftar.
    modulEvaluasiDiSnapshot: ["eval-1"],
    hasilEvaluasi: { "eval-1": { skor: 100, lulus: true } },
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.equal(baris[IDX_SKOR_EVAL_2], "-", "eval-2 tidak ada di snapshot -> harus \"-\"");
  assert.equal(baris[IDX_LULUS_EVAL_2], "-", "kolom lulus eval-2 juga harus \"-\"");
});

uji("susunBarisRekap: modul ADA di snapshot tapi belum dikerjakan -> sel KOSONG (undefined)", () => {
  const peserta = pesertaDasar({
    // Kedua modul ada di snapshot (bawaan pesertaDasar), tapi eval-2 belum disentuh sama sekali.
    hasilEvaluasi: { "eval-1": { skor: 100, lulus: true } },
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.equal(baris[IDX_SKOR_EVAL_2], undefined, "eval-2 ada di snapshot tapi belum dikerjakan -> harus kosong");
  assert.equal(baris[IDX_LULUS_EVAL_2], undefined, "kolom lulus eval-2 juga harus kosong");
});

uji("susunBarisRekap: modul dikerjakan dengan skor 0 -> sel \"0\", beda dari kosong dan beda dari \"-\"", () => {
  const peserta = pesertaDasar({
    hasilEvaluasi: { "eval-1": { skor: 0, lulus: false } },
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.equal(baris[IDX_SKOR_EVAL_1], 0, "skor 0 sungguhan -> harus 0, bukan kosong ataupun \"-\"");
  assert.equal(baris[IDX_LULUS_EVAL_1], "Tidak");
});

uji("susunBarisRekap: ketiga keadaan sekaligus pada satu peserta harus berbeda satu sama lain", () => {
  const peserta = pesertaDasar({
    modulEvaluasiDiSnapshot: ["eval-1"], // eval-2 TIDAK ada di snapshot sama sekali
    hasilEvaluasi: { "eval-1": { skor: 0, lulus: false } }, // eval-1 dikerjakan, skor 0
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.equal(baris[IDX_SKOR_EVAL_1], 0);
  assert.equal(baris[IDX_SKOR_EVAL_2], "-");
  assert.notEqual(baris[IDX_SKOR_EVAL_1], baris[IDX_SKOR_EVAL_2]);
});

uji("susunBarisRekap: kolom atestasi untuk modul di luar snapshot -> \"-\"; di dalam snapshot -> label tingkat (bukan kosong)", () => {
  const kegiatanDenganAtestasi: RekapKegiatanInfo = {
    judul: "Diklat Contoh",
    modul: [{ id: "at-1", judul: "Atestasi Satu", kategori: "atestasi", urutan: 1 }],
  };
  const pesertaTanpaAtestasi = pesertaDasar({ hasilAtestasi: {} });
  const pesertaBelumTuntasAtestasi = pesertaDasar({ hasilAtestasi: { "at-1": "belum" } });

  const [, barisTanpa] = susunBarisRekap(kegiatanDenganAtestasi, [pesertaTanpaAtestasi]);
  const [, barisBelum] = susunBarisRekap(kegiatanDenganAtestasi, [pesertaBelumTuntasAtestasi]);
  const idxAtestasi = 10; // setelah 10 kolom tetap, kegiatan ini tidak punya modul evaluasi
  assert.equal(barisTanpa[idxAtestasi], "-", "at-1 tidak ada di snapshot peserta -> \"-\"");
  assert.equal(
    barisBelum[idxAtestasi],
    "Belum menuntaskan",
    "at-1 ada di snapshot tapi belum tuntas -> label \"belum\", BUKAN kosong ataupun \"-\""
  );
});

uji("susunBarisRekap: peserta tanpa sertifikat -> lima kolom sertifikat (termasuk Jenis dan Kode Verifikasi) kosong", () => {
  const peserta = pesertaDasar({});
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.deepEqual(baris.slice(-5), [undefined, undefined, undefined, undefined, undefined]);
});

uji("susunBarisRekap: peserta dengan sertifikat berlaku (kelulusan) -> Kode Verifikasi dan Jenis ikut terisi", () => {
  const peserta = pesertaDasar({
    sertifikat: {
      serial: "KEG-1/2026/0001",
      status: "berlaku",
      terbitPada: "2026-09-01T00:00:00.000Z",
      kodeVerifikasi: "U6SK21JGWN",
      jenis: "kelulusan",
    },
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.deepEqual(baris.slice(-5), [
    "KEG-1/2026/0001",
    "Kelulusan",
    "Berlaku",
    "2026-09-01T00:00:00.000Z",
    "U6SK21JGWN",
  ]);
});

uji("susunBarisRekap: sertifikat keikutsertaan -> kolom Jenis Sertifikat menyebut \"Keikutsertaan\"", () => {
  const peserta = pesertaDasar({
    sertifikat: {
      serial: "KEG-1/2026/0003",
      status: "berlaku",
      terbitPada: "2026-09-01T00:00:00.000Z",
      kodeVerifikasi: "KEIKUT12345",
      jenis: "keikutsertaan",
    },
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  const idxJenis = baris.length - 4;
  assert.equal(baris[idxJenis], "Keikutsertaan");
});

uji("susunBarisRekap: sertifikat DICABUT tetap punya kode verifikasi di CSV (Slice 9.3b §2b)", () => {
  const peserta = pesertaDasar({
    sertifikat: {
      serial: "KEG-1/2026/0002",
      status: "dicabut",
      terbitPada: "2026-09-01T00:00:00.000Z",
      kodeVerifikasi: "ABCDE12345",
      jenis: "kelulusan",
    },
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  const idxKode = baris.length - 1;
  assert.equal(
    baris[idxKode],
    "ABCDE12345",
    "Kode verifikasi HARUS tetap terekspor untuk sertifikat dicabut — hanya belum-terbit yang kosong"
  );
  assert.equal(baris[idxKode - 2], "Dicabut", "kolom Status Sertifikat harus tetap menandai dicabut");
});

// ---------------------------------------------------------------------
// Slice 6.1a: kolom "Sumber Identitas" — nomorIdentitas/noTelepon dibekukan
// saat mendaftar; pendaftaran dari SEBELUM slice ini tidak punya field itu
// sama sekali dan jatuh ke fallback profil (KA-5/KA-6, pelajaran sel
// berbohong Slice 8.3a: fallback itu HARUS ditandai, tidak diam-diam).
// ---------------------------------------------------------------------
const IDX_NOMOR_IDENTITAS = 4;
const IDX_NO_TELEPON = 5;
const IDX_SUMBER_IDENTITAS = 6;

uji("susunBarisRekap: pendaftaran dengan field beku (identitasDariProfil=false) -> \"Dibekukan saat mendaftar\"", () => {
  const peserta = pesertaDasar({
    nomorIdentitas: "3201xxxx0001",
    noTelepon: "0812xxxx0001",
    identitasDariProfil: false,
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.equal(baris[IDX_NOMOR_IDENTITAS], "3201xxxx0001");
  assert.equal(baris[IDX_NO_TELEPON], "0812xxxx0001");
  assert.equal(baris[IDX_SUMBER_IDENTITAS], "Dibekukan saat mendaftar");
});

uji("susunBarisRekap: pendaftaran lama tanpa field beku (identitasDariProfil=true) -> \"Profil saat ini (belum dibekukan)\"", () => {
  const peserta = pesertaDasar({
    // Nilai yang tetap terisi di sini MENIRU fallback yang sudah dibaca
    // Route Handler dari users/{uid} — susunBarisRekap() sendiri tidak
    // pernah membaca Firestore, ia cuma menampilkan apa yang dioper.
    nomorIdentitas: "3201yyyy0002",
    noTelepon: "0812yyyy0002",
    identitasDariProfil: true,
  });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.equal(baris[IDX_NOMOR_IDENTITAS], "3201yyyy0002");
  assert.equal(baris[IDX_NO_TELEPON], "0812yyyy0002");
  assert.equal(baris[IDX_SUMBER_IDENTITAS], "Profil saat ini (belum dibekukan)");
});

uji("susunBarisRekap: campuran pendaftaran beku dan lama dalam SATU kegiatan -> tiap baris menandai sumbernya sendiri", () => {
  const pesertaBeku = pesertaDasar({
    namaLengkap: "Peserta Baru",
    nomorIdentitas: "111",
    noTelepon: "222",
    identitasDariProfil: false,
  });
  const pesertaLama = pesertaDasar({
    namaLengkap: "Peserta Lama",
    nomorIdentitas: "333",
    noTelepon: "444",
    identitasDariProfil: true,
  });
  const [, barisBeku, barisLama] = susunBarisRekap(KEGIATAN, [pesertaBeku, pesertaLama]);
  assert.equal(barisBeku[IDX_SUMBER_IDENTITAS], "Dibekukan saat mendaftar");
  assert.equal(barisLama[IDX_SUMBER_IDENTITAS], "Profil saat ini (belum dibekukan)");
  assert.notEqual(
    barisBeku[IDX_SUMBER_IDENTITAS],
    barisLama[IDX_SUMBER_IDENTITAS],
    "dua peserta dalam kegiatan yang sama harus bisa punya sumber identitas berbeda"
  );
});

// ---------------------------------------------------------------------
// Slice 6.2: kolom "Sumber Pendaftaran" — penting untuk 6.3 (peserta yang
// diimpor karena hadir belum tentu mengerjakan evaluasi).
// ---------------------------------------------------------------------
const IDX_SUMBER_PENDAFTARAN = 7;

uji("susunBarisRekap: sumber 'mandiri' -> \"Mandiri\"", () => {
  const peserta = pesertaDasar({ sumber: "mandiri" });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.equal(baris[IDX_SUMBER_PENDAFTARAN], "Mandiri");
});

uji("susunBarisRekap: sumber 'impor' -> \"Impor daftar hadir\"", () => {
  const peserta = pesertaDasar({ sumber: "impor" });
  const [, baris] = susunBarisRekap(KEGIATAN, [peserta]);
  assert.equal(baris[IDX_SUMBER_PENDAFTARAN], "Impor daftar hadir");
});

uji("susunBarisRekap: campuran mandiri dan impor dalam satu kegiatan -> tiap baris menandai sumbernya sendiri", () => {
  const pesertaMandiri = pesertaDasar({ namaLengkap: "A", sumber: "mandiri" });
  const pesertaImpor = pesertaDasar({ namaLengkap: "B", sumber: "impor" });
  const [, barisMandiri, barisImpor] = susunBarisRekap(KEGIATAN, [pesertaMandiri, pesertaImpor]);
  assert.equal(barisMandiri[IDX_SUMBER_PENDAFTARAN], "Mandiri");
  assert.equal(barisImpor[IDX_SUMBER_PENDAFTARAN], "Impor daftar hadir");
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
