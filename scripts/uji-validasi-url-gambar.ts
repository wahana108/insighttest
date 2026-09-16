/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji periksaUrlGambar() dan periksaGambarSoal() (src/lib/validasi-url-gambar.ts)
 * sebagai fungsi murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Slice "gambar-soal" (docs/kickoff.md §S "Slice 7") — periksaGambarSoal()
 * adalah gerbang gambar YANG SAMA dipakai validasiSoal()
 * (src/lib/services/soal.ts), baik lewat form manual (/admin/soal) maupun
 * importer massal (src/lib/services/soal-import.ts). validasiSoal() sendiri
 * TIDAK diuji langsung di sini — ia memanggil getTopikByKode(), butuh
 * koneksi Firestore, di luar cakupan skrip "fungsi murni" ini (sama seperti
 * skrip uji lain di direktori ini). Kasus "impor JSON yang membawa gambar"
 * di bawah mensimulasikan BENTUK yang keluar dari pemetaan opsi
 * soal-import.ts (field urlGambar opsional, hilang → "") lalu
 * menjalankannya lewat gerbang yang sama persis.
 *
 * Jalankan: npx tsx scripts/uji-validasi-url-gambar.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { periksaGambarSoal, periksaUrlGambar } from "../src/lib/validasi-url-gambar";

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

// --- periksaUrlGambar(): dasar-dasar yang jadi fondasi periksaGambarSoal() ---

uji("periksaUrlGambar: string kosong → valid (field opsional, belum ada gambar)", () => {
  assert.equal(periksaUrlGambar("").valid, true);
});

uji("periksaUrlGambar: tautan .png https biasa → valid, tanpa peringatan", () => {
  const hasil = periksaUrlGambar("https://raw.githubusercontent.com/user/aset/main/soal-1.png");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: http:// (bukan https) → DITOLAK", () => {
  const hasil = periksaUrlGambar("http://contoh.com/gambar.png");
  assert.equal(hasil.valid, false);
});

uji("periksaUrlGambar: private-user-images.githubusercontent.com (tautan sementara) → DITOLAK", () => {
  const hasil = periksaUrlGambar(
    "https://private-user-images.githubusercontent.com/12345/abc.png?jwt=xyz"
  );
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /sementara/i);
});

uji("periksaUrlGambar: query bertanda tangan (X-Amz-Signature) → DITOLAK", () => {
  const hasil = periksaUrlGambar(
    "https://contoh-bucket.s3.amazonaws.com/gambar.png?X-Amz-Signature=abc&X-Amz-Expires=300"
  );
  assert.equal(hasil.valid, false);
});

uji("periksaUrlGambar: github.com tanpa /raw/ (halaman, bukan berkas) → DITOLAK", () => {
  const hasil = periksaUrlGambar("https://github.com/user/repo/blob/main/gambar.png");
  assert.equal(hasil.valid, false);
});

uji("periksaUrlGambar: URL tidak bisa diparse sama sekali → DITOLAK, tidak melempar", () => {
  const hasil = periksaUrlGambar("bukan-url-sama-sekali");
  assert.equal(hasil.valid, false);
});

// --- periksaGambarSoal(): gerbang gabungan soal + opsi ---

uji("periksaGambarSoal: soal dengan gambar valid, opsi tanpa gambar → OK", () => {
  const hasil = periksaGambarSoal({
    urlGambar: "https://raw.githubusercontent.com/user/aset/main/rambu.png",
    opsi: [{ urlGambar: "" }, { urlGambar: "" }],
  });
  assert.equal(hasil.valid, true);
});

uji("periksaGambarSoal: soal TANPA gambar sama sekali (semua kosong) → OK", () => {
  const hasil = periksaGambarSoal({
    urlGambar: "",
    opsi: [{ urlGambar: "" }, { urlGambar: "" }, { urlGambar: "" }],
  });
  assert.equal(hasil.valid, true);
});

uji("periksaGambarSoal: opsi SEBAGIAN bergambar (campuran ada/tidak) → OK", () => {
  const hasil = periksaGambarSoal({
    urlGambar: "",
    opsi: [
      { urlGambar: "https://raw.githubusercontent.com/user/aset/main/opsi-a.png" },
      { urlGambar: "" },
      { urlGambar: "https://raw.githubusercontent.com/user/aset/main/opsi-c.jpg" },
    ],
  });
  assert.equal(hasil.valid, true);
});

uji("periksaGambarSoal: gambar SOAL tidak sah → DITOLAK, pesan menyebut 'Gambar soal'", () => {
  const hasil = periksaGambarSoal({
    urlGambar: "http://tidak-aman.com/gambar.png",
    opsi: [{ urlGambar: "" }, { urlGambar: "" }],
  });
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /^Gambar soal:/);
});

uji("periksaGambarSoal: gambar OPSI ke-2 tidak sah, opsi lain sah → DITOLAK, pesan menyebut opsi yang benar", () => {
  const hasil = periksaGambarSoal({
    urlGambar: "",
    opsi: [
      { urlGambar: "https://raw.githubusercontent.com/user/aset/main/opsi-a.png" },
      { urlGambar: "http://tidak-aman.com/opsi-b.png" },
    ],
  });
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /^Gambar opsi 2:/);
});

uji("periksaGambarSoal: soal lama tanpa field urlGambar sama sekali (dipetakan ke \"\" oleh mapSoal/mapOpsi) → OK, tidak melempar", () => {
  // Simulasi persis apa yang mapSoal()/mapOpsi() (src/lib/services/soal.ts)
  // hasilkan untuk dokumen lama: field urlGambar tidak pernah ada di
  // Firestore, dibaca sebagai "" (KA-1) sebelum sampai ke sini.
  const urlGambarDariDokumenLama = "";
  const opsiDariDokumenLama = [{ urlGambar: "" }, { urlGambar: "" }];
  assert.doesNotThrow(() =>
    periksaGambarSoal({ urlGambar: urlGambarDariDokumenLama, opsi: opsiDariDokumenLama })
  );
  assert.equal(
    periksaGambarSoal({ urlGambar: urlGambarDariDokumenLama, opsi: opsiDariDokumenLama }).valid,
    true
  );
});

uji("periksaGambarSoal: soal tanpa opsi sama sekali (array kosong) → OK, tidak melempar (validasi jumlah opsi bukan tanggung jawab fungsi ini)", () => {
  assert.doesNotThrow(() => periksaGambarSoal({ urlGambar: "", opsi: [] }));
});

// --- Impor JSON yang membawa gambar (bentuk yang keluar dari soal-import.ts) ---

uji("impor: baris JSON dengan urlGambar di soal DAN di satu opsi → lolos gerbang yang sama dengan form manual", () => {
  // Meniru pemetaan opsiMapped di periksaBerkasImpor() (src/lib/services/soal-import.ts):
  // opsi.urlGambar ?? "" untuk field opsional yang mungkin tidak dikirim AI.
  type OpsiImporMentah = { teks: string; benar: boolean; urlGambar?: string };
  const rowOpsi: OpsiImporMentah[] = [
    { teks: "Opsi A", benar: true, urlGambar: "https://raw.githubusercontent.com/user/aset/main/a.png" },
    { teks: "Opsi B", benar: false },
  ];
  const opsiMapped = rowOpsi.map((opsi) => ({ urlGambar: opsi.urlGambar ?? "" }));
  const rowUrlGambar: string | undefined = "https://raw.githubusercontent.com/user/aset/main/soal.jpg";

  const hasil = periksaGambarSoal({ urlGambar: rowUrlGambar ?? "", opsi: opsiMapped });
  assert.equal(hasil.valid, true);

  const punyaGambar = Boolean(rowUrlGambar) || opsiMapped.some((opsi) => Boolean(opsi.urlGambar));
  assert.equal(punyaGambar, true);
});

uji("impor: baris JSON TANPA field urlGambar sama sekali (skema lama/AI tidak menyertakan) → punyaGambar false, tetap lolos gerbang", () => {
  type OpsiImporMentah = { teks: string; benar: boolean; urlGambar?: string };
  const rowOpsi: OpsiImporMentah[] = [
    { teks: "Opsi A", benar: true },
    { teks: "Opsi B", benar: false },
  ];
  const opsiMapped = rowOpsi.map((opsi) => ({ urlGambar: opsi.urlGambar ?? "" }));
  const rowUrlGambar: string | undefined = undefined;

  const hasil = periksaGambarSoal({ urlGambar: rowUrlGambar ?? "", opsi: opsiMapped });
  assert.equal(hasil.valid, true);

  const punyaGambar = Boolean(rowUrlGambar) || opsiMapped.some((opsi) => Boolean(opsi.urlGambar));
  assert.equal(punyaGambar, false);
});

uji("impor: baris JSON dengan urlGambar tidak sah (AI mengarang tautan sementara) → DITOLAK lewat gerbang yang sama", () => {
  type OpsiImporMentah = { teks: string; benar: boolean; urlGambar?: string };
  const rowOpsi: OpsiImporMentah[] = [
    { teks: "Opsi A", benar: true },
    { teks: "Opsi B", benar: false, urlGambar: "https://private-user-images.githubusercontent.com/x.png" },
  ];
  const opsiMapped = rowOpsi.map((opsi) => ({ urlGambar: opsi.urlGambar ?? "" }));

  const hasil = periksaGambarSoal({ urlGambar: "", opsi: opsiMapped });
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /^Gambar opsi 2:/);
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
