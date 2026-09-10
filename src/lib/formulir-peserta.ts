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
  };
}

export const LABEL_FIELD_FORMULIR: Record<keyof FormulirPeserta, string> = {
  institusi: "Institusi / asal",
  nomorIdentitas: "Nomor identitas",
  noTelepon: "No. telepon",
};

const URUTAN_FIELD_FORMULIR: (keyof FormulirPeserta)[] = [
  "institusi",
  "nomorIdentitas",
  "noTelepon",
];

export interface DataFormulirPeserta {
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
}

export interface HasilPeriksaFormulirPeserta {
  valid: boolean;
  field: keyof FormulirPeserta | null;
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
