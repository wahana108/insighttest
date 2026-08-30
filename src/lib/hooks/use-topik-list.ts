"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapTopik } from "@/lib/services/topik";
import type { Topik } from "@/types/topik";

function byUrutanThenNama(a: Topik, b: Topik): number {
  return a.urutan - b.urutan || a.nama.localeCompare(b.nama);
}

export function useTopikList(): { items: Topik[]; loading: boolean } {
  const [items, setItems] = useState<Topik[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "topik"),
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => mapTopik(item.id, item.data())).sort(byUrutanThenNama)
        );
        setLoading(false);
      },
      () => {
        setItems([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { items, loading };
}
