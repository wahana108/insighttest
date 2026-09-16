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
