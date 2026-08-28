"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { signOutUser } from "@/lib/auth/session";

const ADMIN_ROLES = ["admin", "superadmin"];

export default function BerandaPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutUser();
    router.push("/masuk");
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Memuat...</p>
      </div>
    );
  }

  if (profile && (profile.status === "pending" || profile.status === "nonaktif")) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-black">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          {profile.status === "pending"
            ? "Menunggu persetujuan admin"
            : "Akun dinonaktifkan"}
        </h1>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          {profile.status === "pending"
            ? "Akun Anda sudah terdaftar dan sedang menunggu persetujuan admin. Anda akan bisa masuk setelah disetujui."
            : "Akun Anda telah dinonaktifkan. Hubungi admin apabila Anda merasa ini keliru."}
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Keluar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Beranda</h1>

      <div className="w-full max-w-sm space-y-2 rounded-lg border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p>
          <span className="font-medium text-zinc-500">Email: </span>
          <span className="text-black dark:text-zinc-50">
            {profile?.email ?? user.email}
          </span>
        </p>
        <p>
          <span className="font-medium text-zinc-500">Role: </span>
          <span className="text-black dark:text-zinc-50">{profile?.role ?? "-"}</span>
        </p>
        <p>
          <span className="font-medium text-zinc-500">Status: </span>
          <span className="text-black dark:text-zinc-50">{profile?.status ?? "-"}</span>
        </p>
      </div>

      {profile && ADMIN_ROLES.includes(profile.role) && (
        <Link
          href="/admin"
          className="text-sm font-medium text-black underline dark:text-zinc-50"
        >
          Panel Admin
        </Link>
      )}

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        Keluar
      </button>
    </div>
  );
}
