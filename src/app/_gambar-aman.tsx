"use client";

import { useState } from "react";

/**
 * Slice "gambar-soal" (docs/kickoff.md §S "Slice 7") — satu komponen
 * dipakai ulang di semua tempat yang MENAMPILKAN gambar bertaut-URL (soal,
 * opsi jawaban, sampul kegiatan): runner ujian, halaman kegiatan, katalog
 * /kegiatan. Bukan dipakai di form admin — form punya pratinjau + validasi
 * sendiri (periksaUrlGambar()), lihat FieldUrlGambar di
 * src/app/(admin)/admin/kegiatan/[id]/page.tsx.
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
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
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
      onError={() => setGagal(true)}
    />
  );
}
