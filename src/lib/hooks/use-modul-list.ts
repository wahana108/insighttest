"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapModul } from "@/lib/services/modul";
import type { ModulKegiatan } from "@/types/kegiatan";

function byUrutanThenJudul(a: ModulKegiatan, b: ModulKegiatan): number {
  return a.urutan - b.urutan || a.judul.localeCompare(b.judul);
}

export function useModulList(kegiatanId: string | null): {
  items: ModulKegiatan[];
  loading: boolean;
  error: string | null;
} {
  const [items, setItems] = useState<ModulKegiatan[]>([]);
  // Nilai awal sudah mencerminkan keadaan yang benar untuk kegiatanId saat
  // mount pertama — kalau null, tidak ada yang dimuat, jadi loading awal
  // langsung false (bukan disetel balik lewat efek).
  const [loading, setLoading] = useState(Boolean(kegiatanId));
  const [error, setError] = useState<string | null>(null);

  // kegiatanId berubah tanpa remount — sesuaikan keadaan di sini saat
  // render (bukan di badan efek), lihat use-soal-list.ts.
  const [kegiatanIdSebelumnya, setKegiatanIdSebelumnya] = useState(kegiatanId);
  if (kegiatanIdSebelumnya !== kegiatanId) {
    setKegiatanIdSebelumnya(kegiatanId);
    if (kegiatanId) {
      setLoading(true);
      setError(null);
    } else {
      setItems([]);
      setLoading(false);
      setError(null);
    }
  }

  useEffect(() => {
    if (!kegiatanId) {
      return;
    }
    const unsubscribe = onSnapshot(
      collection(db, "kegiatan", kegiatanId, "modul"),
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => mapModul(item.id, item.data())).sort(byUrutanThenJudul)
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
  }, [kegiatanId]);

  return { items, loading, error };
}
