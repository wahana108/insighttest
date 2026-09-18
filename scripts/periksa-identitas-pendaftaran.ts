/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Slice "lengkapi-sendiri" (6f): satu perintah menjawab "kenapa orang ini
 * diblokir / kenapa tidak?" untuk gerbang identitasBelumLengkap, tanpa
 * login, tanpa klik. HANYA MEMBACA — TIDAK PERNAH menulis ke Firestore.
 * Memakai Admin SDK dan .env.local, mengikuti pola scripts/periksa-kelayakan.ts.
 *
 * ATURAN KERAS (pelajaran Slice 6.1, dicatat di KICKOFF): putusan di sini
 * WAJIB dihitung dengan memanggil putuskanIdentitasPendaftaran() yang SAMA
 * dengan yang dipakai POST /api/attempt (src/app/api/attempt/route.ts) dan
 * POST /api/modul/dibuka (src/app/api/modul/dibuka/route.ts) — logikanya
 * TIDAK ditulis ulang di sini, dan argumennya disusun dengan cara yang SAMA
 * PERSIS seperti kedua route itu:
 *   - identitasBelumLengkap: data.identitasBelumLengkap === true (boolean,
 *     ekspresi identik dengan kedua route)
 *   - formulirPeserta: mapFormulirPeserta(kegiatanData.formulirPeserta) —
 *     fungsi murni yang SAMA yang dipakai kedua route, bukan diuraikan
 *     ulang di sini.
 *   - profil: { institusi, nomorIdentitas, noTelepon } dibaca dari
 *     users/{uid} dengan pola default KA-1 yang SAMA PERSIS dengan
 *     VerifiedUser (src/lib/api/auth-server.ts) — skrip ini tidak bisa
 *     memanggil verifyRequest() sendiri (butuh Request + ID token
 *     sungguhan), jadi pembacaan users/{uid}-nya disalin di sini (sama
 *     semangatnya dengan "parsing defensif" di periksa-kelayakan.ts), TAPI
 *     fungsi KEPUTUSANNYA sendiri tetap yang diimpor, tidak pernah ditulis
 *     ulang.
 *
 * Argumen boleh ID Firestore PERSIS, atau sebagian judul kegiatan (dicari
 * case-insensitive) — ID Firestore peka huruf besar/kecil dan gampang
 * salah salin (I besar vs l kecil), jadi kalau argumen tidak cocok ID
 * mana pun skrip ini mencoba mencocokkan ke judul sebelum menyerah.
 * Tanpa argumen sama sekali, atau argumen tidak cocok apa pun (ID maupun
 * judul), skrip TIDAK error — ia mencetak daftar seluruh kegiatan lalu
 * berhenti, supaya ID yang benar tinggal disalin dari situ.
 *
 * Jalankan: npx tsx scripts/periksa-identitas-pendaftaran.ts [kegiatanId | sebagian judul]
 * (juga: npm run periksa-identitas -- [kegiatanId | sebagian judul])
 */
import { loadEnvConfig } from "@next/env";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "../src/lib/firebase/admin";
import { mapFormulirPeserta, putuskanIdentitasPendaftaran } from "../src/lib/formulir-peserta";
import type { SumberPendaftaran } from "../src/types/pendaftaran";

loadEnvConfig(process.cwd());

// ---------------------------------------------------------------------
// Parsing defensif (KA-1) — salinan lokal, sama semangatnya dengan
// periksa-kelayakan.ts: skrip baca-saja ini SENGAJA tidak mengimpor
// fungsi-fungsi internal Route Handler (tidak diekspor). Ini HANYA
// membaca bentuk data mentah — bukan logika keputusan, itu tetap datang
// dari putuskanIdentitasPendaftaran() yang diimpor di atas.
// ---------------------------------------------------------------------

function isSumberPendaftaran(value: unknown): value is SumberPendaftaran {
  return value === "mandiri" || value === "impor";
}

const LABEL_SUMBER: Record<SumberPendaftaran, string> = {
  mandiri: "mandiri",
  impor: "impor daftar hadir",
};

/** Tiga keadaan mentah, apa adanya — BUKAN boolean tunggal yang sudah diputuskan. */
function formatIdentitasBelumLengkapMentah(value: unknown): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "(field tidak ada)";
}

interface ProfilUsers {
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
  namaLengkap: string;
}

/**
 * SAMA PERSIS dengan pemetaan VerifiedUser di src/lib/api/auth-server.ts
 * (institusi/nomorIdentitas/noTelepon/namaLengkap, default string kosong)
 * — hanya bagian BACA-nya yang disalin di sini, bukan verifikasi tokennya
 * (skrip ini tidak punya Request/ID token untuk diverifikasi).
 */
function mapProfilUsers(value: unknown): ProfilUsers {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    institusi: typeof data.institusi === "string" ? data.institusi : "",
    nomorIdentitas: typeof data.nomorIdentitas === "string" ? data.nomorIdentitas : "",
    noTelepon: typeof data.noTelepon === "string" ? data.noTelepon : "",
    namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
  };
}

interface KegiatanRingkas {
  id: string;
  judul: string;
}

/** Diurutkan berdasarkan judul — supaya daftar yang dicetak enak dipindai manusia. */
async function muatDaftarKegiatan(db: Firestore): Promise<KegiatanRingkas[]> {
  const snap = await db.collection("kegiatan").get();
  return snap.docs
    .map((doc) => ({
      id: doc.id,
      judul: typeof doc.data().judul === "string" ? doc.data().judul : "(tanpa judul)",
    }))
    .sort((a, b) => a.judul.localeCompare(b.judul));
}

function cetakDaftarKegiatan(daftar: KegiatanRingkas[]): void {
  if (daftar.length === 0) {
    console.log("(belum ada kegiatan sama sekali)");
    return;
  }
  for (const k of daftar) {
    console.log(`${k.id}  ${k.judul}`);
  }
}

async function main(): Promise<void> {
  const db = getAdminDb();
  const argumen = process.argv[2];

  if (!argumen) {
    console.log("Penggunaan: npx tsx scripts/periksa-identitas-pendaftaran.ts <kegiatanId | sebagian judul>\n");
    console.log("Kegiatan yang ada:");
    cetakDaftarKegiatan(await muatDaftarKegiatan(db));
    return;
  }

  let kegiatanId = argumen;
  let kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();

  if (!kegiatanSnap.exists) {
    // ID tidak cocok — coba cocokkan ke JUDUL (case-insensitive) sebelum
    // menyerah. ID Firestore peka huruf besar/kecil dan gampang salah
    // salin dari layar (I besar vs l kecil), jadi ini bukan cuma
    // kenyamanan — ini jalan keluar dari salah ketik yang paling sering.
    const daftar = await muatDaftarKegiatan(db);
    const argumenLower = argumen.toLowerCase();
    const cocok = daftar.filter((k) => k.judul.toLowerCase().includes(argumenLower));

    if (cocok.length === 1) {
      kegiatanId = cocok[0].id;
      kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();
      console.log(`Cocok dengan judul: ${cocok[0].judul} (${cocok[0].id})\n`);
      if (!kegiatanSnap.exists) {
        // Race yang sangat tidak mungkin (dihapus di antara dua bacaan) —
        // tetap ditangani eksplisit, bukan diasumsikan tidak pernah terjadi.
        console.error(`Kegiatan ${kegiatanId} ternyata sudah tidak ada. Coba lagi.`);
        process.exit(1);
      }
    } else if (cocok.length > 1) {
      console.log(
        `"${argumen}" tidak cocok dengan ID kegiatan mana pun, dan cocok dengan LEBIH DARI SATU judul — sebutkan salah satu ID persis di bawah ini:\n`
      );
      cetakDaftarKegiatan(cocok);
      return;
    } else {
      console.log(`"${argumen}" tidak cocok dengan ID maupun judul kegiatan mana pun.\n`);
      console.log("Kegiatan yang ada:");
      cetakDaftarKegiatan(daftar);
      return;
    }
  }

  const pendaftaranSnap = await db
    .collection("pendaftaran")
    .where("kegiatanId", "==", kegiatanId)
    .get();

  const kegiatanData = kegiatanSnap.data() ?? {};
  const judul = typeof kegiatanData.judul === "string" ? kegiatanData.judul : "(tanpa judul)";
  // Fungsi murni yang SAMA dipakai POST /api/attempt dan POST /api/modul/dibuka.
  const formulirPeserta = mapFormulirPeserta(kegiatanData.formulirPeserta);

  console.log("=".repeat(72));
  console.log(`Kegiatan: ${judul}`);
  console.log("=".repeat(72));
  console.log("formulirPeserta:");
  console.log(`  institusi              : ${formulirPeserta.institusi}`);
  console.log(`  nomorIdentitas         : ${formulirPeserta.nomorIdentitas}`);
  console.log(`  noTelepon              : ${formulirPeserta.noTelepon}`);
  console.log(`  bolehDilengkapiSendiri : ${formulirPeserta.bolehDilengkapiSendiri}`);

  console.log(`\nPeserta terdaftar: ${pendaftaranSnap.size}`);

  const pendaftaranSorted = pendaftaranSnap.docs
    .map((doc) => ({ doc, data: doc.data() }))
    .sort((a, b) => {
      const na = typeof a.data.nomorUrut === "number" ? a.data.nomorUrut : 0;
      const nb = typeof b.data.nomorUrut === "number" ? b.data.nomorUrut : 0;
      return na - nb;
    });

  // Satu bacaan batch untuk semua users/{uid} sekaligus — sama pola dengan
  // src/lib/api/impor-hadir-server.ts (bacaLookupImporHadir), bukan satu
  // per satu.
  const uids = pendaftaranSorted
    .map(({ data }) => (typeof data.uid === "string" ? data.uid : ""))
    .filter((uid): uid is string => uid.length > 0);
  const usersSnaps =
    uids.length > 0 ? await db.getAll(...uids.map((uid) => db.collection("users").doc(uid))) : [];
  const profilByUid = new Map<string, ProfilUsers>();
  usersSnaps.forEach((snap) => {
    profilByUid.set(snap.id, mapProfilUsers(snap.exists ? snap.data() : undefined));
  });

  for (const { doc, data } of pendaftaranSorted) {
    const uid = typeof data.uid === "string" ? data.uid : doc.id;
    const email = typeof data.email === "string" ? data.email : "(tanpa email)";
    const namaLengkapPendaftaran =
      typeof data.namaLengkap === "string" ? data.namaLengkap : "(tanpa nama)";
    const nomorUrut = typeof data.nomorUrut === "number" ? data.nomorUrut : 0;
    const sumber: SumberPendaftaran = isSumberPendaftaran(data.sumber) ? data.sumber : "mandiri";

    const profilUsers = profilByUid.get(uid) ?? mapProfilUsers(undefined);
    const pendaftaranInstitusi = typeof data.institusi === "string" ? data.institusi : "";
    const pendaftaranNomorIdentitas = typeof data.nomorIdentitas === "string" ? data.nomorIdentitas : "";
    const pendaftaranNoTelepon = typeof data.noTelepon === "string" ? data.noTelepon : "";

    // SAMA PERSIS dengan POST /api/attempt dan POST /api/modul/dibuka —
    // lihat komentar berkas di atas. TIDAK ada logika penolakan ditulis di
    // sini, hanya pemanggilan fungsi yang diimpor.
    const hasil = putuskanIdentitasPendaftaran({
      identitasBelumLengkap: data.identitasBelumLengkap === true,
      formulirPeserta,
      profil: {
        institusi: profilUsers.institusi,
        nomorIdentitas: profilUsers.nomorIdentitas,
        noTelepon: profilUsers.noTelepon,
      },
    });

    console.log("\n" + "-".repeat(72));
    console.log(`[${nomorUrut}] ${email}  (${namaLengkapPendaftaran})`);
    console.log(`    sumber pendaftaran      : ${LABEL_SUMBER[sumber]}`);
    console.log(
      `    identitasBelumLengkap   : ${formatIdentitasBelumLengkapMentah(data.identitasBelumLengkap)}`
    );
    console.log(
      `    profil users/{uid}      : institusi=${profilUsers.institusi || "(kosong)"} nomorIdentitas=${profilUsers.nomorIdentitas || "(kosong)"}`
    );
    console.log(
      `                              noTelepon=${profilUsers.noTelepon || "(kosong)"} namaLengkap=${profilUsers.namaLengkap || "(kosong)"}`
    );
    console.log(
      `    pendaftaran             : institusi=${pendaftaranInstitusi || "(kosong)"} nomorIdentitas=${pendaftaranNomorIdentitas || "(kosong)"}`
    );
    console.log(`                              noTelepon=${pendaftaranNoTelepon || "(kosong)"}`);
    console.log(`    PUTUSAN                 : ${hasil.lengkap ? "BOLEH MENGERJAKAN" : "DIBLOKIR"}`);
    console.log(`    alasan                  : ${hasil.pesan ?? "(tidak ada — lengkap)"}`);
  }

  console.log("\n" + "=".repeat(72));
  console.log("Selesai. Laporan ini hanya membaca — tidak ada dokumen yang diubah.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
