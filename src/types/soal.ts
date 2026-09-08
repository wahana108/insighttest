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
  /**
   * Slice 8.2: kepemilikan — diisi SEKALI saat pembuatan, tidak pernah bisa
   * diubah sesudahnya (dijaga firestore.rules, bukan cuma di sini). Beda
   * dari createdBy: createdBy murni jejak audit umum (pola yang sama di
   * kegiatan/modul); dibuatOleh adalah field yang DIPERIKSA rules untuk
   * memutuskan siapa boleh menyunting soal ini. Soal lama (sebelum slice
   * ini) tidak punya field ini sama sekali — string kosong lewat
   * .get('dibuatOleh', ''), diperlakukan sebagai milik admin (KA-1).
   */
  dibuatOleh: string;
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
