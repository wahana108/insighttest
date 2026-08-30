import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * SATU-SATUNYA tempat Admin SDK diinisialisasi. Memakai kredensial service
 * account (FIREBASE_ADMIN_*), yang hanya boleh hidup di server.
 *
 * ATURAN KERAS: berkas ini TIDAK BOLEH diimpor dari komponen klien ("use
 * client") mana pun — Admin SDK memakai modul Node (fs, net, dll) yang
 * tidak ada di browser, dan kredensial di sini tidak boleh sampai ke
 * bundel klien. Hanya dipakai dari Route Handler / kode server lain, lewat
 * src/lib/api/auth-server.ts.
 *
 * Inisialisasi SENGAJA ditunda sampai dipanggil, bukan top-level seperti
 * client.ts — Next.js mengimpor setiap route.ts saat "npm run build" untuk
 * mengumpulkan konfigurasinya, terlepas dari apakah route itu benar-benar
 * dipanggil. Kalau initializeApp()/cert() dijalankan di top-level dan
 * FIREBASE_ADMIN_* belum ada di .env.local, build gagal walau route itu
 * tidak pernah diakses. getAdminAuth()/getAdminDb() baru menyentuh
 * kredensial saat Route Handler benar-benar jalan.
 */
function loadCredential() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(
      "FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, dan FIREBASE_ADMIN_PRIVATE_KEY " +
        "wajib diisi di .env.local (lihat docs/kickoff.md B1/B3)."
    );
  }

  // .env menyimpan private key dengan urutan karakter \n harfiah (backslash
  // lalu huruf n), bukan baris baru sungguhan. Tanpa diubah, parsing PEM
  // gagal dengan pesan galat yang menyesatkan — tidak menyebut \n sama sekali.
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  return cert({ projectId, clientEmail, privateKey });
}

let app: App | undefined;

function getAdminApp(): App {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp({ credential: loadCredential() });
  }
  return app;
}

let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

export function getAdminAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getAdminApp());
  }
  return authInstance;
}

export function getAdminDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getAdminApp());
  }
  return dbInstance;
}
