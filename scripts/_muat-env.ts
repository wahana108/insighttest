/**
 * Modul efek-samping — memuat .env.local ke process.env untuk skrip yang
 * dijalankan lewat `tsx` langsung (Next.js memuatnya otomatis, tsx tidak).
 * HARUS jadi import PERTAMA di berkas manapun yang membutuhkannya — modul
 * ES dievaluasi menurut urutan import statement pertama kali muncul, jadi
 * ini menjamin process.env terisi SEBELUM modul lain (mis.
 * src/lib/firebase/client.ts, yang membaca NEXT_PUBLIC_FIREBASE_* di
 * top-level saat diimpor) sempat dievaluasi.
 */
import fs from "node:fs";

const isi = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
for (const baris of isi.split(/\r?\n/)) {
  const cocok = baris.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!cocok) continue;
  const [, kunci, nilaiMentah] = cocok;
  const nilai = nilaiMentah.trim().replace(/^"(.*)"$/, "$1");
  if (process.env[kunci] === undefined) {
    process.env[kunci] = nilai;
  }
}

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
