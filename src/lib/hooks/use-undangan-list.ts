"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapUndangan } from "@/lib/services/user-invitation";
import type { Undangan } from "@/types/undangan";

export function useUndanganList(): {
  items: Undangan[];
  loading: boolean;
  error: string | null;
} {
  const [items, setItems] = useState<Undangan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "undangan"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setItems(snapshot.docs.map((item) => mapUndangan(item.id, item.data())));
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
