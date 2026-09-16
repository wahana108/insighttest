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

// --- periksaUrlGambar(): Slice "validasi-gambar" (7a/7b) — ekstensi berkas, TIGA jalur ---

uji("periksaUrlGambar: .pdf → DITOLAK, pesan menyebut ekstensi yang ditemukan", () => {
  const hasil = periksaUrlGambar("https://contoh.com/dokumen.pdf");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /\.pdf/);
});

uji("periksaUrlGambar: .html → DITOLAK", () => {
  const hasil = periksaUrlGambar("https://contoh.com/halaman.html");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /\.html/);
});

uji("periksaUrlGambar: https://picsum.photos/400 (tanpa ekstensi, layanan gambar sah) → DITERIMA dengan catatan netral (7a menolaknya secara keliru)", () => {
  const hasil = periksaUrlGambar("https://picsum.photos/400");
  assert.equal(hasil.valid, true);
  assert.match(hasil.alasan ?? "", /tidak berakhir dengan ekstensi gambar yang dikenal/i);
});

uji("periksaUrlGambar: .jgp (ekstensi tak dikenal, kemungkinan salah ketik dari .jpg) → DITERIMA dengan catatan netral, BUKAN penolakan", () => {
  const hasil = periksaUrlGambar("https://contoh.com/foto.jgp");
  assert.equal(hasil.valid, true);
  assert.match(hasil.alasan ?? "", /tidak berakhir dengan ekstensi gambar yang dikenal/i);
});

uji("periksaUrlGambar: URL mengandung '](' (tautan Markdown tersalin utuh) → DITOLAK, pesan menyebut Markdown", () => {
  const hasil = periksaUrlGambar("[gambar](https://contoh.com/foto.png)");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /markdown/i);
});

uji("periksaUrlGambar: '](' di tengah URL yang sebenarnya bisa diparse → tetap DITOLAK lebih dulu (dicek sebelum new URL())", () => {
  const hasil = periksaUrlGambar("https://contoh.com/gambar.png](https://lain.com/x.png)");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /markdown/i);
});

uji("periksaUrlGambar: .JPG huruf besar → diterima TANPA catatan (tidak peka besar-kecil)", () => {
  const hasil = periksaUrlGambar("https://contoh.com/foto.JPG");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: .png?width=300 → diterima TANPA catatan (query string diabaikan saat memeriksa ekstensi)", () => {
  const hasil = periksaUrlGambar("https://contoh.com/gambar.png?width=300");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: .jpg → diterima tanpa catatan", () => {
  const hasil = periksaUrlGambar("https://contoh.com/foto.jpg");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: .webp → diterima tanpa catatan", () => {
  const hasil = periksaUrlGambar("https://contoh.com/foto.webp");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: .svg → diterima tanpa catatan", () => {
  const hasil = periksaUrlGambar("https://contoh.com/ikon.svg");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: .gif → diterima tanpa catatan", () => {
  const hasil = periksaUrlGambar("https://contoh.com/animasi.gif");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: .avif → diterima tanpa catatan", () => {
  const hasil = periksaUrlGambar("https://contoh.com/foto.avif");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: http:// dengan ekstensi gambar sah → TETAP DITOLAK seperti sebelumnya (protokol dicek lebih dulu)", () => {
  const hasil = periksaUrlGambar("http://contoh.com/gambar.png");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /https/i);
});

uji("periksaUrlGambar: tanpa ekstensi TAPI host bermasalah (private-user-images) → TETAP DITOLAK — jalur 3 bukan celah KA-8", () => {
  const hasil = periksaUrlGambar("https://private-user-images.githubusercontent.com/12345/berkas");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /sementara/i);
});

// --- periksaUrlGambar(): Slice "tautan-permanen" — tautan bertanda tangan/sementara ---

uji("periksaUrlGambar: raw.githubusercontent.com/...jpg?token=ABC → DITOLAK (parameter token)", () => {
  const hasil = periksaUrlGambar(
    "https://raw.githubusercontent.com/user/repo/main/foto.jpg?token=ABC"
  );
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /tanda tangan sementara/i);
  assert.match(hasil.alasan ?? "", /'token'/);
});

uji("periksaUrlGambar: ...jpg?X-Amz-Signature=abc → DITOLAK", () => {
  const hasil = periksaUrlGambar("https://contoh-bucket.s3.amazonaws.com/foto.jpg?X-Amz-Signature=abc");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /tanda tangan sementara/i);
});

uji("periksaUrlGambar: ...jpg?TOKEN=abc (huruf besar) → DITOLAK (perbandingan parameter tidak peka huruf besar-kecil)", () => {
  const hasil = periksaUrlGambar("https://contoh.com/foto.jpg?TOKEN=abc");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /tanda tangan sementara/i);
});

uji("periksaUrlGambar: camo.githubusercontent.com/... → DITOLAK (proxy gambar GitHub, bukan alamat asli)", () => {
  const hasil = periksaUrlGambar("https://camo.githubusercontent.com/abcdef1234567890/foto.png");
  assert.equal(hasil.valid, false);
  assert.match(hasil.alasan ?? "", /proxy gambar github/i);
});

uji("periksaUrlGambar: raw.githubusercontent.com/...jpg TANPA token → DITERIMA (repo publik memang permanen, jangan ikut diblokir)", () => {
  const hasil = periksaUrlGambar("https://raw.githubusercontent.com/user/repo/main/foto.jpg");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
});

uji("periksaUrlGambar: ...png?width=300 → TETAP DITERIMA (kontrol negatif — pemeriksaan tanda tangan tidak boleh menelan query yang tidak bersalah)", () => {
  const hasil = periksaUrlGambar("https://contoh.com/gambar.png?width=300");
  assert.equal(hasil.valid, true);
  assert.equal(hasil.alasan, undefined);
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
