"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import type { SertifikatRingkas } from "@/types/sertifikat";

/**
 * sertifikat/{id} hanya boleh dibaca/ditulis lewat server — hook ini
 * memanggil GET /api/sertifikat/saya lewat fetchWithAuth, bukan onSnapshot
 * langsung (sama seperti use-pendaftaran-saya.ts).
 */
export function useSertifikatSaya(): {
  items: SertifikatRingkas[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const { user } = useAuth();
  const [items, setItems] = useState<SertifikatRingkas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    fetchWithAuth("/api/sertifikat/saya")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof body?.error === "string" ? body.error : "Gagal memuat sertifikat."
          );
        }
        if (mounted) {
          setItems(Array.isArray(body.items) ? body.items : []);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Gagal memuat sertifikat.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [user, reloadToken]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { items, loading, error, refetch };
}
