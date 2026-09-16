export type TipeSoal = "pilihan_ganda";

export type TingkatSoal = "mudah" | "sedang" | "sulit";

export interface OpsiSoal {
  id: string;
  label: string;
  /**
   * Slice "gambar-soal" — opsional, string kosong berarti tidak ada gambar
   * (KA-1, sama pola dengan urlGambar di Soal di bawah). Teks alternatifnya
   * SELALU label opsi ini sendiri — TIDAK ADA field deskripsi baru.
   */
  urlGambar: string;
}

export interface Soal {
  id: string;
  teks: string;
  tipe: TipeSoal;
  topikKode: string;
  tingkat: TingkatSoal;
  opsi: OpsiSoal[];
  /**
   * Slice "gambar-soal" (docs/kickoff.md §S "Slice 7") — opsional, string
   * kosong berarti tidak ada gambar (KA-1: soal lama tanpa field ini sama
   * sekali dibaca sebagai ""). KA-8 berlaku PENUH: tautan URL saja, tidak
   * pernah diunggah — divalidasi lewat periksaUrlGambar() (src/lib/validasi-url-gambar.ts)
   * di validasiSoal() (src/lib/services/soal.ts), satu gerbang yang dipakai
   * BERSAMA oleh form manual DAN importer massal (src/lib/services/soal-import.ts).
   * Tampil di ATAS teks soal saat dikerjakan (src/app/kegiatan/[id]/modul/[modulId]/page.tsx)
   * dan di pratinjau admin. Teks alternatifnya SELALU teks soal ini sendiri
   * — TIDAK ADA field deskripsi baru (aturan tampilan slice ini).
   */
  urlGambar: string;
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
