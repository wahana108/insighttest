export type TipeSoal = "pilihan_ganda";

export type TingkatSoal = "mudah" | "sedang" | "sulit";

export interface OpsiSoal {
  id: string;
  label: string;
}

export interface Soal {
  id: string;
  teks: string;
  tipe: TipeSoal;
  topikKode: string;
  tingkat: TingkatSoal;
  opsi: OpsiSoal[];
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Terpisah dari Soal dengan sengaja — opsi di Soal tidak pernah membawa
 * penanda benar/salah. Lihat KA-3, docs/arsitektur.md.
 */
export interface KunciSoal {
  opsiBenarId: string;
  pembahasan: string;
}
