/**
 * Sertifikat adalah dokumen BEKU yang bisa diperiksa bertahun-tahun
 * kemudian — QR/teks alamat verifikasinya harus menunjuk domain KANONIK
 * platform, bukan alamat tempat ia KEBETULAN dicetak/dibuka. window.location
 * (atau host permintaan di server) tidak boleh dipakai: nilainya bisa
 * localhost saat development, domain pratinjau saat staging, atau custom
 * domain yang beda-beda per pengunjung — semuanya salah untuk sesuatu yang
 * harus tetap benar bertahun-tahun setelah dicetak.
 *
 * Sumbernya SATU jalur tetap, urut prioritas:
 * 1. NEXT_PUBLIC_SITE_URL (env, ditentukan saat build/deploy)
 * 2. field urlPublik di parameter/global (bisa diisi admin tanpa deploy ulang)
 *
 * Kalau keduanya kosong, kembalikan null — pemanggil WAJIB menampilkan
 * peringatan ke pengguna, TIDAK boleh diam-diam jatuh ke localhost atau
 * alamat lain yang kebetulan tersedia.
 */
export function urlVerifikasiSertifikat(
  kodeVerifikasi: string,
  urlPublik: string | null | undefined
): string | null {
  const basis = (process.env.NEXT_PUBLIC_SITE_URL || urlPublik || "").trim().replace(/\/+$/, "");
  if (!basis) {
    return null;
  }
  return `${basis}/s/${kodeVerifikasi}`;
}
