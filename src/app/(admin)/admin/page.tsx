"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  DEFAULT_SYSTEM_PARAMETER,
  getSystemParameter,
} from "@/lib/services/system-parameter";

export default function AdminIndexPage() {
  const { profile } = useAuth();
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

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          {platformName}
        </h1>
        <p className="text-sm text-zinc-500">Peran: {profile?.role ?? "-"}</p>
      </div>

      <nav className="space-y-1">
        <Link
          href="/admin/parameter"
          className="block rounded border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Parameter
        </Link>
      </nav>
    </div>
  );
}
