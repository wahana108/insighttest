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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kegiatanId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
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
