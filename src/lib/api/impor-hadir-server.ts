import type { Auth, UserRecord } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { emailFormatSah, type ProfilTersimpanRingkas } from "@/lib/services/impor-hadir";

export class ImporHadirError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ImporHadirError";
    this.status = status;
  }
}

export interface DataBaruUntukAkunImpor {
  email: string;
  namaLengkap: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
}

/**
 * Slice 6.2 — SATU-SATUNYA pembuat users/{uid} untuk jalur impor daftar
 * hadir. SENGAJA TERPISAH dari createProfileForNewAccount()
 * (src/lib/auth/user-profile.ts, KA-2 — docs/arsitektur.md), bukan karena
 * KA-2 diabaikan, tapi karena environment-nya tidak cocok sama sekali:
 *
 * 1. createProfileForNewAccount() memakai Client SDK (`db` dari
 *    src/lib/firebase/client.ts) dan menerima `User` dari Client Auth SDK
 *    — Route Handler ini hanya punya Admin SDK, tidak ada objek `User`
 *    client sama sekali.
 * 2. firestore.rules untuk users/{uid}: `allow create: if isOwner(uid) &&
 *    ...` — TIDAK ADA cabang admin. Admin tidak akan pernah lolos
 *    isOwner(uid) untuk uid orang lain, bahkan kalau dipaksa lewat client
 *    SDK. Admin SDK melewati rules — itu justru sebabnya jalur ini WAJIB
 *    server-side (lihat header dokumentasi route.ts pemanggilnya).
 * 3. createProfileForNewAccount() terikat parameter/global (mode
 *    pendaftaran) dan undangan — semantik yang tidak berlaku di sini:
 *    admin yang mengimpor SUDAH menjadi otoritas keputusan "orang ini
 *    boleh masuk", tidak perlu lewat gerbang undangan lagi.
 *
 * Ini TIDAK membuka kembali race condition yang KA-2 coba cegah: jalur
 * mandiri (src/lib/auth/session.ts) hanya membuat profil kalau users/{uid}
 * BELUM ADA (dicek lewat getDoc sebelum memanggil completeRegistration()).
 * Begitu impor membuat profil untuk sebuah uid, jalur mandiri tidak akan
 * pernah mencoba membuatnya lagi untuk uid yang sama — ia hanya membaca
 * yang sudah ada. Kalau orang yang sama kebetulan mendaftar sendiri
 * BERSAMAAN dengan diimpor (race di level akun, email yang sama), Firebase
 * Auth sendiri menjamin keunikan email: hanya satu dari dua panggilan
 * createUser yang berhasil, dan yang gagal tidak pernah lanjut menulis
 * profil apa pun.
 *
 * role SELALU 'peserta', status SELALU 'aktif' — tidak lewat undangan.
 * Akun dibuat TANPA password (createUser tanpa field password) — peserta
 * masuk lewat alur setel ulang kata sandi (Slice 6.0).
 */
export interface HasilBuatAkunImpor {
  userRecord: UserRecord;
  /**
   * false kalau ternyata akun ini SUDAH ADA saat percobaan createUser()
   * (race dengan pendaftaran mandiri, atau baris impor lain yang diproses
   * hampir bersamaan) — pemanggil (Route Handler eksekusi) HARUS memakai
   * ini, bukan berasumsi selalu true, supaya "Kirim tautan setel kata
   * sandi" tidak ditawarkan untuk akun yang sebenarnya sudah lama ada
   * (mungkin sudah punya kata sandi sendiri).
   */
  akunBaru: boolean;
}

export async function buatAkunDanProfilImpor(
  auth: Auth,
  db: Firestore,
  data: DataBaruUntukAkunImpor
): Promise<HasilBuatAkunImpor> {
  let userRecord: UserRecord;
  try {
    userRecord = await auth.createUser({
      email: data.email,
      displayName: data.namaLengkap,
      emailVerified: false,
    });
  } catch (err) {
    // Race: email dibuat pihak lain (mandiri, atau baris impor lain yang
    // diproses hampir bersamaan) tepat di antara pengecekan pratinjau dan
    // eksekusi ini. Pulihkan uid-nya, JANGAN gagal, dan JANGAN menulis
    // profilnya (KA-2 — profil orang ini sudah dibuat jalur lain).
    if (isAuthErrorCode(err, "auth/email-already-exists")) {
      const existing = await auth.getUserByEmail(data.email);
      return { userRecord: existing, akunBaru: false };
    }
    throw err;
  }

  const now = new Date().toISOString();
  await db.collection("users").doc(userRecord.uid).set({
    uid: userRecord.uid,
    email: data.email,
    displayName: data.namaLengkap,
    photoURL: null,
    role: "peserta",
    status: "aktif",
    namaLengkap: data.namaLengkap,
    institusi: data.institusi,
    nomorIdentitas: data.nomorIdentitas,
    noTelepon: data.noTelepon,
    bolehBuatSoal: false,
    createdAt: now,
    updatedAt: now,
  });

  return { userRecord, akunBaru: true };
}

function isAuthErrorCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === code;
}

/**
 * Baca-banyak sekaligus (bukan satu per satu) untuk semua email unik pada
 * satu tempelan — dipakai SAMA oleh pratinjau maupun eksekusi (Route
 * Handler pemanggil bertanggung jawab memanggil ulang fungsi ini di
 * eksekusi, tidak pernah memercayai hasil pratinjau yang mungkin sudah
 * basi). auth.getUsers() dibatasi 100 identifier per panggilan — dipecah
 * di sini, bukan tanggung jawab pemanggil.
 *
 * Slice 6.2a (CACAT 1) — emailUnikTernormalisasi DISARING ke yang formatnya
 * sah SEBELUM dioper ke auth.getUsers(): Admin SDK memvalidasi tiap
 * identifier dan melempar FirebaseAuthError(INVALID_EMAIL) secara SINKRON
 * kalau SATU SAJA formatnya salah — bukan menolak identifier itu sendiri.
 * Tempelan berantakan (baris tanpa email, kolom tidak sejajar) yang
 * menghasilkan string "email" sampah akan meruntuhkan SELURUH permintaan
 * kalau tidak disaring dulu di sini. Email yang tidak sah memang tidak
 * mungkin punya akun — melewatkannya dari pencarian tidak kehilangan
 * apa pun; tandaiBarisImpor() tetap menandainya "baris_tidak_sah" lewat
 * pemeriksaan formatnya sendiri, terlepas dari hasil lookup ini.
 */
export async function bacaLookupImporHadir(
  auth: Auth,
  db: Firestore,
  kegiatanId: string,
  emailUnikTernormalisasi: string[]
): Promise<{
  profilByEmail: Map<string, ProfilTersimpanRingkas>;
  uidSudahTerdaftar: Set<string>;
}> {
  const profilByEmail = new Map<string, ProfilTersimpanRingkas>();
  const emailSah = emailUnikTernormalisasi.filter((email) => emailFormatSah(email));

  const uidByEmail = new Map<string, string>();
  const UKURAN_POTONGAN_AUTH = 100;
  for (let i = 0; i < emailSah.length; i += UKURAN_POTONGAN_AUTH) {
    const potongan = emailSah.slice(i, i + UKURAN_POTONGAN_AUTH);
    if (potongan.length === 0) {
      continue;
    }
    const { users } = await auth.getUsers(potongan.map((email) => ({ email })));
    for (const user of users) {
      if (user.email) {
        uidByEmail.set(user.email.toLowerCase(), user.uid);
      }
    }
  }

  const uidList = Array.from(uidByEmail.values());
  if (uidList.length > 0) {
    const profilSnaps = await db.getAll(...uidList.map((uid) => db.collection("users").doc(uid)));
    const profilByUid = new Map<string, ProfilTersimpanRingkas>();
    profilSnaps.forEach((snap) => {
      const data = snap.exists ? snap.data() ?? {} : {};
      profilByUid.set(snap.id, {
        uid: snap.id,
        institusi: typeof data.institusi === "string" ? data.institusi : "",
        nomorIdentitas: typeof data.nomorIdentitas === "string" ? data.nomorIdentitas : "",
        noTelepon: typeof data.noTelepon === "string" ? data.noTelepon : "",
      });
    });
    for (const [email, uid] of uidByEmail) {
      const profil = profilByUid.get(uid);
      // Akun Auth ada tapi dokumen users/{uid}-nya hilang (seharusnya
      // tidak pernah terjadi kalau KA-2 selalu ditegakkan) — tetap
      // dianggap "akun sudah ada" dengan identitas kosong, TIDAK dilempar
      // sebagai galat yang menghentikan seluruh impor.
      profilByEmail.set(email, profil ?? { uid, institusi: "", nomorIdentitas: "", noTelepon: "" });
    }
  }

  // Kegiatan realistis berjumlah ratusan pendaftar (§1, docs/arsitektur.md)
  // — satu bacaan penuh per kegiatan ini lebih murah dan lebih sederhana
  // daripada query 'in' terpecah per potongan uid.
  const pendaftaranSnap = await db
    .collection("pendaftaran")
    .where("kegiatanId", "==", kegiatanId)
    .get();
  const uidSudahTerdaftar = new Set<string>();
  pendaftaranSnap.docs.forEach((doc) => {
    const uid = doc.data().uid;
    if (typeof uid === "string" && uid) {
      uidSudahTerdaftar.add(uid);
    }
  });

  return { profilByEmail, uidSudahTerdaftar };
}
