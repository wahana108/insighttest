/**
 * Templat email — dipisah dari pengirim (src/lib/email/brevo.ts) SEJAK AWAL
 * (Slice "email-brevo", 6a) supaya slice berikutnya (6b, formulir dukungan
 * + kirim kode) tinggal menambah fungsi templat baru di sini, bukan
 * mengubah kirimEmail(). Fungsi murni — tidak ada akses jaringan/Firestore.
 */

export interface TemplatEmail {
  subjek: string;
  isiTeks: string;
  isiHtml: string;
}

/**
 * Email percobaan sederhana — satu-satunya templat di slice 6a, dipakai
 * POST /api/email/uji untuk membuktikan pengiriman lewat Brevo bekerja.
 */
export function templatEmailUji(namaPenerima: string): TemplatEmail {
  const nama = namaPenerima.trim() || "Admin";
  const subjek = "Email uji dari portal — pengiriman berhasil";
  const isiTeks = [
    `Halo ${nama},`,
    "",
    "Ini email percobaan dari portal untuk memastikan pengiriman email lewat Brevo bekerja dengan benar.",
    "Kalau Anda menerima email ini, berarti konfigurasinya sudah benar.",
    "",
    "Tidak perlu membalas email ini.",
  ].join("\n");
  const isiHtml = [
    `<p>Halo ${nama},</p>`,
    "<p>Ini email percobaan dari portal untuk memastikan pengiriman email lewat Brevo bekerja dengan benar. Kalau Anda menerima email ini, berarti konfigurasinya sudah benar.</p>",
    "<p>Tidak perlu membalas email ini.</p>",
  ].join("");
  return { subjek, isiTeks, isiHtml };
}

/**
 * Slice "niat-dukungan" (6b), dikirim dari POST /api/dukungan/kirim-kode
 * (diganti nama dari /kirim-ulang di Slice "urutan-dukungan" 6c — POST
 * /api/dukungan/niat sendiri sejak 6c tidak lagi mengirim email) setelah
 * kirimEmail() dipanggil, ATAU dipersiapkan sebelum panggilan itu — fungsi
 * murni ini sendiri tidak pernah tahu apakah pengirimannya sukses.
 *
 * Parameter SENGAJA hanya tiga: nama penerima, judul kegiatan, kode akses
 * — TIDAK ADA data peserta lain (bukan daftar penerima, bukan data
 * pendaftar lain) yang bisa ikut bocor lewat templat ini, karena memang
 * tidak pernah dioper ke sini sama sekali.
 */
export function templatEmailKodeAkses(
  namaPenerima: string,
  judulKegiatan: string,
  kodeAkses: string
): TemplatEmail {
  const nama = namaPenerima.trim() || "Pendukung";
  const judul = judulKegiatan.trim() || "kegiatan ini";
  const subjek = `Kode akses untuk ${judul}`;
  const isiTeks = [
    `Halo ${nama},`,
    "",
    `Terima kasih atas dukungan Anda untuk ${judul}. Berikut kode akses untuk mendaftar:`,
    "",
    kodeAkses,
    "",
    "Masukkan kode ini persis seperti tertulis di atas pada formulir pendaftaran kegiatan.",
    "",
    "Simpan email ini — kode akses tidak ditampilkan ulang di halaman mana pun.",
  ].join("\n");
  const isiHtml = [
    `<p>Halo ${nama},</p>`,
    `<p>Terima kasih atas dukungan Anda untuk <strong>${judul}</strong>. Berikut kode akses untuk mendaftar:</p>`,
    `<p style="font-size:1.25em;font-weight:bold;letter-spacing:0.05em;">${kodeAkses}</p>`,
    "<p>Masukkan kode ini persis seperti tertulis di atas pada formulir pendaftaran kegiatan.</p>",
    "<p>Simpan email ini — kode akses tidak ditampilkan ulang di halaman mana pun.</p>",
  ].join("");
  return { subjek, isiTeks, isiHtml };
}
