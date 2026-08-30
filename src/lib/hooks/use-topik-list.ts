"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapTopik } from "@/lib/services/topik";
import type { Topik } from "@/types/topik";

function byUrutanThenNama(a: Topik, b: Topik): number {
  return a.urutan - b.urutan || a.nama.localeCompare(b.nama);
}

export function useTopikList(): { items: Topik[]; loading: boolean; error: string | null } {
  const [items, setItems] = useState<Topik[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "topik"),
      (snapshot) => {
        setItems(
          snapshot.docs.map((item) => mapTopik(item.id, item.data())).sort(byUrutanThenNama)
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
  }, []);

  return { items, loading, error };
}
