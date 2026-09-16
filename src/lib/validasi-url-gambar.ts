export interface HasilValidasiUrlGambar {
  valid: boolean;
  alasan?: string;
}

const EKSTENSI_GAMBAR = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"];
// Slice "validasi-gambar" (7b) — HANYA ekstensi yang JELAS bukan gambar.
// Daftar ini SENGAJA bukan kebalikan dari EKSTENSI_GAMBAR (bukan "tolak
// semua yang tidak ada di daftar gambar") — banyak layanan gambar sah
// (mis. picsum.photos) tidak memakai ekstensi sama sekali di URL-nya, dan
// menolaknya membuat dua pesan yang bertentangan muncul sekaligus di form.
// Ekstensi tak dikenal (bukan gambar, bukan di daftar ini) DAN tanpa
// ekstensi sama sekali jatuh ke jalur ketiga: diterima dengan catatan.
const EKSTENSI_BUKAN_GAMBAR = [
  ".pdf", ".html", ".htm", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".json", ".zip", ".rar", ".mp4", ".mp3", ".wav", ".php",
  ".aspx", ".jsp", ".xml",
];
// Slice "tautan-permanen" — diperluas dari daftar 7a. Nama parameter yang
// menandakan tautan bertanda tangan/sementara (S3/CloudFront presigned URL,
// Azure SAS, Google Cloud Storage signed URL, JWT ad-hoc) — dibandingkan
// TANPA peduli huruf besar/kecil (lihat queryKeyAsli di bawah). "jwt" dan
// "x-amz-expires" dipertahankan dari daftar 7a (bukan bagian permintaan
// slice ini) supaya cakupan lama tidak diam-diam menyempit.
const QUERY_TERLARANG = [
  "jwt", "x-amz-expires",
  "token", "x-amz-signature", "x-amz-credential", "expires", "signature",
  "sig", "se", "sp", "sv", "googleaccessid",
];
// Slice "tautan-permanen" — proxy gambar GitHub (dipakai untuk menampilkan
// gambar di komentar/README tanpa membocorkan URL asli) — TIDAK permanen,
// bisa berubah sewaktu-waktu di luar kendali siapa pun yang menautkannya.
// Beda dari raw.githubusercontent.com (berkas asli di repo, permanen).
const HOST_PROXY_GAMBAR = ["camo.githubusercontent.com"];

/**
 * Fungsi murni — dipakai di klien (form template sertifikat,
 * /admin/kegiatan/[id]) DAN di server (src/lib/api/sertifikat-server.ts,
 * pagar terakhir sebelum sertifikat dibekukan). Tidak boleh bergantung pada
 * API khusus browser atau khusus Node — hanya `URL` global, tersedia di
 * keduanya.
 *
 * Kosong dianggap valid (field-field ini semuanya opsional). Sejak Slice
 * "validasi-gambar" (7a/7b): sebagian besar kondisi di bawah adalah
 * PENOLAKAN keras (valid: false) — tujuannya menangkap tautan salah saat
 * disimpan/diimpor, bukan membiarkannya hilang diam-diam saat dirender ke
 * peserta. SATU pengecualian yang disengaja (7b): tautan tanpa ekstensi
 * gambar yang dikenal tetap valid: true, disertai `alasan` sebagai catatan
 * NETRAL (bukan galat) — banyak layanan gambar sah tidak memakai ekstensi
 * sama sekali, dan form (BAGIAN 2, src/app/_gambar-aman.tsx) tetap
 * menampilkan label status pratinjau di sampingnya untuk kasus ini, beda
 * dari penolakan keras yang menyembunyikan label status sama sekali.
 */
export function periksaUrlGambar(url: string): HasilValidasiUrlGambar {
  const nilai = url.trim();
  if (!nilai) {
    return { valid: true };
  }

  // Slice "validasi-gambar" (7b) — tautan Markdown yang tersalin utuh
  // (mis. "[gambar](https://.../foto.png)" ditempel apa adanya, bukan
  // cuma alamatnya) ditemukan langsung dalam pengujian. Dicek SEBELUM
  // new URL() di bawah supaya pesannya spesifik ("tersalin bersama
  // Markdown") — string begini nyaris selalu gagal diparse sebagai URL
  // dan tanpa pemeriksaan ini akan jatuh ke pesan generik "URL tidak
  // valid" yang tidak menjelaskan APA yang salah.
  if (nilai.includes("](")) {
    return {
      valid: false,
      alasan: "Tautan ini tampaknya tersalin bersama format Markdown. Salin hanya alamatnya saja.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(nilai);
  } catch {
    return { valid: false, alasan: "URL tidak valid." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, alasan: "URL harus memakai https://." };
  }

  // Slice "validasi-gambar" (7a, diperbaiki di 7b) — TIGA jalur berdasarkan
  // ekstensi pada pathname (query string diabaikan dengan sengaja —
  // parsed.pathname sudah terpisah dari parsed.search, jadi "?width=300"
  // dsb tidak ikut diperiksa):
  //   (1) ekstensi JELAS bukan gambar (EKSTENSI_BUKAN_GAMBAR, mis. .pdf)
  //       -> tolak KERAS.
  //   (2) ekstensi gambar dikenal (EKSTENSI_GAMBAR) -> lanjut TANPA catatan.
  //   (3) selain keduanya — TERMASUK tanpa ekstensi sama sekali, dan
  //       ekstensi tak dikenal seperti .jgp — TETAP DITERIMA dengan
  //       catatan netral. 7a menolak kasus ini secara keliru: banyak
  //       layanan gambar sah (mis. picsum.photos) tidak memakai ekstensi
  //       di URL-nya sama sekali. Ditunda sampai akhir fungsi (bukan
  //       return langsung) supaya pemeriksaan host/query di bawah TETAP
  //       berlaku untuk tautan tanpa ekstensi — jalur 3 bukan celah untuk
  //       melewati KA-8.
  const pathLower = parsed.pathname.toLowerCase();
  const cocokEkstensi = pathLower.match(/\.[a-z0-9]+$/);
  const ekstensi = cocokEkstensi ? cocokEkstensi[0] : null;

  if (ekstensi && EKSTENSI_BUKAN_GAMBAR.includes(ekstensi)) {
    return {
      valid: false,
      alasan: `Tautan gambar harus berakhir dengan .jpg, .png, .webp, atau sejenisnya. Tautan ini berakhir dengan ${ekstensi}.`,
    };
  }
  const catatanEkstensi: string | undefined =
    !ekstensi || !EKSTENSI_GAMBAR.includes(ekstensi)
      ? "Tautan ini tidak berakhir dengan ekstensi gambar yang dikenal. Periksa pratinjau di bawah untuk memastikan gambarnya muncul."
      : undefined;

  const host = parsed.hostname.toLowerCase();
  if (host.includes("private-user-images.githubusercontent.com")) {
    return {
      valid: false,
      alasan:
        "Tautan private-user-images.githubusercontent.com adalah tautan sementara bawaan GitHub — bisa mati sewaktu-waktu. Unggah ke tempat lain yang tautannya permanen.",
    };
  }
  if (HOST_PROXY_GAMBAR.some((h) => host.includes(h))) {
    return {
      valid: false,
      alasan:
        "Alamat ini adalah proxy gambar GitHub yang bisa berubah sewaktu-waktu. Pakai alamat gambar aslinya.",
    };
  }

  // Slice "tautan-permanen" — pratinjau hijau (BAGIAN 2, GambarAman) TIDAK
  // membuktikan permanen: tautan bertanda tangan hijau HARI INI dan mati
  // MINGGU DEPAN begitu tanda tangannya kedaluwarsa — pelanggaran KA-8 yang
  // baru terdeteksi setelah sertifikat sudah terbit. Nama parameter ASLI
  // (bukan versi huruf kecil) disisipkan ke pesan supaya admin tahu persis
  // parameter mana yang harus dibuang, tapi PERBANDINGANNYA sendiri tidak
  // peduli huruf besar/kecil (queryKeyAsli.toLowerCase() dicocokkan ke
  // QUERY_TERLARANG yang sudah huruf kecil semua).
  const queryKeyAsli = Array.from(parsed.searchParams.keys()).find((key) =>
    QUERY_TERLARANG.includes(key.toLowerCase())
  );
  if (queryKeyAsli) {
    return {
      valid: false,
      alasan: `Tautan ini mengandung tanda tangan sementara (parameter '${queryKeyAsli}') sehingga akan mati dengan sendirinya. Pakai tautan gambar yang permanen dan bisa dibuka siapa saja.`,
    };
  }

  if (host === "github.com" && !parsed.pathname.includes("/raw/")) {
    return {
      valid: false,
      alasan:
        "Tautan github.com ini mengarah ke halaman, bukan berkas gambar langsung — pakai tautan /raw/ atau host gambar lain.",
    };
  }

  return catatanEkstensi ? { valid: true, alasan: catatanEkstensi } : { valid: true };
}

/**
 * Slice "gambar-soal" (docs/kickoff.md §S "Slice 7") — memeriksa SEMUA URL
 * gambar pada satu kandidat soal (gambar soal sendiri + gambar tiap opsi)
 * lewat periksaUrlGambar(), berhenti di kesalahan PERTAMA. Fungsi murni,
 * diekstrak dari validasiSoal() (src/lib/services/soal.ts) supaya bisa
 * diuji tanpa Firestore — validasiSoal() sendiri memanggil
 * getTopikByKode(), butuh koneksi Firestore, sementara pemeriksaan gambar
 * ini tidak. validasiSoal() memanggil fungsi ini dan hanya fungsi ini untuk
 * bagian gambar — SATU gerbang yang dipakai BERSAMA oleh form manual
 * (/admin/soal) dan importer massal (src/lib/services/soal-import.ts),
 * sesuai KA-8 (docs/arsitektur.md).
 */
export function periksaGambarSoal(input: {
  urlGambar: string;
  opsi: { urlGambar: string }[];
}): HasilValidasiUrlGambar {
  const hasilSoal = periksaUrlGambar(input.urlGambar);
  if (!hasilSoal.valid) {
    return { valid: false, alasan: `Gambar soal: ${hasilSoal.alasan}` };
  }
  for (let index = 0; index < input.opsi.length; index += 1) {
    const hasilOpsi = periksaUrlGambar(input.opsi[index].urlGambar);
    if (!hasilOpsi.valid) {
      return { valid: false, alasan: `Gambar opsi ${index + 1}: ${hasilOpsi.alasan}` };
    }
  }
  return { valid: true };
}
