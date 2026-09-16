export interface HasilValidasiUrlGambar {
  valid: boolean;
  alasan?: string;
}

const EKSTENSI_GAMBAR = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const QUERY_TERLARANG = ["jwt", "x-amz-signature", "x-amz-expires"];

/**
 * Fungsi murni — dipakai di klien (form template sertifikat,
 * /admin/kegiatan/[id]) DAN di server (src/lib/api/sertifikat-server.ts,
 * pagar terakhir sebelum sertifikat dibekukan). Tidak boleh bergantung pada
 * API khusus browser atau khusus Node — hanya `URL` global, tersedia di
 * keduanya.
 *
 * Kosong dianggap valid (field-field ini semuanya opsional). Beberapa
 * kondisi hanya PERINGATAN (valid: true, alasan terisi) — bukan penolakan —
 * supaya admin tetap bisa menyimpan tautan yang kemungkinan benar tapi
 * tidak yakin 100%.
 */
export function periksaUrlGambar(url: string): HasilValidasiUrlGambar {
  const nilai = url.trim();
  if (!nilai) {
    return { valid: true };
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

  const host = parsed.hostname.toLowerCase();
  if (host.includes("private-user-images.githubusercontent.com")) {
    return {
      valid: false,
      alasan:
        "Tautan private-user-images.githubusercontent.com adalah tautan sementara bawaan GitHub — bisa mati sewaktu-waktu. Unggah ke tempat lain yang tautannya permanen.",
    };
  }

  const queryKeysLower = Array.from(parsed.searchParams.keys()).map((key) => key.toLowerCase());
  const queryBermasalah = QUERY_TERLARANG.find((key) => queryKeysLower.includes(key));
  if (queryBermasalah) {
    return {
      valid: false,
      alasan:
        "URL ini tampak seperti tautan bertanda tangan yang kedaluwarsa dalam hitungan menit (mengandung parameter jwt/X-Amz-Signature/X-Amz-Expires) — pakai tautan permanen.",
    };
  }

  if (host === "github.com" && !parsed.pathname.includes("/raw/")) {
    return {
      valid: false,
      alasan:
        "Tautan github.com ini mengarah ke halaman, bukan berkas gambar langsung — pakai tautan /raw/ atau host gambar lain.",
    };
  }

  const pathLower = parsed.pathname.toLowerCase();
  const punyaEkstensiGambar = EKSTENSI_GAMBAR.some((ekstensi) => pathLower.endsWith(ekstensi));
  if (!punyaEkstensiGambar) {
    return {
      valid: true,
      alasan:
        "URL ini tidak berakhiran .png/.jpg/.jpeg/.webp/.svg — pastikan ini benar tautan langsung ke berkas gambar.",
    };
  }

  return { valid: true };
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
