import type { FormulirPeserta, StatusFieldFormulir } from "@/types/kegiatan";

/**
 * Kegiatan lama tidak punya formulirPeserta sama sekali (Slice 6.1). Bawaan
 * HARUS 'tidak' untuk ketiga field, bukan 'opsional' — sebelum slice ini,
 * halaman pendaftaran (src/app/kegiatan/[id]/page.tsx) tidak menampilkan
 * institusi/nomorIdentitas/noTelepon sama sekali dan POST /api/pendaftaran
 * tidak pernah mensyaratkannya. 'tidak' membuat kegiatan lama berperilaku
 * PERSIS seperti sekarang; admin/panitia yang menyunting kegiatan (bahkan
 * tanpa menyentuh blok ini) hanya memaskukkan bawaan yang sama, tidak
 * pernah mengubah perilaku diam-diam.
 */
export const FORMULIR_PESERTA_DEFAULT: FormulirPeserta = {
  institusi: "tidak",
  nomorIdentitas: "tidak",
  noTelepon: "tidak",
  bolehDilengkapiSendiri: false,
};

function isStatusFieldFormulir(value: unknown): value is StatusFieldFormulir {
  return value === "tidak" || value === "opsional" || value === "wajib";
}

export function mapFormulirPeserta(value: unknown): FormulirPeserta {
  const data = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    institusi: isStatusFieldFormulir(data.institusi) ? data.institusi : "tidak",
    nomorIdentitas: isStatusFieldFormulir(data.nomorIdentitas) ? data.nomorIdentitas : "tidak",
    noTelepon: isStatusFieldFormulir(data.noTelepon) ? data.noTelepon : "tidak",
    // Slice "lengkapi-sendiri" (6f) — KA-1, lihat komentar FormulirPeserta.bolehDilengkapiSendiri.
    bolehDilengkapiSendiri: data.bolehDilengkapiSendiri === true,
  };
}

export interface DataFormulirPeserta {
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
}

// Record<keyof DataFormulirPeserta, ...> (BUKAN keyof FormulirPeserta) —
// bolehDilengkapiSendiri (Slice 6f) bukan kolom data seperti tiga field ini,
// ia saklar perilaku importir, jadi sengaja TIDAK ikut di sini maupun di
// URUTAN_FIELD_FORMULIR/periksaFormulirPeserta() di bawah.
export const LABEL_FIELD_FORMULIR: Record<keyof DataFormulirPeserta, string> = {
  institusi: "Institusi / asal",
  nomorIdentitas: "Nomor identitas",
  noTelepon: "No. telepon",
};

const URUTAN_FIELD_FORMULIR: (keyof DataFormulirPeserta)[] = [
  "institusi",
  "nomorIdentitas",
  "noTelepon",
];

export interface HasilPeriksaFormulirPeserta {
  valid: boolean;
  field: keyof DataFormulirPeserta | null;
  pesan: string | null;
}

/**
 * Penegakan sesungguhnya dipanggil di server (POST /api/pendaftaran) —
 * pemeriksaan di klien (src/app/kegiatan/[id]/page.tsx) hanya kenyamanan.
 * Fungsi murni, tidak menyentuh Firestore, supaya keduanya memakai aturan
 * yang SAMA persis. Hanya memeriksa field 'wajib' yang kosong; field
 * 'opsional' dan 'tidak' tidak pernah menolak apa pun.
 */
export function periksaFormulirPeserta(
  formulirPeserta: FormulirPeserta,
  data: DataFormulirPeserta
): HasilPeriksaFormulirPeserta {
  for (const field of URUTAN_FIELD_FORMULIR) {
    if (formulirPeserta[field] === "wajib" && !data[field].trim()) {
      return {
        valid: false,
        field,
        pesan: `${LABEL_FIELD_FORMULIR[field]} wajib diisi sebelum mendaftar ke kegiatan ini.`,
      };
    }
  }
  return { valid: true, field: null, pesan: null };
}

export interface HasilIdentitasPendaftaran {
  lengkap: boolean;
  kurang: (keyof DataFormulirPeserta)[];
  pesan: string | null;
}

/**
 * Slice "lengkapi-sendiri" (6f) — gerbang WAJIB di POST /api/attempt dan
 * POST /api/modul/dibuka, sebelum peserta boleh mengerjakan/membuka modul.
 *
 * identitasBelumLengkap !== true -> SELALU lengkap, TIDAK ADA pemeriksaan
 * sama sekali — ini pagar anti-surut: pendaftaran mandiri (field ini tidak
 * pernah ditulis), pendaftaran lama (field ini tidak ada — dibaca sebagai
 * undefined, KA-1), dan pendaftaran impor yang datanya sudah lengkap sejak
 * awal (bolehDilengkapiSendiri true tapi kolom wajibnya sudah terisi di
 * tempelan) semuanya TIDAK PERNAH menyentuh periksaFormulirPeserta() di
 * bawah, apa pun isi profil mereka.
 *
 * true -> pakai periksaFormulirPeserta() yang SUDAH ADA (logika
 * wajib-dan-kosong-nya TIDAK ditulis ulang di sini) terhadap profil
 * users/{uid} SAAT INI (bukan snapshot impor) — dipanggil BERULANG,
 * masing-masing pemanggilan menandai SATU field yang masih kosong sebagai
 * "terisi sementara" di salinan lokal, supaya pemanggilan berikutnya bisa
 * menemukan field wajib LAIN yang juga masih kosong. Ini bukan menulis
 * ulang logikanya — hanya memanggilnya berkali-kali untuk mengumpulkan
 * SEMUA field yang kurang (periksaFormulirPeserta() sendiri sengaja
 * berhenti di field PERTAMA, karena dipakai juga untuk gerbang pendaftaran
 * yang cukup tahu SATU alasan penolakan).
 */
export function putuskanIdentitasPendaftaran(params: {
  identitasBelumLengkap: boolean | undefined;
  formulirPeserta: FormulirPeserta;
  profil: DataFormulirPeserta;
}): HasilIdentitasPendaftaran {
  if (params.identitasBelumLengkap !== true) {
    return { lengkap: true, kurang: [], pesan: null };
  }

  const kurang: (keyof DataFormulirPeserta)[] = [];
  const profilSementara: DataFormulirPeserta = { ...params.profil };
  let hasil = periksaFormulirPeserta(params.formulirPeserta, profilSementara);
  while (!hasil.valid && hasil.field) {
    kurang.push(hasil.field);
    // Tandai "terisi" di salinan LOKAL saja (bukan profil sungguhan) supaya
    // periksaFormulirPeserta() berikutnya melompati field ini dan
    // menemukan field wajib lain yang masih kosong.
    profilSementara[hasil.field] = "(ditandai terisi sementara untuk pemeriksaan)";
    hasil = periksaFormulirPeserta(params.formulirPeserta, profilSementara);
  }

  if (kurang.length === 0) {
    return { lengkap: true, kurang: [], pesan: null };
  }
  const daftar = kurang.map((field) => LABEL_FIELD_FORMULIR[field]).join(", ");
  return {
    lengkap: false,
    kurang,
    pesan: `Lengkapi dulu data berikut di halaman profil sebelum mengerjakan: ${daftar}.`,
  };
}
