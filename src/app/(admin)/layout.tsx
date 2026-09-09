"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { izinSoal } from "@/lib/izin-soal";
import {
  DEFAULT_SYSTEM_PARAMETER,
  getSystemParameter,
} from "@/lib/services/system-parameter";

const ADMIN_ROLES = ["admin", "superadmin", "panitia"];

/**
 * Penjaga di sini HANYA untuk pengalaman pengguna (mengalihkan sebelum
 * konten admin sempat dirender). Penegakan sesungguhnya ada di
 * firestore.rules (isAdmin()/isSuperAdmin()/panitiaBolehSuntingData()) dan
 * di izinPanitia()/izinSoal() (src/lib/izin-panitia.ts,
 * src/lib/izin-soal.ts) yang dipakai Route Handler — menyembunyikan menu
 * di sini bukan pagar.
 *
 * Slice 8.1: panitia sekarang boleh masuk ke /admin (dulu ditolak sama
 * sekali), tapi hanya melihat Kegiatan di menu — Parameter/Undangan/
 * Pengguna/Topik tetap admin/superadmin saja. Slice 8.2: Soal ikut
 * ditampilkan untuk panitia yang punya users/{uid}.bolehBuatSoal (lihat
 * izinSoal()) — kewenangan bank soal global, bukan per kegiatan.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [platformName, setPlatformName] = useState(DEFAULT_SYSTEM_PARAMETER.namaPlatform);
  // Slice 9.2: sidebar jadi menu buka-tutup di bawah sm: — CSS murni
  // (translate + sm:static), tidak ada library tambahan.
  const [menuTerbuka, setMenuTerbuka] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSystemParameter()
      .then((parameter) => {
        if (mounted) {
          setPlatformName(parameter.namaPlatform);
        }
      })
      .catch(() => {
        // Fallback default tetap dipakai.
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace("/masuk");
      return;
    }
    if (!profile || !ADMIN_ROLES.includes(profile.role)) {
      router.replace("/beranda");
    }
  }, [loading, user, profile, router]);

  const allowed = Boolean(user && profile && ADMIN_ROLES.includes(profile.role));

  if (loading || !allowed || !profile) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Memuat...</p>
      </div>
    );
  }

  const isAdminOrSuper = profile.role === "admin" || profile.role === "superadmin";
  const bisaKelolaSoal = izinSoal(profile).bolehBuat;

  return (
    <div className="flex min-h-screen flex-1">
      {menuTerbuka && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setMenuTerbuka(false)}
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
        />
      )}

      <aside
        className={`${
          menuTerbuka ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r border-zinc-200 bg-white p-4 transition-transform duration-200 ease-in-out sm:static sm:z-auto sm:w-56 sm:shrink-0 sm:translate-x-0 dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <div className="mb-6 flex items-center justify-between">
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{platformName}</p>
          <button
            type="button"
            onClick={() => setMenuTerbuka(false)}
            aria-label="Tutup menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-xl text-zinc-500 sm:hidden dark:text-zinc-400"
          >
            ✕
          </button>
        </div>
        <nav className="space-y-1" onClick={() => setMenuTerbuka(false)}>
          {isAdminOrSuper && (
            <>
              <Link
                href="/admin/parameter"
                className="block rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Parameter
              </Link>
              <Link
                href="/admin/undangan"
                className="block rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Undangan
              </Link>
              <Link
                href="/admin/pengguna"
                className="block rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Pengguna
              </Link>
              <Link
                href="/admin/topik"
                className="block rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Topik
              </Link>
            </>
          )}
          {bisaKelolaSoal && (
            <Link
              href="/admin/soal"
              className="block rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Soal
            </Link>
          )}
          <Link
            href="/admin/kegiatan"
            className="block rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Kegiatan
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-200 bg-white px-4 py-3 sm:px-6 sm:py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setMenuTerbuka(true)}
              aria-label="Buka menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-zinc-300 text-zinc-700 sm:hidden dark:border-zinc-700 dark:text-zinc-300"
            >
              <span className="sr-only">Buka menu</span>
              <span aria-hidden className="space-y-1">
                <span className="block h-0.5 w-5 bg-current" />
                <span className="block h-0.5 w-5 bg-current" />
                <span className="block h-0.5 w-5 bg-current" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="break-words text-sm text-zinc-500">
                Masuk sebagai{" "}
                <span className="font-medium text-black dark:text-zinc-50">
                  {profile.email}
                </span>
                {" — peran aktif: "}
                <span className="font-medium text-black dark:text-zinc-50">{profile.role}</span>
              </p>
              {profile.role === "panitia" && (
                <p className="mt-1 text-xs text-zinc-500">
                  Kewenangan panitia berbeda per kegiatan — buka kegiatan yang ditugaskan untuk
                  melihat persis apa yang bisa Anda lakukan di sana.
                </p>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden bg-zinc-50 p-4 sm:p-6 dark:bg-black">
          {children}
        </main>
      </div>
    </div>
  );
}
