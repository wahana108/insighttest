"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [connected, setConnected] = useState<boolean | null>(null);
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        InsightTest
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
    </div>
  );
}
