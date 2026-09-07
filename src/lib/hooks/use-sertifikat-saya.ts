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
  // Nilai awal sudah mencerminkan keadaan yang benar untuk user saat mount
  // pertama — kalau belum masuk, tidak ada yang dimuat.
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // user atau reloadToken berubah tanpa remount — sesuaikan keadaan di sini
  // saat render (bukan di badan efek), lihat use-soal-list.ts.
  const [permintaanSebelumnya, setPermintaanSebelumnya] = useState({ user, reloadToken });
  if (permintaanSebelumnya.user !== user || permintaanSebelumnya.reloadToken !== reloadToken) {
    setPermintaanSebelumnya({ user, reloadToken });
    if (user) {
      setLoading(true);
      setError(null);
    } else {
      setItems([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      return;
    }
    let mounted = true;
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
