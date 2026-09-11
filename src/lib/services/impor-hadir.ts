import { LABEL_FIELD_FORMULIR } from "@/lib/formulir-peserta";
import type { FormulirPeserta } from "@/types/kegiatan";

/**
 * writeBatch Firestore maksimal 500 operasi, dan tiap baris impor memakai
 * hingga 2 (profil + pendaftaran) — 200 baris = 400 operasi, aman di bawah
 * batas. Pembuatan akun Firebase Auth juga dibatasi lajunya (dieksekusi
 * per potongan kecil di klien, lihat halaman impor), jadi batas ini juga
 * menjaga satu kali impor tidak jadi ratusan panggilan createUser sekaligus.
 */
export const MAKS_BARIS_IMPOR_HADIR = 200;

const KOLOM_TAMBAHAN_URUTAN = ["institusi", "nomorIdentitas", "noTelepon"] as const;
export type KolomTambahanImpor = (typeof KOLOM_TAMBAHAN_URUTAN)[number];

/**
 * Kolom tambahan yang DIHARAPKAN muncul di tempelan, urutan tetap
 * institusi -> nomorIdentitas -> noTelepon — dipilih dari field
 * formulirPeserta kegiatan yang BUKAN 'tidak' (baik 'wajib' maupun
 * 'opsional' tetap dapat kolom; hanya 'tidak' yang tidak punya kolom sama
 * sekali). Dipakai untuk menentukan berapa kolom yang harus dibaca
 * uraiDaftarHadir() setelah email+namaLengkap.
 */
export function kolomTambahanUntukFormulir(formulirPeserta: FormulirPeserta): KolomTambahanImpor[] {
  return KOLOM_TAMBAHAN_URUTAN.filter((field) => formulirPeserta[field] !== "tidak");
}

export interface BarisMentahImpor {
  /** 1-based di antara BARIS DATA saja — baris judul kolom (kalau terdeteksi) tidak dihitung. */
  baris: number;
  email: string;
  namaLengkap: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
  /**
   * Slice 6.2a: jumlah sel MENTAH hasil split baris ini (sebelum dipetakan
   * ke field) — dipakai membedakan "kolom tidak ada sama sekali di baris
   * ini" dari "kolom ada tapi selnya kosong" pada pesan data_wajib_kurang.
   * Dua kesalahan itu beda perbaikannya (BAGIAN e).
   */
  jumlahSel: number;
}

function deteksiPemisah(teks: string): "\t" | "," {
  const barisPertama =
    teks.split(/\r\n|\r|\n/).find((baris) => baris.trim().length > 0) ?? "";
  return barisPertama.includes("\t") ? "\t" : ",";
}

/**
 * Fungsi murni — tidak menyentuh Firestore/Auth. Menguraikan tempelan
 * TSV/CSV (daftar hadir hidup di Excel, bukan JSON) jadi baris mentah.
 *
 * Pemisah dideteksi otomatis dari baris pertama (tab kalau ada, kalau
 * tidak koma) — bukan dipilih pengguna, supaya tempel-dari-Excel (yang
 * selalu tab) dan tempel-dari-CSV-sungguhan (koma) berjalan tanpa saklar.
 *
 * Baris judul kolom dikenali kalau sel pertama (ditrim, huruf kecil)
 * PERSIS "email" — heuristik SENGAJA sempit: kalau dilonggarkan (mis. "sel
 * pertama bukan email yang valid"), baris data pertama yang emailnya
 * benar-benar salah ketik akan salah dianggap judul kolom dan lenyap tanpa
 * jejak, bukan dilaporkan "baris tidak sah".
 */
export function uraiDaftarHadir(
  teks: string,
  kolomTambahan: KolomTambahanImpor[]
): BarisMentahImpor[] {
  const semuaBaris = teks.split(/\r\n|\r|\n/).filter((baris) => baris.trim().length > 0);
  if (semuaBaris.length === 0) {
    return [];
  }

  const pemisah = deteksiPemisah(teks);
  const barisSel = semuaBaris.map((baris) => baris.split(pemisah).map((sel) => sel.trim()));

  const selPertama = (barisSel[0]?.[0] ?? "").toLowerCase();
  const mulaiDari = selPertama === "email" ? 1 : 0;

  const hasil: BarisMentahImpor[] = [];
  for (let i = mulaiDari; i < barisSel.length; i += 1) {
    const sel = barisSel[i];
    const nilaiKolomTambahan = (field: KolomTambahanImpor): string => {
      const posisi = kolomTambahan.indexOf(field);
      return posisi === -1 ? "" : (sel[2 + posisi] ?? "").trim();
    };
    hasil.push({
      baris: hasil.length + 1,
      email: (sel[0] ?? "").trim(),
      namaLengkap: (sel[1] ?? "").trim(),
      institusi: nilaiKolomTambahan("institusi"),
      nomorIdentitas: nilaiKolomTambahan("nomorIdentitas"),
      noTelepon: nilaiKolomTambahan("noTelepon"),
      jumlahSel: sel.length,
    });
  }
  return hasil;
}

export type StatusBarisHadir =
  | "akan_dibuatkan_akun"
  | "akun_sudah_ada"
  | "sudah_terdaftar"
  | "duplikat_dalam_tempelan"
  | "baris_tidak_sah"
  | "data_wajib_kurang";

export interface HasilBarisHadir extends BarisMentahImpor {
  status: StatusBarisHadir;
  pesan: string[];
  /** true hanya untuk 'akan_dibuatkan_akun' dan 'akun_sudah_ada' — status lain TIDAK PERNAH dieksekusi. */
  akanDieksekusi: boolean;
  /** uid akun yang SUDAH ADA untuk email ini — null kalau akan dibuatkan baru, atau baris ini tidak dieksekusi. */
  uidSudahAda: string | null;
}

/** Data profil ringkas untuk email yang SUDAH punya akun — dipakai fallback data_wajib_kurang dan gabungkanIdentitas(). */
export interface ProfilTersimpanRingkas {
  uid: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalisasiEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Slice 6.2a — diekspor supaya Route Handler bisa menyaring email SEBELUM
 * dioper ke auth.getUsers(): Admin SDK melempar galat SINKRON kalau satu
 * saja identifier email formatnya tidak valid (bukan menolak identifier
 * itu saja), jadi tempelan berantakan (baris tanpa email/kolom tidak
 * sejajar) yang menghasilkan string "email" sampah akan meruntuhkan
 * SELURUH permintaan kalau tidak disaring dulu — itulah CACAT 1.
 */
export function emailFormatSah(email: string): boolean {
  const normal = normalisasiEmail(email);
  return normal.length > 0 && EMAIL_PATTERN.test(normal);
}

const URUTAN_FIELD_WAJIB: KolomTambahanImpor[] = ["institusi", "nomorIdentitas", "noTelepon"];

/**
 * Fungsi murni — tidak menyentuh Firestore/Auth. profilByEmail dan
 * uidSudahTerdaftar sudah dibaca lebih dulu oleh pemanggil (Route Handler,
 * lewat src/lib/api/impor-hadir-server.ts) — di sini murni logika
 * penandaan, supaya bisa diuji tanpa Firestore/Auth sungguhan.
 *
 * Urutan pemeriksaan per baris SENGAJA begini: baris tidak sah dan
 * duplikat diperiksa PALING DULU (baris begini tidak bisa dan tidak boleh
 * dieksekusi apa pun alasannya) sebelum status akun/pendaftaran; data
 * wajib kurang diperiksa SETELAH status akun/pendaftaran, karena kalau
 * sudah terdaftar tidak ada gunanya menandai data yang kurang — baris itu
 * memang tidak akan disentuh.
 *
 * Slice 6.2a (CACAT 1): setiap baris dibungkus try/catch SENDIRI — kalau
 * ada kegagalan tak terduga saat menandai SATU baris, baris itu jatuh ke
 * "baris_tidak_sah" dan baris lainnya tetap diproses, bukan meruntuhkan
 * seluruh pratinjau/eksekusi. TIDAK ADA tempelan yang boleh menghasilkan
 * galat pada fungsi ini — kosong, satu kolom, seribu kolom, karakter
 * aneh, semuanya harus keluar sebagai salah satu dari enam status.
 */
export function tandaiBarisImpor(
  barisMentah: BarisMentahImpor[],
  formulirPeserta: FormulirPeserta,
  profilByEmail: Map<string, ProfilTersimpanRingkas>,
  uidSudahTerdaftar: Set<string>
): HasilBarisHadir[] {
  const hasil: HasilBarisHadir[] = [];
  const emailTerlihat = new Map<string, number>();
  const kolomTambahan = kolomTambahanUntukFormulir(formulirPeserta);

  for (const baris of barisMentah) {
    try {
      hasil.push(
        tandaiSatuBaris(baris, formulirPeserta, profilByEmail, uidSudahTerdaftar, emailTerlihat, kolomTambahan)
      );
    } catch (err) {
      hasil.push({
        ...baris,
        status: "baris_tidak_sah",
        pesan: [
          `Baris ini tidak bisa diproses (${err instanceof Error ? err.message : "kesalahan tidak diketahui"}).`,
        ],
        akanDieksekusi: false,
        uidSudahAda: null,
      });
    }
  }

  return hasil;
}

function tandaiSatuBaris(
  baris: BarisMentahImpor,
  formulirPeserta: FormulirPeserta,
  profilByEmail: Map<string, ProfilTersimpanRingkas>,
  uidSudahTerdaftar: Set<string>,
  emailTerlihat: Map<string, number>,
  kolomTambahan: KolomTambahanImpor[]
): HasilBarisHadir {
  const emailNormal = normalisasiEmail(baris.email);

  // 1. Baris tidak sah — email kosong/format salah, atau nama kosong.
  const emailSah = emailFormatSah(baris.email);
  const namaSah = baris.namaLengkap.trim().length > 0;
  if (!emailSah || !namaSah) {
    const pesan: string[] = [];
    if (!emailSah) {
      pesan.push("Email kosong atau formatnya tidak sah.");
    }
    if (!namaSah) {
      pesan.push("Nama lengkap wajib diisi.");
    }
    return { ...baris, status: "baris_tidak_sah", pesan, akanDieksekusi: false, uidSudahAda: null };
  }

  // 2. Duplikat dalam tempelan — baris PERTAMA dengan email ini tetap
  // diproses normal; kemunculan berikutnya ditandai, tidak dieksekusi.
  const barisPertama = emailTerlihat.get(emailNormal);
  if (barisPertama !== undefined) {
    return {
      ...baris,
      status: "duplikat_dalam_tempelan",
      pesan: [`Email yang sama sudah muncul di baris ${barisPertama}.`],
      akanDieksekusi: false,
      uidSudahAda: null,
    };
  }
  emailTerlihat.set(emailNormal, baris.baris);

  // 3. Status akun/pendaftaran.
  const profil = profilByEmail.get(emailNormal) ?? null;
  if (profil && uidSudahTerdaftar.has(profil.uid)) {
    return {
      ...baris,
      status: "sudah_terdaftar",
      pesan: ["Sudah terdaftar di kegiatan ini — dilewati."],
      akanDieksekusi: false,
      uidSudahAda: profil.uid,
    };
  }

  // 4. Data wajib kurang — gabungan baris tempelan DAN profil yang sudah
  // ada (kalau akunnya sudah ada); baris baru (belum ada akun) hanya
  // punya isi barisnya sendiri.
  const fieldKurang = URUTAN_FIELD_WAJIB.filter((field) => {
    if (formulirPeserta[field] !== "wajib") {
      return false;
    }
    const dariBaris = baris[field].trim();
    const dariProfil = profil ? profil[field].trim() : "";
    return !dariBaris && !dariProfil;
  });
  if (fieldKurang.length > 0) {
    return {
      ...baris,
      status: "data_wajib_kurang",
      // Slice 6.2a (BAGIAN e): sebutkan KOLOM dan NILAI yang terbaca —
      // "kolomnya tidak ada" (baris ini lebih pendek dari posisi kolom
      // tersebut) dan "kolomnya ada tapi kosong" adalah dua kesalahan
      // berbeda dengan perbaikan berbeda (tambahkan kolom vs isi nilainya).
      pesan: fieldKurang.map((field) => {
        const posisiKolom = kolomTambahan.indexOf(field);
        const kolomAda = posisiKolom !== -1 && baris.jumlahSel > 2 + posisiKolom;
        return kolomAda
          ? `Kegiatan ini mewajibkan ${LABEL_FIELD_FORMULIR[field]} — kolomnya ADA di baris ini tapi KOSONG, isi nilainya.`
          : `Kegiatan ini mewajibkan ${LABEL_FIELD_FORMULIR[field]} — kolom ini TIDAK ADA di baris ini, tambahkan kolomnya.`;
      }),
      akanDieksekusi: false,
      uidSudahAda: profil?.uid ?? null,
    };
  }

  // 5. Siap dieksekusi.
  return {
    ...baris,
    status: profil ? "akun_sudah_ada" : "akan_dibuatkan_akun",
    pesan: [],
    akanDieksekusi: true,
    uidSudahAda: profil?.uid ?? null,
  };
}

/**
 * Fungsi murni — untuk EKSEKUSI, bukan pratinjau: prioritas SAMA seperti
 * data_wajib_kurang di atas (baris menang, kalau kosong pakai profil yang
 * sudah ada), tapi mengembalikan nilai gabungan untuk DITULIS ke dokumen
 * pendaftaran (bukan cuma memutuskan valid/tidak). namaLengkap TIDAK
 * digabung — baris_tidak_sah sudah menolak baris tanpa nama sebelum fungsi
 * ini pernah dipanggil, jadi baris.namaLengkap selalu dipakai apa adanya.
 */
export function gabungkanIdentitas(
  baris: BarisMentahImpor,
  profilLama: ProfilTersimpanRingkas | null
): { institusi: string; nomorIdentitas: string; noTelepon: string } {
  return {
    institusi: baris.institusi.trim() || profilLama?.institusi.trim() || "",
    nomorIdentitas: baris.nomorIdentitas.trim() || profilLama?.nomorIdentitas.trim() || "",
    noTelepon: baris.noTelepon.trim() || profilLama?.noTelepon.trim() || "",
  };
}

/**
 * Slice 6.2a (CACAT 2c) — Fungsi murni. Deteksi PERINGATAN, bukan
 * penolakan: kalau SELURUH baris tempelan terurai jadi cuma satu kolom
 * terisi (email — namaLengkap dan semua kolom tambahan kosong), PADAHAL
 * email itu sendiri mengandung spasi (tanda beberapa potongan yang
 * dimaksud pengguna sebenarnya dipisah spasi berulang, bukan TAB/koma).
 * Tempelan kosong (tidak ada baris) BUKAN kasus ini — kembalikan false,
 * biar pesan "tidak ada baris" yang bicara, bukan pesan pemisah.
 */
export function sepertiPemisahSpasi(barisMentah: BarisMentahImpor[]): boolean {
  if (barisMentah.length === 0) {
    return false;
  }
  return barisMentah.every((baris) => {
    const hanyaEmailTerisi =
      baris.namaLengkap === "" &&
      baris.institusi === "" &&
      baris.nomorIdentitas === "" &&
      baris.noTelepon === "";
    return hanyaEmailTerisi && /\s/.test(baris.email);
  });
}

/**
 * Slice 6.2a (CACAT 2a) — Fungsi murni. Judul kolom untuk templat CSV yang
 * bisa diunduh admin: email+nama SELALU ada, lalu kolom tambahan HANYA
 * yang formulirPeserta-nya bukan 'tidak' untuk kegiatan ini, ditandai
 * "(wajib)" di judulnya kalau memang wajib. Sumber kebenaran urutan kolom
 * SAMA dengan kolomTambahanUntukFormulir() yang dipakai uraiDaftarHadir() —
 * templat dan pengurai tidak boleh diam-diam berbeda urutan.
 */
export function headerTemplatImporCsv(formulirPeserta: FormulirPeserta): string[] {
  const header = ["email", "nama lengkap"];
  for (const field of kolomTambahanUntukFormulir(formulirPeserta)) {
    const label = LABEL_FIELD_FORMULIR[field];
    header.push(formulirPeserta[field] === "wajib" ? `${label} (wajib)` : label);
  }
  return header;
}

const CONTOH_NILAI_KOLOM_TAMBAHAN: Record<KolomTambahanImpor, string> = {
  institusi: "Dinas ABC",
  nomorIdentitas: "1234567890",
  noTelepon: "081234567890",
};

/**
 * Slice 6.2a (CACAT 2d) — Fungsi murni. Satu baris contoh, bentuk koma,
 * SIAP DISALIN LANGSUNG ke kotak tempel — kolom tambahannya menyesuaikan
 * formulirPeserta kegiatan ini, sama seperti headerTemplatImporCsv(),
 * supaya contohnya tidak pernah menyesatkan (mis. menunjukkan 2 kolom
 * padahal kegiatan ini butuh 4).
 */
export function contohBarisImporCsv(formulirPeserta: FormulirPeserta): string {
  const kolomTambahan = kolomTambahanUntukFormulir(formulirPeserta);
  return ["budi@contoh.com", "Budi Santoso", ...kolomTambahan.map((field) => CONTOH_NILAI_KOLOM_TAMBAHAN[field])].join(
    ","
  );
}
