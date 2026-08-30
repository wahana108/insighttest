"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapSoal } from "@/lib/services/soal";
import type { Soal } from "@/types/soal";

function byCreatedAtDesc(a: Soal, b: Soal): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function useSoalList(topikKode?: string): { items: Soal[]; loading: boolean } {
  const [items, setItems] = useState<Soal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const ref = collection(db, "soal");
    const target = topikKode ? query(ref, where("topikKode", "==", topikKode)) : ref;
    const unsubscribe = onSnapshot(
      target,
      (snapshot) => {
        setItems(snapshot.docs.map((item) => mapSoal(item.id, item.data())).sort(byCreatedAtDesc));
        setLoading(false);
      },
      () => {
        setItems([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [topikKode]);

  return { items, loading };
}
