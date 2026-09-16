/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji templatEmailUji() (src/lib/email/templat.ts) dan kirimEmail()
 * (src/lib/email/brevo.ts) sebagai fungsi murni. Pakai node:assert saja,
 * tidak ada framework tes baru.
 *
 * TANPA memanggil jaringan sungguhan — kasus yang butuh mengamati perilaku
 * kirimEmail() setelah lolos pemeriksaan env var men-stub global fetch()
 * sementara (dikembalikan lagi di finally), bukan menghubungi api.brevo.com.
 *
 * Jalankan: npx tsx scripts/uji-email-brevo.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { kirimEmail } from "../src/lib/email/brevo";
import { templatEmailUji } from "../src/lib/email/templat";

let lulus = 0;
let gagal = 0;

async function uji(nama: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    lulus += 1;
    console.log(`OK    ${nama}`);
  } catch (err) {
    gagal += 1;
    console.error(`GAGAL ${nama}`);
    console.error(`      ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Nilai RAHASIA palsu yang tidak pernah boleh muncul di alasan kegagalan
// mana pun di bawah — dipakai untuk memastikan kirimEmail() tidak pernah
// meneruskannya, bukan cuma diperiksa satu per satu di kode.
const API_KEY_PALSU = "RAHASIA-JANGAN-PERNAH-BOCOR-xyz789";

const ENV_KEYS = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"] as const;

function simpanEnv(): Record<string, string | undefined> {
  const salinan: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    salinan[key] = process.env[key];
  }
  return salinan;
}

function pulihkanEnv(salinan: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (salinan[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = salinan[key];
    }
  }
}

async function main() {
  // --- templatEmailUji(): fungsi murni ---

  await uji("templatEmailUji: subjek dan isi tidak kosong", () => {
    const templat = templatEmailUji("Budi");
    assert.ok(templat.subjek.trim().length > 0);
    assert.ok(templat.isiTeks.trim().length > 0);
    assert.ok(templat.isiHtml.trim().length > 0);
  });

  await uji("templatEmailUji: isiTeks memuat nama penerima", () => {
    const templat = templatEmailUji("Budi Santoso");
    assert.match(templat.isiTeks, /Budi Santoso/);
  });

  await uji("templatEmailUji: isiHtml memuat nama penerima", () => {
    const templat = templatEmailUji("Budi Santoso");
    assert.match(templat.isiHtml, /Budi Santoso/);
  });

  await uji("templatEmailUji: nama kosong (hanya spasi) → jatuh ke 'Admin', tidak melempar", () => {
    const templat = templatEmailUji("   ");
    assert.match(templat.isiTeks, /Admin/);
  });

  // --- kirimEmail(): env var kosong -> tidak pernah memanggil API ---

  const envAsli = simpanEnv();
  const fetchAsli = globalThis.fetch;

  try {
    await uji(
      "kirimEmail: ketiga env var kosong → terkirim:false, TANPA memanggil fetch sama sekali",
      async () => {
        for (const key of ENV_KEYS) {
          delete process.env[key];
        }
        let fetchDipanggil = false;
        globalThis.fetch = (async () => {
          fetchDipanggil = true;
          throw new Error("fetch tidak boleh dipanggil saat env var kosong");
        }) as typeof fetch;

        const hasil = await kirimEmail({
          ke: "peserta@contoh.test",
          keNama: "Peserta Uji",
          subjek: "Subjek",
          isiTeks: "Teks",
          isiHtml: "<p>Teks</p>",
        });

        assert.equal(fetchDipanggil, false);
        assert.equal(hasil.terkirim, false);
        assert.equal(hasil.alasan, "Pengiriman email belum dikonfigurasi.");
      }
    );

    await uji("kirimEmail: hanya BREVO_API_KEY terisi (dua lainnya kosong) → tetap terkirim:false", async () => {
      delete process.env.BREVO_SENDER_EMAIL;
      delete process.env.BREVO_SENDER_NAME;
      process.env.BREVO_API_KEY = API_KEY_PALSU;

      const hasil = await kirimEmail({
        ke: "peserta@contoh.test",
        keNama: "Peserta Uji",
        subjek: "Subjek",
        isiTeks: "Teks",
        isiHtml: "<p>Teks</p>",
      });

      assert.equal(hasil.terkirim, false);
      assert.equal(hasil.alasan, "Pengiriman email belum dikonfigurasi.");
      assert.doesNotMatch(hasil.alasan ?? "", new RegExp(API_KEY_PALSU));
    });

    // --- kirimEmail(): env var lengkap, fetch di-stub (BUKAN jaringan sungguhan) ---

    await uji(
      "kirimEmail: env var lengkap + respons non-2xx (di-stub) → terkirim:false, alasan TIDAK PERNAH memuat BREVO_API_KEY",
      async () => {
        process.env.BREVO_API_KEY = API_KEY_PALSU;
        process.env.BREVO_SENDER_EMAIL = "pengirim@contoh.test";
        process.env.BREVO_SENDER_NAME = "Portal Uji";

        globalThis.fetch = (async () =>
          // Respons Brevo asli TIDAK memuat api-key (itu header request,
          // bukan bagian respons) — tapi badan respons di sini SENGAJA
          // memuat API_KEY_PALSU untuk membuktikan kirimEmail() memang
          // tidak pernah meneruskan apa pun dari badan respons mentah,
          // bukan cuma "kebetulan" aman.
          new Response(JSON.stringify({ message: "Unauthorized", code: API_KEY_PALSU }), {
            status: 401,
          })) as typeof fetch;

        const hasil = await kirimEmail({
          ke: "peserta@contoh.test",
          keNama: "Peserta Uji",
          subjek: "Subjek",
          isiTeks: "Teks",
          isiHtml: "<p>Teks</p>",
        });

        assert.equal(hasil.terkirim, false);
        assert.ok(hasil.alasan);
        assert.doesNotMatch(hasil.alasan ?? "", new RegExp(API_KEY_PALSU));
        assert.match(hasil.alasan ?? "", /401/);
      }
    );

    await uji(
      "kirimEmail: env var lengkap + fetch melempar (galat jaringan, di-stub) → terkirim:false, alasan berbahasa Indonesia, TIDAK memuat BREVO_API_KEY",
      async () => {
        process.env.BREVO_API_KEY = API_KEY_PALSU;
        process.env.BREVO_SENDER_EMAIL = "pengirim@contoh.test";
        process.env.BREVO_SENDER_NAME = "Portal Uji";

        globalThis.fetch = (async () => {
          throw new TypeError("fetch failed");
        }) as typeof fetch;

        const hasil = await kirimEmail({
          ke: "peserta@contoh.test",
          keNama: "Peserta Uji",
          subjek: "Subjek",
          isiTeks: "Teks",
          isiHtml: "<p>Teks</p>",
        });

        assert.equal(hasil.terkirim, false);
        assert.ok(hasil.alasan);
        assert.doesNotMatch(hasil.alasan ?? "", new RegExp(API_KEY_PALSU));
        assert.match(hasil.alasan ?? "", /jaringan/i);
      }
    );

    await uji(
      "kirimEmail: env var lengkap + respons 201 sukses (di-stub) → terkirim:true, idPesan terisi dari messageId",
      async () => {
        process.env.BREVO_API_KEY = API_KEY_PALSU;
        process.env.BREVO_SENDER_EMAIL = "pengirim@contoh.test";
        process.env.BREVO_SENDER_NAME = "Portal Uji";

        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ messageId: "<abc123@smtp-relay.mailin.fr>" }), {
            status: 201,
          })) as typeof fetch;

        const hasil = await kirimEmail({
          ke: "peserta@contoh.test",
          keNama: "Peserta Uji",
          subjek: "Subjek",
          isiTeks: "Teks",
          isiHtml: "<p>Teks</p>",
        });

        assert.equal(hasil.terkirim, true);
        assert.equal(hasil.idPesan, "<abc123@smtp-relay.mailin.fr>");
      }
    );
  } finally {
    globalThis.fetch = fetchAsli;
    pulihkanEnv(envAsli);
  }

  console.log(`\n${lulus} lulus, ${gagal} gagal.`);
  if (gagal > 0) {
    process.exitCode = 1;
  }
}

main();
