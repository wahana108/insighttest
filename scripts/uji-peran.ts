/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Menguji izinPanitia() (src/lib/izin-panitia.ts) sebagai fungsi murni.
 * Pakai node:assert saja, tidak ada framework tes baru.
 *
 * Jalankan: npx tsx scripts/uji-peran.ts
 * (juga dipanggil otomatis lewat npm run uji)
 */
import assert from "node:assert/strict";
import { izinPanitia, type KemampuanPanitia } from "../src/lib/izin-panitia";

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

const SEMUA_TRUE: KemampuanPanitia = {
  boleh: true,
  lihatPeserta: true,
  terbitkanSertifikat: true,
  suntingKegiatan: true,
};

const SEMUA_FALSE: KemampuanPanitia = {
  boleh: false,
  lihatPeserta: false,
  terbitkanSertifikat: false,
  suntingKegiatan: false,
};

const KEGIATAN_KOSONG = {};

uji("admin: semua kemampuan true di kegiatan mana pun (termasuk kosong)", () => {
  const hasil = izinPanitia({ uid: "u-admin", role: "admin" }, KEGIATAN_KOSONG);
  assert.deepEqual(hasil, SEMUA_TRUE);
});

uji("superadmin: semua kemampuan true di kegiatan mana pun", () => {
  const hasil = izinPanitia(
    { uid: "u-super", role: "superadmin" },
    { panitiaUids: ["orang-lain"], panitiaIzin: {} }
  );
  assert.deepEqual(hasil, SEMUA_TRUE);
});

uji("panitia ditugaskan, kedua saklar mati → boleh+lihatPeserta true, sisanya false", () => {
  const kegiatan = {
    panitiaUids: ["u-panitia"],
    panitiaIzin: {
      "u-panitia": { terbitkanSertifikat: false, suntingKegiatan: false },
    },
  };
  const hasil = izinPanitia({ uid: "u-panitia", role: "panitia" }, kegiatan);
  assert.deepEqual(hasil, {
    boleh: true,
    lihatPeserta: true,
    terbitkanSertifikat: false,
    suntingKegiatan: false,
  });
});

uji("panitia ditugaskan dengan terbitkanSertifikat menyala → hanya itu yang true selain dua yang selalu", () => {
  const kegiatan = {
    panitiaUids: ["u-panitia"],
    panitiaIzin: {
      "u-panitia": { terbitkanSertifikat: true, suntingKegiatan: false },
    },
  };
  const hasil = izinPanitia({ uid: "u-panitia", role: "panitia" }, kegiatan);
  assert.deepEqual(hasil, {
    boleh: true,
    lihatPeserta: true,
    terbitkanSertifikat: true,
    suntingKegiatan: false,
  });
});

uji("panitia yang tidak ditugaskan (uid tidak ada di panitiaUids) → semuanya false", () => {
  const kegiatan = {
    panitiaUids: ["orang-lain"],
    panitiaIzin: {
      "orang-lain": { terbitkanSertifikat: true, suntingKegiatan: true },
    },
  };
  const hasil = izinPanitia({ uid: "u-panitia", role: "panitia" }, kegiatan);
  assert.deepEqual(hasil, SEMUA_FALSE);
});

uji("peserta → semuanya false, apa pun isi kegiatannya", () => {
  const kegiatan = {
    panitiaUids: ["u-peserta"],
    panitiaIzin: { "u-peserta": { terbitkanSertifikat: true, suntingKegiatan: true } },
  };
  const hasil = izinPanitia({ uid: "u-peserta", role: "peserta" }, kegiatan);
  assert.deepEqual(hasil, SEMUA_FALSE);
});

uji("kegiatan tanpa panitiaUids sama sekali (dokumen lama) → tidak melempar, semuanya false", () => {
  const hasil = izinPanitia({ uid: "u-panitia", role: "panitia" }, KEGIATAN_KOSONG);
  assert.deepEqual(hasil, SEMUA_FALSE);
});

uji(
  "panitiaUids memuat uid tapi panitiaIzin tidak punya entri untuk uid itu → lihatPeserta true, dua saklar false",
  () => {
    const kegiatan = { panitiaUids: ["u-panitia"], panitiaIzin: {} };
    const hasil = izinPanitia({ uid: "u-panitia", role: "panitia" }, kegiatan);
    assert.deepEqual(hasil, {
      boleh: true,
      lihatPeserta: true,
      terbitkanSertifikat: false,
      suntingKegiatan: false,
    });
  }
);

uji("profil null → semuanya false", () => {
  const hasil = izinPanitia(null, { panitiaUids: ["siapa-saja"] });
  assert.deepEqual(hasil, SEMUA_FALSE);
});

uji("peran tidak dikenal (bukan salah satu dari 4 role) → semuanya false", () => {
  const hasil = izinPanitia(
    { uid: "u-aneh", role: "bukan-peran-yang-ada" as never },
    { panitiaUids: ["u-aneh"] }
  );
  assert.deepEqual(hasil, SEMUA_FALSE);
});

uji("panitiaIzin bukan objek (rusak/tidak sinkron) → tidak melempar, dua saklar false", () => {
  const kegiatan = { panitiaUids: ["u-panitia"], panitiaIzin: "bukan-objek" };
  const hasil = izinPanitia({ uid: "u-panitia", role: "panitia" }, kegiatan);
  assert.deepEqual(hasil, {
    boleh: true,
    lihatPeserta: true,
    terbitkanSertifikat: false,
    suntingKegiatan: false,
  });
});

console.log(`\n${lulus} lulus, ${gagal} gagal.`);
if (gagal > 0) {
  process.exit(1);
}
