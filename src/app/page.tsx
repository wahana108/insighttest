"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEFAULT_SYSTEM_PARAMETER,
  getSystemParameter,
} from "@/lib/services/system-parameter";

export default function Home() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [platformName, setPlatformName] = useState(DEFAULT_SYSTEM_PARAMETER.namaPlatform);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "(belum diset)";

  useEffect(() => {
    let mounted = true;
    import("@/lib/firebase/client")
      .then(({ app }) => {
        if (mounted) setConnected(Boolean(app));
      })
      .catch(() => {
        if (mounted) setConnected(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        {platformName}
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Project: <span className="font-mono">{projectId}</span>
      </p>
      <p
        className={
          connected === null
            ? "text-zinc-500"
            : connected
              ? "text-green-600"
              : "text-red-600"
        }
      >
        {connected === null
          ? "Memeriksa koneksi Firebase..."
          : connected
            ? "Firebase terhubung"
            : "Firebase gagal"}
      </p>
      <div className="flex gap-4">
        <Link
          href="/masuk"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Masuk
        </Link>
        <Link
          href="/daftar"
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Daftar
        </Link>
      </div>
    </div>
  );
}
