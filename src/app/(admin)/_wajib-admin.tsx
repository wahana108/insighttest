"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { izinSoal } from "@/lib/izin-soal";

/**
 * Slice 8.1: (admin)/layout.tsx sekarang membiarkan panitia MASUK ke /admin
 * (dulu ditolak sama sekali) supaya bisa melihat kegiatan yang ditugaskan —
 * tapi Parameter/Undangan/Pengguna/Topik TETAP admin/superadmin saja,
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

/**
 * Slice 8.2: /admin/soal dan /admin/soal/impor BUKAN admin/superadmin saja
 * lagi — panitia dengan users/{uid}.bolehBuatSoal juga boleh masuk (lihat
 * izinSoal(), src/lib/izin-soal.ts, satu sumber kebenaran yang sama dipakai
 * firestore.rules lewat bolehBuatSoalUser()). Panitia TANPA bolehBuatSoal
 * tetap dialihkan, sama seperti WajibAdmin di atas — cuma penjaga
 * pengalaman pengguna, pagar sesungguhnya tetap firestore.rules.
 */
export function WajibBolehBuatSoal({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const allowed = izinSoal(profile).bolehBuat;

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
