"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  DEFAULT_SYSTEM_PARAMETER,
  getSystemParameter,
} from "@/lib/services/system-parameter";

const ADMIN_ROLES = ["admin", "superadmin"];

/**
 * Penjaga di sini HANYA untuk pengalaman pengguna (mengalihkan sebelum
 * konten admin sempat dirender). Penegakan sesungguhnya ada di
 * firestore.rules — lihat isAdmin()/isSuperAdmin().
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [platformName, setPlatformName] = useState(DEFAULT_SYSTEM_PARAMETER.namaPlatform);

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

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-6 text-lg font-semibold text-black dark:text-zinc-50">
          {platformName}
        </p>
        <nav className="space-y-1">
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
          <Link
            href="/admin/soal"
            className="block rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Soal
          </Link>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500">
            Masuk sebagai{" "}
            <span className="font-medium text-black dark:text-zinc-50">
              {profile.email}
            </span>{" "}
            ({profile.role})
          </p>
        </header>
        <main className="flex-1 bg-zinc-50 p-6 dark:bg-black">{children}</main>
      </div>
    </div>
  );
}
