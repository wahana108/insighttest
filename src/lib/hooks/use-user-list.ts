"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { mapUserProfile } from "@/lib/auth/user-profile";
import type { UserProfile } from "@/types/user";

export function useUserList(): { items: UserProfile[]; loading: boolean } {
  const [items, setItems] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setItems(snapshot.docs.map((item) => mapUserProfile(item.id, item.data())));
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
