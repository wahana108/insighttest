"use client";

import { useState } from "react";

/**
 * Slice "gambar-soal" (docs/kickoff.md §S "Slice 7") — satu komponen
 * dipakai ulang di semua tempat yang MENAMPILKAN gambar bertaut-URL (soal,
 * opsi jawaban, sampul kegiatan): runner ujian, halaman kegiatan, katalog
 * /kegiatan. Sejak Slice "validasi-gambar" (7a) DIPAKAI ULANG juga di form
 * admin (/admin/soal, /admin/kegiatan/[id]) lewat prop onGagal/onMuat di
 * bawah — pratinjau form dan tampilan peserta jadi SATU implementasi yang
 * sama, bukan dua <img> terpisah.
 *
 * ATURAN TAMPILAN yang mengikat: gambar gagal dimuat TIDAK BOLEH merusak
 * apa pun di sekitarnya — dirender sebagai null begitu <img> memicu
 * onError, bukan ikon rusak bawaan browser, supaya peserta di jaringan
 * buruk tetap bisa membaca teks dan menjawab. max-w-full mencegah gambar
 * memaksa halaman digeser mendatar di layar sempit (390px, aturan 9.1).
 */
export function GambarAman({
  src,
  alt,
  className,
  loading,
  onGagal,
  onMuat,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /**
   * Slice "validasi-gambar" (7a) — opsional, HANYA dipakai form admin untuk
   * menampilkan status "gambar tidak bisa dimuat" di sebelah isian
   * urlGambar. Halaman ujian/katalog TIDAK mengoper prop ini — perilaku
   * defaultnya (merender null begitu gagal, tanpa memberi tahu siapa pun)
   * tidak berubah sama sekali.
   *
   * CATATAN PEMANGGIL: state `gagal` di bawah TIDAK reset otomatis kalau
   * `src` berganti pada instance yang sama (proyek ini melarang setState di
   * dalam effect, react-hooks/set-state-in-effect) — pemanggil yang ingin
   * menilai ulang tautan yang baru diketik HARUS memberi `key={src}` supaya
   * React memasang instance baru. usePratinjauGambarStatus() di bawah
   * mengasumsikan pemanggilnya melakukan ini.
   */
  onGagal?: () => void;
  /** Pasangan onGagal — dipanggil saat gambar yang sama berhasil dimuat. */
  onMuat?: () => void;
}) {
  const [gagal, setGagal] = useState(false);

  if (!src.trim() || gagal) {
    return null;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={`max-w-full ${className ?? ""}`}
      onError={() => {
        setGagal(true);
        onGagal?.();
      }}
      onLoad={() => onMuat?.()}
    />
  );
}

export type StatusPratinjauGambar = "kosong" | "memeriksa" | "ditemukan" | "gagal";

/**
 * Slice "validasi-gambar" (7a) — status pemeriksaan gambar untuk form admin
 * (isian urlGambar soal, opsi, sampul kegiatan, template sertifikat).
 * Dipakai bersama src/app/(admin)/admin/soal/page.tsx dan
 * src/app/(admin)/admin/kegiatan/[id]/page.tsx supaya keduanya tidak
 * menulis ulang logika yang sama. Murni di peramban (lewat GambarAman di
 * atas), tidak memanggil server, tidak memblokir penyimpanan — hanya
 * memberi tahu lewat status yang dikembalikan.
 *
 * TIDAK memakai useEffect (proyek ini melarang setState di dalam effect,
 * react-hooks/set-state-in-effect) — dipakai pola resmi React "Adjusting
 * some state when a prop changes": membandingkan `src` dengan nilai
 * sebelumnya SELAMA render, dan hanya memanggil setState kalau beda.
 * PEMANGGIL tetap wajib memberi `key={src}` pada elemen GambarAman-nya
 * (lihat catatan di GambarAman di atas) supaya `gagal` internalnya ikut
 * mereset bersamaan dengan status di sini.
 */
export function usePratinjauGambarStatus(src: string): {
  status: StatusPratinjauGambar;
  onMuat: () => void;
  onGagal: () => void;
} {
  const [srcSebelumnya, setSrcSebelumnya] = useState(src);
  const [status, setStatus] = useState<StatusPratinjauGambar>(src.trim() ? "memeriksa" : "kosong");
  if (src !== srcSebelumnya) {
    setSrcSebelumnya(src);
    setStatus(src.trim() ? "memeriksa" : "kosong");
  }
  return {
    status,
    onMuat: () => setStatus("ditemukan"),
    onGagal: () => setStatus("gagal"),
  };
}
