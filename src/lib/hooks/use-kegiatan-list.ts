"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapKegiatan } from "@/lib/services/kegiatan";
import type { Kegiatan } from "@/types/kegiatan";

function byCreatedAtDesc(a: Kegiatan, b: Kegiatan): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export interface UseKegiatanListOptions {
  /**
   * firestore.rules mengizinkan baca kegiatan/{id} kalau isPublished true
   * ATAU pengguna admin. Rules Firestore BUKAN penyaring — untuk `list`,
   * Firestore harus bisa membuktikan aturan berlaku pada SELURUH hasil
   * query tanpa membacanya dulu; kalau tidak bisa, seluruh query ditolak,
   * bukan disaring diam-diam. Admin lolos karena isAdmin() tidak bergantung
   * pada resource.data (query apa pun terbukti aman). Peserta TIDAK lolos
   * kecuali query-nya sendiri menyertakan where('isPublished','==',true),
   * supaya Firestore bisa membuktikan setiap hasil sudah pasti isPublished.
   * Set hanyaTerbit: true di halaman non-admin.
   */
  hanyaTerbit?: boolean;
  /**
   * Slice 8.1: panitia hanya boleh membaca kegiatan yang ditugaskan padanya
   * (firestore.rules, panitiaDitugaskanData()) — sama seperti hanyaTerbit di
   * atas, itu PROVABLE untuk list hanya kalau query-nya sendiri menyertakan
   * where('panitiaUids','array-contains', uid). Set ke uid panitia yang
   * sedang masuk di /admin/kegiatan untuknya; abaikan untuk admin/superadmin
   * (mereka melihat semua kegiatan tanpa filter ini).
   */
  untukPanitiaUid?: string;
}

export function useKegiatanList(options: UseKegiatanListOptions = {}): {
  items: Kegiatan[];
  loading: boolean;
  error: string | null;
} {
  const { hanyaTerbit = false, untukPanitiaUid } = options;
  const [items, setItems] = useState<Kegiatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Opsi berubah tanpa remount — kembali ke "sedang memuat" di sini, bukan
  // di badan efek (lihat use-soal-list.ts untuk penjelasan pola ini).
  const [opsiSebelumnya, setOpsiSebelumnya] = useState({ hanyaTerbit, untukPanitiaUid });
  if (
    opsiSebelumnya.hanyaTerbit !== hanyaTerbit ||
    opsiSebelumnya.untukPanitiaUid !== untukPanitiaUid
  ) {
    setOpsiSebelumnya({ hanyaTerbit, untukPanitiaUid });
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    const ref = collection(db, "kegiatan");
    const target = untukPanitiaUid
      ? query(ref, where("panitiaUids", "array-contains", untukPanitiaUid))
      : hanyaTerbit
        ? query(ref, where("isPublished", "==", true))
        : ref;
    const unsubscribe = onSnapshot(
      target,
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => mapKegiatan(item.id, item.data())).sort(byCreatedAtDesc)
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        setItems([]);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [hanyaTerbit, untukPanitiaUid]);

  return { items, loading, error };
}
