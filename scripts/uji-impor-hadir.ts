/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji uraiDaftarHadir() dan tandaiBarisImpor()
 * (src/lib/services/impor-hadir.ts) sebagai fungsi murni. Pakai
 * node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-impor-hadir.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import {
  contohBarisImporCsv,
  gabungkanIdentitas,
  headerTemplatImporCsv,
  kolomTambahanUntukFormulir,
  sepertiPemisahSpasi,
  tandaiBarisImpor,
  uraiDaftarHadir,
  type BarisMentahImpor,
  type ProfilTersimpanRingkas,
} from "../src/lib/services/impor-hadir";
import type { FormulirPeserta } from "../src/types/kegiatan";

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

const TIDAK_SEMUA: FormulirPeserta = { institusi: "tidak", nomorIdentitas: "tidak", noTelepon: "tidak" };

function baris(email: string, namaLengkap: string, extra: Partial<BarisMentahImpor> = {}): BarisMentahImpor {
  return {
    baris: 0,
    email,
    namaLengkap,
    institusi: "",
    nomorIdentitas: "",
    noTelepon: "",
    // Bawaan meniru baris "email,nama" polos (2 sel) — kasus yang secara
    // eksplisit menguji beda "kolom tidak ada" vs "kolom ada tapi kosong"
    // (jumlahSel) meng-override ini sendiri.
    jumlahSel: 2,
    ...extra,
  };
}

// ---------------------------------------------------------------------
// kolomTambahanUntukFormulir()
// ---------------------------------------------------------------------

uji("kolomTambahanUntukFormulir: ketiganya 'tidak' -> tidak ada kolom tambahan", () => {
  assert.deepEqual(kolomTambahanUntukFormulir(TIDAK_SEMUA), []);
});

uji("kolomTambahanUntukFormulir: institusi wajib, sisanya tidak -> hanya institusi", () => {
  assert.deepEqual(
    kolomTambahanUntukFormulir({ ...TIDAK_SEMUA, institusi: "wajib" }),
    ["institusi"]
  );
});

uji("kolomTambahanUntukFormulir: institusi tidak, nomorIdentitas opsional, noTelepon wajib -> urutan tetap", () => {
  assert.deepEqual(
    kolomTambahanUntukFormulir({ institusi: "tidak", nomorIdentitas: "opsional", noTelepon: "wajib" }),
    ["nomorIdentitas", "noTelepon"]
  );
});

// ---------------------------------------------------------------------
// uraiDaftarHadir() — pemisah, judul kolom, spasi berlebih, tempelan kosong
// ---------------------------------------------------------------------

uji("uraiDaftarHadir: tempelan kosong -> array kosong, tidak melempar", () => {
  assert.doesNotThrow(() => uraiDaftarHadir("", []));
  assert.deepEqual(uraiDaftarHadir("", []), []);
});

uji("uraiDaftarHadir: tempelan hanya baris kosong/spasi -> array kosong", () => {
  assert.deepEqual(uraiDaftarHadir("\n\n   \n\t\n", []), []);
});

uji("uraiDaftarHadir: pemisah TAB terdeteksi otomatis", () => {
  const hasil = uraiDaftarHadir("budi@contoh.com\tBudi Santoso", []);
  assert.deepEqual(hasil, [
    {
      baris: 1,
      email: "budi@contoh.com",
      namaLengkap: "Budi Santoso",
      institusi: "",
      nomorIdentitas: "",
      noTelepon: "",
      jumlahSel: 2,
    },
  ]);
});

uji("uraiDaftarHadir: pemisah KOMA terdeteksi otomatis (tanpa tab di baris manapun)", () => {
  const hasil = uraiDaftarHadir("budi@contoh.com,Budi Santoso", []);
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].email, "budi@contoh.com");
  assert.equal(hasil[0].namaLengkap, "Budi Santoso");
});

uji("uraiDaftarHadir: baris judul kolom (\"email\", tidak peduli besar-kecil) dikenali dan dilewati", () => {
  const hasil = uraiDaftarHadir("Email\tNama Lengkap\nbudi@contoh.com\tBudi Santoso", []);
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].baris, 1, "baris data pertama bernomor 1, judul kolom tidak dihitung");
  assert.equal(hasil[0].email, "budi@contoh.com");
});

uji("uraiDaftarHadir: TANPA baris judul kolom -> baris pertama tetap dianggap data", () => {
  const hasil = uraiDaftarHadir("budi@contoh.com\tBudi Santoso\nsiti@contoh.com\tSiti Aminah", []);
  assert.equal(hasil.length, 2);
  assert.equal(hasil[0].email, "budi@contoh.com");
});

uji("uraiDaftarHadir: spasi berlebih di sekitar sel ditrim", () => {
  const hasil = uraiDaftarHadir("  budi@contoh.com  \t  Budi Santoso  ", []);
  assert.equal(hasil[0].email, "budi@contoh.com");
  assert.equal(hasil[0].namaLengkap, "Budi Santoso");
});

uji("uraiDaftarHadir: kolom tambahan dibaca sesuai urutan yang diminta", () => {
  const hasil = uraiDaftarHadir(
    "budi@contoh.com\tBudi Santoso\tDinas A\t12345",
    ["institusi", "nomorIdentitas"]
  );
  assert.equal(hasil[0].institusi, "Dinas A");
  assert.equal(hasil[0].nomorIdentitas, "12345");
  assert.equal(hasil[0].noTelepon, "", "noTelepon tidak diminta -> tetap kosong walau ada sel lain");
});

uji("uraiDaftarHadir: kolom tambahan yang diminta tapi selnya tidak ada di baris -> string kosong, tidak melempar", () => {
  const hasil = uraiDaftarHadir("budi@contoh.com\tBudi Santoso", ["institusi", "nomorIdentitas"]);
  assert.equal(hasil[0].institusi, "");
  assert.equal(hasil[0].nomorIdentitas, "");
});

uji("uraiDaftarHadir: banyak baris, penomoran baris berurutan dari 1", () => {
  const hasil = uraiDaftarHadir(
    "a@contoh.com\tA\nb@contoh.com\tB\nc@contoh.com\tC",
    []
  );
  assert.deepEqual(hasil.map((h) => h.baris), [1, 2, 3]);
});

// ---------------------------------------------------------------------
// Slice 6.2a — CACAT 1: TIDAK ADA tempelan yang boleh melempar galat.
// ---------------------------------------------------------------------

uji("uraiDaftarHadir: baris hanya berisi spasi/tab di antara baris sah -> dilewati, TIDAK jadi baris kosong", () => {
  const hasil = uraiDaftarHadir("budi@contoh.com\tBudi\n\t\t\t\nsiti@contoh.com\tSiti", []);
  assert.equal(hasil.length, 2, "baris spasi/tab murni tidak menghasilkan baris data");
  assert.equal(hasil[0].email, "budi@contoh.com");
  assert.equal(hasil[1].email, "siti@contoh.com");
});

uji("uraiDaftarHadir: baris dengan kolom LEBIH BANYAK dari yang diminta -> kelebihan diabaikan, tidak melempar", () => {
  assert.doesNotThrow(() => uraiDaftarHadir("a@b.com,Nama,Inst,Ekstra1,Ekstra2,Ekstra3", ["institusi"]));
  const hasil = uraiDaftarHadir("a@b.com,Nama,Inst,Ekstra1,Ekstra2,Ekstra3", ["institusi"]);
  assert.equal(hasil[0].institusi, "Inst");
  assert.equal(hasil[0].jumlahSel, 6);
});

uji("uraiDaftarHadir: baris dengan kolom LEBIH SEDIKIT dari yang diminta -> sisanya kosong, tidak melempar", () => {
  assert.doesNotThrow(() => uraiDaftarHadir("a@b.com,Nama", ["institusi", "nomorIdentitas", "noTelepon"]));
  const hasil = uraiDaftarHadir("a@b.com,Nama", ["institusi", "nomorIdentitas", "noTelepon"]);
  assert.equal(hasil[0].institusi, "");
  assert.equal(hasil[0].nomorIdentitas, "");
  assert.equal(hasil[0].noTelepon, "");
  assert.equal(hasil[0].jumlahSel, 2);
});

uji("uraiDaftarHadir: tempelan berisi HANYA baris judul -> array kosong, tidak melempar", () => {
  assert.doesNotThrow(() => uraiDaftarHadir("email,nama lengkap", []));
  assert.deepEqual(uraiDaftarHadir("email,nama lengkap", []), []);
});

uji("uraiDaftarHadir: tempelan berisi SATU KARAKTER -> satu baris, tidak melempar", () => {
  assert.doesNotThrow(() => uraiDaftarHadir("a", []));
  const hasil = uraiDaftarHadir("a", []);
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].email, "a");
  assert.equal(hasil[0].namaLengkap, "");
});

uji("tandaiBarisImpor: baris satu karakter (dari uraiDaftarHadir) -> baris_tidak_sah, TIDAK melempar", () => {
  const barisMentah = uraiDaftarHadir("a", []);
  assert.doesNotThrow(() => tandaiBarisImpor(barisMentah, TIDAK_SEMUA, new Map(), new Set()));
  const hasil = tandaiBarisImpor(barisMentah, TIDAK_SEMUA, new Map(), new Set());
  assert.equal(hasil[0].status, "baris_tidak_sah");
});

uji("tandaiBarisImpor: tempelan berantakan (kolom tidak sejajar, kolom kurang) -> SEMUA baris tetap dapat salah satu dari enam status, tidak melempar", () => {
  const kolomTambahan: ("institusi" | "nomorIdentitas" | "noTelepon")[] = ["institusi"];
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  const teksBerantakan = [
    "tanpa-kolom-sama-sekali",
    "a@b.com",
    ",,,,,,",
    "a@b.com,Nama,Inst,Ekstra,Ekstra2",
    "€™§±@@@,,,",
  ].join("\n");
  const barisMentah = uraiDaftarHadir(teksBerantakan, kolomTambahan);
  assert.doesNotThrow(() => tandaiBarisImpor(barisMentah, formulir, new Map(), new Set()));
  const hasil = tandaiBarisImpor(barisMentah, formulir, new Map(), new Set());
  assert.equal(hasil.length, barisMentah.length);
  const STATUS_SAH: string[] = [
    "akan_dibuatkan_akun",
    "akun_sudah_ada",
    "sudah_terdaftar",
    "duplikat_dalam_tempelan",
    "baris_tidak_sah",
    "data_wajib_kurang",
  ];
  for (const baris of hasil) {
    assert.ok(STATUS_SAH.includes(baris.status), `status "${baris.status}" tidak dikenal`);
  }
});

// ---------------------------------------------------------------------
// Slice 6.2a — CACAT 2e: pesan "data wajib kurang" membedakan kolom TIDAK
// ADA dari kolom ADA TAPI KOSONG.
// ---------------------------------------------------------------------

uji("tandaiBarisImpor: data wajib kurang, kolom TIDAK ADA di baris (jumlahSel pendek) -> pesan menyebut 'TIDAK ADA'", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  // jumlahSel: 2 (bawaan baris()) -> posisi institusi (2+0=2) TIDAK tercapai.
  const hasil = tandaiBarisImpor(
    [baris("baru@contoh.com", "Peserta Baru")],
    formulir,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "data_wajib_kurang");
  assert.match(hasil[0].pesan[0], /TIDAK ADA/);
});

uji("tandaiBarisImpor: data wajib kurang, kolom ADA tapi selnya KOSONG -> pesan menyebut 'ADA...tapi KOSONG'", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  // jumlahSel: 3 -> posisi institusi (2) TERCAPAI, tapi nilainya tetap "".
  const hasil = tandaiBarisImpor(
    [baris("baru@contoh.com", "Peserta Baru", { jumlahSel: 3 })],
    formulir,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "data_wajib_kurang");
  assert.match(hasil[0].pesan[0], /ADA.*tapi KOSONG/);
});

// ---------------------------------------------------------------------
// Slice 6.2a — CACAT 2c: deteksi pemisah spasi yang salah.
// ---------------------------------------------------------------------

uji("sepertiPemisahSpasi: seluruh baris hanya email terisi DAN email mengandung spasi -> true", () => {
  const barisMentah = uraiDaftarHadir(
    "budi@contoh.com Budi Santoso Dinas ABC\nsiti@contoh.com Siti Aminah Dinas XYZ",
    []
  );
  assert.equal(sepertiPemisahSpasi(barisMentah), true);
});

uji("sepertiPemisahSpasi: tempelan normal (TAB, kolom terisi benar) -> false", () => {
  const barisMentah = uraiDaftarHadir("budi@contoh.com\tBudi Santoso", []);
  assert.equal(sepertiPemisahSpasi(barisMentah), false);
});

uji("sepertiPemisahSpasi: email tanpa spasi tapi nama kosong (baris_tidak_sah biasa) -> false, bukan soal pemisah", () => {
  const barisMentah = uraiDaftarHadir("budi@contoh.com", []);
  assert.equal(sepertiPemisahSpasi(barisMentah), false);
});

uji("sepertiPemisahSpasi: tempelan kosong -> false", () => {
  assert.equal(sepertiPemisahSpasi([]), false);
});

uji("sepertiPemisahSpasi: campuran (sebagian baris normal) -> false, harus SELURUH baris", () => {
  // Pemisah dideteksi SEKALI dari baris pertama (tidak ada tab -> koma)
  // dan berlaku untuk semua baris — baris kedua sengaja ditulis dalam
  // bentuk koma yang sama supaya benar-benar terurai normal (bukan
  // kebetulan ikut rusak karena pemisah globalnya salah untuknya juga).
  const barisMentah = uraiDaftarHadir(
    "budi@contoh.com Budi Santoso\nsiti@contoh.com,Siti Aminah",
    []
  );
  assert.equal(barisMentah[1].namaLengkap, "Siti Aminah", "baris kedua harus terurai normal");
  assert.equal(sepertiPemisahSpasi(barisMentah), false);
});

// ---------------------------------------------------------------------
// Slice 6.2a — CACAT 2a/2d: templat CSV dan contoh baris.
// ---------------------------------------------------------------------

uji("headerTemplatImporCsv: ketiganya 'tidak' -> hanya email + nama lengkap", () => {
  assert.deepEqual(headerTemplatImporCsv(TIDAK_SEMUA), ["email", "nama lengkap"]);
});

uji("headerTemplatImporCsv: field wajib ditandai '(wajib)', field opsional tidak", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "opsional", noTelepon: "tidak" };
  assert.deepEqual(headerTemplatImporCsv(formulir), [
    "email",
    "nama lengkap",
    "Institusi / asal (wajib)",
    "Nomor identitas",
  ]);
});

uji("contohBarisImporCsv: kolom tambahan menyesuaikan formulirPeserta, bentuk koma", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  const contoh = contohBarisImporCsv(formulir);
  assert.equal(contoh.split(",").length, 3, "email, nama, institusi -> 3 kolom");
  assert.ok(contoh.startsWith("budi@contoh.com,Budi Santoso,"));
});

uji("contohBarisImporCsv: hasilnya sendiri bisa diuraikan ulang tanpa galat dan tanpa data_wajib_kurang", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "wajib", noTelepon: "wajib" };
  const contoh = contohBarisImporCsv(formulir);
  const barisMentah = uraiDaftarHadir(contoh, kolomTambahanUntukFormulir(formulir));
  const hasil = tandaiBarisImpor(barisMentah, formulir, new Map(), new Set());
  assert.equal(hasil[0].status, "akan_dibuatkan_akun");
});

// ---------------------------------------------------------------------
// tandaiBarisImpor()
// ---------------------------------------------------------------------

uji("tandaiBarisImpor: baris sah, email belum punya akun -> akan_dibuatkan_akun, dieksekusi", () => {
  const hasil = tandaiBarisImpor(
    [baris("baru@contoh.com", "Peserta Baru")],
    TIDAK_SEMUA,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "akan_dibuatkan_akun");
  assert.equal(hasil[0].akanDieksekusi, true);
  assert.equal(hasil[0].uidSudahAda, null);
});

uji("tandaiBarisImpor: baris sah, email sudah punya akun (belum terdaftar di kegiatan ini) -> akun_sudah_ada, dieksekusi", () => {
  const profilByEmail = new Map<string, ProfilTersimpanRingkas>([
    ["ada@contoh.com", { uid: "uid-1", institusi: "", nomorIdentitas: "", noTelepon: "" }],
  ]);
  const hasil = tandaiBarisImpor(
    [baris("ada@contoh.com", "Peserta Lama")],
    TIDAK_SEMUA,
    profilByEmail,
    new Set()
  );
  assert.equal(hasil[0].status, "akun_sudah_ada");
  assert.equal(hasil[0].akanDieksekusi, true);
  assert.equal(hasil[0].uidSudahAda, "uid-1");
});

uji("tandaiBarisImpor: email salah format -> baris_tidak_sah, tidak dieksekusi", () => {
  const hasil = tandaiBarisImpor(
    [baris("bukan-email", "Nama Ada")],
    TIDAK_SEMUA,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "baris_tidak_sah");
  assert.equal(hasil[0].akanDieksekusi, false);
});

uji("tandaiBarisImpor: email kosong -> baris_tidak_sah", () => {
  const hasil = tandaiBarisImpor([baris("", "Nama Ada")], TIDAK_SEMUA, new Map(), new Set());
  assert.equal(hasil[0].status, "baris_tidak_sah");
});

uji("tandaiBarisImpor: nama kosong -> baris_tidak_sah, tidak dieksekusi", () => {
  const hasil = tandaiBarisImpor(
    [baris("ok@contoh.com", "")],
    TIDAK_SEMUA,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "baris_tidak_sah");
  assert.equal(hasil[0].akanDieksekusi, false);
  assert.ok(hasil[0].pesan.some((p) => p.toLowerCase().includes("nama")));
});

uji("tandaiBarisImpor: nama HANYA spasi -> tetap dianggap kosong (trim), baris_tidak_sah", () => {
  const hasil = tandaiBarisImpor([baris("ok@contoh.com", "   ")], TIDAK_SEMUA, new Map(), new Set());
  assert.equal(hasil[0].status, "baris_tidak_sah");
});

uji("tandaiBarisImpor: email DAN nama salah -> baris_tidak_sah dengan DUA pesan", () => {
  const hasil = tandaiBarisImpor([baris("salah", "")], TIDAK_SEMUA, new Map(), new Set());
  assert.equal(hasil[0].status, "baris_tidak_sah");
  assert.equal(hasil[0].pesan.length, 2);
});

uji("tandaiBarisImpor: duplikat dalam tempelan -> baris pertama normal, baris berikutnya duplikat_dalam_tempelan", () => {
  const hasil = tandaiBarisImpor(
    [
      baris("dobel@contoh.com", "Orang Pertama", { baris: 1 }),
      baris("dobel@contoh.com", "Orang Kedua", { baris: 2 }),
    ],
    TIDAK_SEMUA,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "akan_dibuatkan_akun");
  assert.equal(hasil[0].akanDieksekusi, true);
  assert.equal(hasil[1].status, "duplikat_dalam_tempelan");
  assert.equal(hasil[1].akanDieksekusi, false);
  assert.ok(hasil[1].pesan[0].includes("baris 1"));
});

uji("tandaiBarisImpor: duplikat TIDAK peka besar-kecil huruf email", () => {
  const hasil = tandaiBarisImpor(
    [baris("Dobel@Contoh.com", "A", { baris: 1 }), baris("dobel@contoh.com", "B", { baris: 2 })],
    TIDAK_SEMUA,
    new Map(),
    new Set()
  );
  assert.equal(hasil[1].status, "duplikat_dalam_tempelan");
});

uji("tandaiBarisImpor: sudah terdaftar di kegiatan ini -> sudah_terdaftar, tidak dieksekusi", () => {
  const profilByEmail = new Map<string, ProfilTersimpanRingkas>([
    ["sudah@contoh.com", { uid: "uid-2", institusi: "", nomorIdentitas: "", noTelepon: "" }],
  ]);
  const hasil = tandaiBarisImpor(
    [baris("sudah@contoh.com", "Sudah Terdaftar")],
    TIDAK_SEMUA,
    profilByEmail,
    new Set(["uid-2"])
  );
  assert.equal(hasil[0].status, "sudah_terdaftar");
  assert.equal(hasil[0].akanDieksekusi, false);
});

uji("tandaiBarisImpor: data wajib kurang — field wajib kosong di baris DAN tidak ada profil -> data_wajib_kurang, menyebut field", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  const hasil = tandaiBarisImpor(
    [baris("baru@contoh.com", "Peserta Baru")],
    formulir,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "data_wajib_kurang");
  assert.equal(hasil[0].akanDieksekusi, false);
  assert.ok(hasil[0].pesan[0].includes("Institusi"));
});

uji("tandaiBarisImpor: data wajib kurang di baris TAPI sudah ada di profil lama -> TIDAK data_wajib_kurang", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  const profilByEmail = new Map<string, ProfilTersimpanRingkas>([
    ["ada@contoh.com", { uid: "uid-3", institusi: "Dinas Lama", nomorIdentitas: "", noTelepon: "" }],
  ]);
  const hasil = tandaiBarisImpor(
    [baris("ada@contoh.com", "Peserta Lama")],
    formulir,
    profilByEmail,
    new Set()
  );
  assert.equal(hasil[0].status, "akun_sudah_ada");
});

uji("tandaiBarisImpor: field wajib TERISI di baris -> lolos meski profil tidak ada", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  const hasil = tandaiBarisImpor(
    [baris("baru@contoh.com", "Peserta Baru", { institusi: "Dinas Baru" })],
    formulir,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "akan_dibuatkan_akun");
});

uji("tandaiBarisImpor: field 'opsional' kosong -> TIDAK PERNAH data_wajib_kurang", () => {
  const formulir: FormulirPeserta = { institusi: "opsional", nomorIdentitas: "tidak", noTelepon: "tidak" };
  const hasil = tandaiBarisImpor(
    [baris("baru@contoh.com", "Peserta Baru")],
    formulir,
    new Map(),
    new Set()
  );
  assert.equal(hasil[0].status, "akan_dibuatkan_akun");
});

uji("tandaiBarisImpor: sudah_terdaftar TIDAK diperiksa data_wajib_kurang (tidak ada gunanya)", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  const profilByEmail = new Map<string, ProfilTersimpanRingkas>([
    ["sudah@contoh.com", { uid: "uid-4", institusi: "", nomorIdentitas: "", noTelepon: "" }],
  ]);
  const hasil = tandaiBarisImpor(
    [baris("sudah@contoh.com", "Sudah Terdaftar")], // institusi kosong di baris DAN profil
    formulir,
    profilByEmail,
    new Set(["uid-4"])
  );
  assert.equal(hasil[0].status, "sudah_terdaftar", "harus tetap sudah_terdaftar, bukan data_wajib_kurang");
});

uji("tandaiBarisImpor: gabungan — beberapa keadaan sekaligus dalam satu tempelan, tiap baris independen", () => {
  const formulir: FormulirPeserta = { institusi: "wajib", nomorIdentitas: "tidak", noTelepon: "tidak" };
  const profilByEmail = new Map<string, ProfilTersimpanRingkas>([
    ["ada@contoh.com", { uid: "uid-5", institusi: "Dinas", nomorIdentitas: "", noTelepon: "" }],
    ["sudah@contoh.com", { uid: "uid-6", institusi: "Dinas", nomorIdentitas: "", noTelepon: "" }],
  ]);
  const hasil = tandaiBarisImpor(
    [
      baris("baru@contoh.com", "Baru", { baris: 1, institusi: "Dinas Baru" }), // akan_dibuatkan_akun
      baris("ada@contoh.com", "Ada", { baris: 2 }), // akun_sudah_ada
      baris("sudah@contoh.com", "Sudah", { baris: 3 }), // sudah_terdaftar
      baris("salah-email", "Salah", { baris: 4 }), // baris_tidak_sah
      baris("baru@contoh.com", "Duplikat", { baris: 5 }), // duplikat_dalam_tempelan
      baris("kurang@contoh.com", "Kurang", { baris: 6 }), // data_wajib_kurang (institusi kosong, tidak ada profil)
    ],
    formulir,
    profilByEmail,
    new Set(["uid-6"])
  );
  assert.deepEqual(
    hasil.map((h) => h.status),
    [
      "akan_dibuatkan_akun",
      "akun_sudah_ada",
      "sudah_terdaftar",
      "baris_tidak_sah",
      "duplikat_dalam_tempelan",
      "data_wajib_kurang",
    ]
  );
  assert.deepEqual(
    hasil.map((h) => h.akanDieksekusi),
    [true, true, false, false, false, false]
  );
});

// ---------------------------------------------------------------------
// gabungkanIdentitas()
// ---------------------------------------------------------------------

uji("gabungkanIdentitas: baris terisi -> nilai baris menang", () => {
  const hasil = gabungkanIdentitas(
    baris("a@contoh.com", "A", { institusi: "Dari Baris" }),
    { uid: "u", institusi: "Dari Profil", nomorIdentitas: "", noTelepon: "" }
  );
  assert.equal(hasil.institusi, "Dari Baris");
});

uji("gabungkanIdentitas: baris kosong, profil terisi -> jatuh ke profil", () => {
  const hasil = gabungkanIdentitas(
    baris("a@contoh.com", "A"),
    { uid: "u", institusi: "Dari Profil", nomorIdentitas: "123", noTelepon: "0812" }
  );
  assert.deepEqual(hasil, { institusi: "Dari Profil", nomorIdentitas: "123", noTelepon: "0812" });
});

uji("gabungkanIdentitas: baris kosong, tidak ada profil -> string kosong, tidak melempar", () => {
  const hasil = gabungkanIdentitas(baris("a@contoh.com", "A"), null);
  assert.deepEqual(hasil, { institusi: "", nomorIdentitas: "", noTelepon: "" });
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
