/**
 * SERVER SAJA — memakai BREVO_API_KEY (rahasia). JANGAN PERNAH diimpor dari
 * komponen klien ("use client") atau kode apa pun yang berjalan di
 * peramban — sama aturan dengan src/lib/firebase/admin.ts. Hanya dipanggil
 * dari Route Handler (lihat src/app/api/email/uji/route.ts).
 *
 * Slice "email-brevo" (6a) — membuktikan pengiriman email lewat Brevo
 * bekerja, permukaan sekecil mungkin. Templat dipisah ke templat.ts SEJAK
 * AWAL (lihat komentar di sana) supaya slice berikutnya (6b, formulir
 * dukungan + kirim kode) tinggal menambah templat baru, bukan mengubah
 * fungsi ini.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface ParameterKirimEmail {
  ke: string;
  keNama: string;
  subjek: string;
  isiTeks: string;
  isiHtml: string;
}

export interface HasilKirimEmail {
  terkirim: boolean;
  /** Berbahasa Indonesia, aman ditampilkan ke pengguna — TIDAK PERNAH memuat BREVO_API_KEY. */
  alasan?: string;
  /** Terisi hanya saat terkirim true — messageId dari respons Brevo. */
  idPesan?: string;
}

/**
 * Kalau salah satu dari BREVO_API_KEY/BREVO_SENDER_EMAIL/BREVO_SENDER_NAME
 * kosong, API Brevo TIDAK PERNAH dipanggil — supaya build dan halaman lain
 * (termasuk `next build` di CI/lingkungan pratinjau tanpa env var ini)
 * tetap jalan tanpa error, dan supaya kegagalan konfigurasi tidak pernah
 * disalahartikan sebagai kegagalan jaringan/Brevo.
 */
export async function kirimEmail(params: ParameterKirimEmail): Promise<HasilKirimEmail> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME;

  if (!apiKey || !senderEmail || !senderName) {
    return { terkirim: false, alasan: "Pengiriman email belum dikonfigurasi." };
  }

  let response: Response;
  try {
    response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: params.ke, name: params.keNama }],
        subject: params.subjek,
        textContent: params.isiTeks,
        htmlContent: params.isiHtml,
      }),
    });
  } catch {
    return {
      terkirim: false,
      alasan: "Gagal menghubungi layanan email — periksa koneksi jaringan server.",
    };
  }

  if (!response.ok) {
    // SENGAJA tidak menyertakan isi respons Brevo di alasan — respons galat
    // Brevo tidak memuat BREVO_API_KEY, tapi tetap tidak diteruskan apa pun
    // dari badan respons mentahnya supaya aman by design, bukan karena
    // diperiksa satu per satu.
    return {
      terkirim: false,
      alasan: `Layanan email menolak permintaan (status ${response.status}).`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { terkirim: true };
  }
  const idPesan =
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).messageId === "string"
      ? ((body as Record<string, unknown>).messageId as string)
      : undefined;

  return { terkirim: true, idPesan };
}
