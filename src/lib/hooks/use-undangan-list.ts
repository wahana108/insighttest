"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapUndangan } from "@/lib/services/user-invitation";
import type { Undangan } from "@/types/undangan";

export function useUndanganList(): { items: Undangan[]; loading: boolean } {
  const [items, setItems] = useState<Undangan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "undangan"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setItems(snapshot.docs.map((item) => mapUndangan(item.id, item.data())));
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
