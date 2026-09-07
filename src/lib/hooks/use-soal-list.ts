"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapSoal } from "@/lib/services/soal";
import type { Soal } from "@/types/soal";

function byCreatedAtDesc(a: Soal, b: Soal): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function useSoalList(topikKode?: string): {
  items: Soal[];
  loading: boolean;
  error: string | null;
} {
  const [items, setItems] = useState<Soal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // topikKode berubah tanpa remount (dipakai lewat filter dropdown) — begitu
  // terjadi, kembali ke "sedang memuat" di sini (bukan di badan efek di
  // bawah), lihat https://react.dev/learn/you-might-not-need-an-effect
  // #adjusting-some-state-when-a-prop-changes. Mount pertama tidak perlu
  // penyetelan ini karena nilai awal loading sudah true.
  const [topikKodeSebelumnya, setTopikKodeSebelumnya] = useState(topikKode);
  if (topikKodeSebelumnya !== topikKode) {
    setTopikKodeSebelumnya(topikKode);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    const ref = collection(db, "soal");
    const target = topikKode ? query(ref, where("topikKode", "==", topikKode)) : ref;
    const unsubscribe = onSnapshot(
      target,
      (snapshot) => {
        setItems(snapshot.docs.map((item) => mapSoal(item.id, item.data())).sort(byCreatedAtDesc));
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
  }, [topikKode]);

  return { items, loading, error };
}
