"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-provider";

/**
 * Slice 8.1: (admin)/layout.tsx sekarang membiarkan panitia MASUK ke /admin
 * (dulu ditolak sama sekali) supaya bisa melihat kegiatan yang ditugaskan —
 * tapi Parameter/Undangan/Pengguna/Topik/Soal TETAP admin/superadmin saja,
 * bahkan kalau panitia mengetik URL-nya langsung (menu yang disembunyikan
 * di layout bukan pagar). Dipakai membungkus halaman-halaman itu.
 *
 * Ini juga cuma penjaga pengalaman pengguna, sama seperti catatan di
 * (admin)/layout.tsx — pagar sesungguhnya tetap firestore.rules (isAdmin()).
 */
export function WajibAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const allowed = profile?.role === "admin" || profile?.role === "superadmin";

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/admin/kegiatan");
    }
  }, [loading, allowed, router]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Memuat...</p>
      </div>
    );
  }

  return <>{children}</>;
}
