export interface HasilValidasiUrlAtestasi {
  valid: boolean;
  alasan?: string;
}

/**
 * Fungsi murni — dipakai di form admin (klien) SEBELUM gerbang postMessage
 * dijalankan (src/lib/verifikasi-atestasi-client.ts), supaya host yang
 * sudah pasti gagal tertangkap tanpa perlu memuat iframe percuma dulu.
 *
 * Diukur dari origin produksi (3 Sep 2026): raw.githubusercontent.com
 * menyajikan berkas sebagai Content-Type: text/plain dengan
 * Content-Security-Policy: sandbox dan X-Frame-Options: deny — iframe ke
 * situ TIDAK AKAN PERNAH berhasil memuat game, apa pun isi berkasnya.
 *
 * Kosong dianggap valid — "wajib diisi" adalah aturan terpisah (lihat
 * validasiModul() di src/lib/services/modul.ts), fungsi ini murni bentuk
 * URL-nya.
 */
export function periksaUrlAtestasi(url: string): HasilValidasiUrlAtestasi {
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
  if (host === "raw.githubusercontent.com") {
    return {
      valid: false,
      alasan:
        "raw.githubusercontent.com menyajikan berkas sebagai text/plain dengan " +
        "Content-Security-Policy: sandbox dan X-Frame-Options: deny — iframe ke situ tidak akan " +
        "pernah berhasil memuat game, apa pun isi berkasnya. Host-kan berkasnya di tempat lain.",
    };
  }

  if (host === "github.com" && !parsed.pathname.includes("/raw/")) {
    return {
      valid: false,
      alasan:
        "Tautan github.com ini mengarah ke halaman, bukan berkas langsung — pakai tautan /raw/ " +
        "atau host lain.",
    };
  }

  if (!parsed.pathname.toLowerCase().endsWith(".html")) {
    return {
      valid: true,
      alasan: "URL ini tidak berakhiran .html — pastikan ini benar tautan langsung ke game.",
    };
  }

  return { valid: true };
}
