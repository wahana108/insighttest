"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { signOutUser } from "@/lib/auth/session";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { usePendaftaranSaya } from "@/lib/hooks/use-pendaftaran-saya";
import { useSertifikatSaya } from "@/lib/hooks/use-sertifikat-saya";
import { formatDate } from "@/lib/format-date";

const ADMIN_ROLES = ["admin", "superadmin"];

export default function BerandaPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [testingServer, setTestingServer] = useState(false);
  const [serverResult, setServerResult] = useState<string | null>(null);

  const {
    items: kegiatanSayaRaw,
    loading: loadingKegiatanSaya,
    error: kegiatanSayaError,
  } = usePendaftaranSaya();
  // hanyaTerbit: true — pengguna di halaman ini belum tentu admin, dan
  // firestore.rules menolak SELURUH query tanpa where('isPublished','==',true)
  // untuk non-admin (lihat catatan di use-kegiatan-list.ts).
  const { items: kegiatanList } = useKegiatanList({ hanyaTerbit: true });
  const kegiatanJudul = useMemo(() => {
    const map = new Map<string, string>();
    kegiatanList.forEach((item) => map.set(item.id, item.judul));
    return map;
  }, [kegiatanList]);

  const {
    items: sertifikatSaya,
    loading: loadingSertifikatSaya,
    error: sertifikatSayaError,
  } = useSertifikatSaya();

  async function handleTestServer() {
    setTestingServer(true);
    setServerResult(null);
    try {
      const res = await fetchWithAuth("/api/whoami");
      const body = await res.json();
      setServerResult(JSON.stringify({ status: res.status, body }, null, 2));
    } catch (err) {
      setServerResult(err instanceof Error ? err.message : "Gagal memanggil /api/whoami.");
    } finally {
      setTestingServer(false);
    }
  }

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

      <div className="flex gap-4 text-sm">
        <Link href="/profil" className="font-medium text-black underline dark:text-zinc-50">
          Profil
        </Link>
        <Link href="/kegiatan" className="font-medium text-black underline dark:text-zinc-50">
          Jelajahi kegiatan
        </Link>
        {profile && ADMIN_ROLES.includes(profile.role) && (
          <Link href="/admin" className="font-medium text-black underline dark:text-zinc-50">
            Panel Admin
          </Link>
        )}
      </div>

      <div className="w-full max-w-sm space-y-2 rounded-lg border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium text-zinc-500">Kegiatan saya</p>
        {loadingKegiatanSaya && <p className="text-zinc-500">Memuat...</p>}
        {!loadingKegiatanSaya && kegiatanSayaError && (
          <p className="text-red-600">Gagal memuat: {kegiatanSayaError}</p>
        )}
        {!loadingKegiatanSaya && !kegiatanSayaError && kegiatanSayaRaw.length === 0 && (
          <p className="text-zinc-500">Anda belum terdaftar di kegiatan mana pun.</p>
        )}
        {!loadingKegiatanSaya && !kegiatanSayaError && kegiatanSayaRaw.length > 0 && (
          <ul className="space-y-2">
            {kegiatanSayaRaw.map((item) => (
              <li key={item.id} className="border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-900">
                <Link
                  href={`/kegiatan/${item.kegiatanId}`}
                  className="font-medium text-black hover:underline dark:text-zinc-50"
                >
                  {kegiatanJudul.get(item.kegiatanId) ?? item.kegiatanId}
                </Link>
                <p className="text-xs text-zinc-500">
                  Nomor urut {item.nomorUrut} · Daftar {formatDate(item.daftarPada)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="w-full max-w-sm space-y-2 rounded-lg border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium text-zinc-500">Sertifikat saya</p>
        {loadingSertifikatSaya && <p className="text-zinc-500">Memuat...</p>}
        {!loadingSertifikatSaya && sertifikatSayaError && (
          <p className="text-red-600">Gagal memuat: {sertifikatSayaError}</p>
        )}
        {!loadingSertifikatSaya && !sertifikatSayaError && sertifikatSaya.length === 0 && (
          <p className="text-zinc-500">Belum ada sertifikat yang terbit.</p>
        )}
        {!loadingSertifikatSaya && !sertifikatSayaError && sertifikatSaya.length > 0 && (
          <ul className="space-y-2">
            {sertifikatSaya.map((item) => (
              <li
                key={item.id}
                className="border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-900"
              >
                <Link
                  href={`/sertifikat/${item.id}`}
                  className="font-medium text-black hover:underline dark:text-zinc-50"
                >
                  {item.judulKegiatan}
                </Link>
                <p className="text-xs text-zinc-500">
                  {item.serial} · Terbit {formatDate(item.terbitPada)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="w-full max-w-sm space-y-2">
        <button
          type="button"
          onClick={handleTestServer}
          disabled={testingServer}
          className="w-full rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
        >
          {testingServer ? "Menguji..." : "Uji koneksi server"}
        </button>
        {serverResult && (
          <pre className="overflow-x-auto rounded border border-zinc-200 bg-white p-3 text-left text-xs text-black dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
            {serverResult}
          </pre>
        )}
      </div>

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
