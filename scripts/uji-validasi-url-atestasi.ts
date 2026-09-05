/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji periksaUrlAtestasi() (src/lib/validasi-url-atestasi.ts) sebagai
 * fungsi murni. Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-validasi-url-atestasi.ts
 * (juga dipanggil otomatis lewat npm run uji, bersama uji-kelayakan.ts)
 */
import assert from "node:assert/strict";
import { periksaUrlAtestasi } from "../src/lib/validasi-url-atestasi";

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

uji("URL https berakhiran .html pada host biasa → valid, tanpa peringatan", () => {
  const hasil = periksaUrlAtestasi("https://cdn.contoh.com/games/space-commander/index.html");
  assert.equal(hasil.valid, true, `Diharapkan valid, dapat alasan: "${hasil.alasan}"`);
  assert.equal(
    hasil.alasan,
    undefined,
    `Diharapkan tanpa alasan (tidak ada peringatan) untuk URL .html yang wajar, dapat: "${hasil.alasan}"`
  );
});

uji("URL http:// (bukan https) → ditolak, alasan menyebut https", () => {
  const hasil = periksaUrlAtestasi("http://cdn.contoh.com/games/foo/index.html");
  assert.equal(
    hasil.valid,
    false,
    "Diharapkan ditolak karena bukan https://"
  );
  assert.ok(
    hasil.alasan?.toLowerCase().includes("https"),
    `Diharapkan alasan menyebut https, dapat: "${hasil.alasan}"`
  );
});

uji(
  "host raw.githubusercontent.com → ditolak, alasan menyebut CSP/X-Frame-Options (terukur, tidak akan pernah jalan)",
  () => {
    const hasil = periksaUrlAtestasi(
      "https://raw.githubusercontent.com/org/repo/main/games/foo/index.html"
    );
    assert.equal(hasil.valid, false, "Diharapkan ditolak untuk host raw.githubusercontent.com");
    assert.ok(
      hasil.alasan?.includes("X-Frame-Options") || hasil.alasan?.includes("text/plain"),
      `Diharapkan alasan menyebut kenapa raw.githubusercontent.com tidak akan pernah jalan sebagai iframe, dapat: "${hasil.alasan}"`
    );
  }
);

uji("github.com tanpa /raw/ → ditolak, alasan menyebut halaman bukan berkas", () => {
  const hasil = periksaUrlAtestasi("https://github.com/org/repo/blob/main/index.html");
  assert.equal(
    hasil.valid,
    false,
    "Diharapkan ditolak karena github.com tanpa /raw/ adalah halaman, bukan berkas"
  );
  assert.ok(
    hasil.alasan?.includes("halaman"),
    `Diharapkan alasan menyebut ini halaman bukan berkas langsung, dapat: "${hasil.alasan}"`
  );
});

uji("github.com DENGAN /raw/ → tidak ditolak oleh aturan github.com", () => {
  const hasil = periksaUrlAtestasi("https://github.com/org/repo/raw/main/index.html");
  assert.equal(
    hasil.valid,
    true,
    `Diharapkan valid karena path mengandung /raw/, dapat alasan: "${hasil.alasan}"`
  );
});

uji("https tanpa .html di akhir path → tetap valid, tapi dengan peringatan", () => {
  const hasil = periksaUrlAtestasi("https://cdn.contoh.com/games/foo/");
  assert.equal(
    hasil.valid,
    true,
    "Diharapkan tetap valid (peringatan bukan penolakan) untuk URL tanpa .html"
  );
  assert.ok(
    typeof hasil.alasan === "string" && hasil.alasan.includes(".html"),
    `Diharapkan ada peringatan menyebut .html, dapat: "${hasil.alasan}"`
  );
});

uji("string kosong → valid, tanpa alasan (\"wajib diisi\" diperiksa terpisah)", () => {
  const hasil = periksaUrlAtestasi("");
  assert.equal(hasil.valid, true, "Diharapkan string kosong dianggap valid oleh fungsi ini");
  assert.equal(hasil.alasan, undefined, `Diharapkan tanpa alasan, dapat: "${hasil.alasan}"`);
});

uji("string yang bukan URL sama sekali → ditolak, alasan \"URL tidak valid\"", () => {
  const hasil = periksaUrlAtestasi("bukan url sama sekali");
  assert.equal(hasil.valid, false, "Diharapkan ditolak karena bukan URL yang valid");
  assert.ok(
    hasil.alasan?.toLowerCase().includes("tidak valid"),
    `Diharapkan alasan menyebut URL tidak valid, dapat: "${hasil.alasan}"`
  );
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
