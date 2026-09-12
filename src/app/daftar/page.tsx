"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { registerWithEmail, registerWithoutPassword, signInWithGoogle } from "@/lib/auth/session";
import { PESAN_KUOTA_HARIAN_PENUH } from "@/lib/kuota-peserta";
import {
  PESAN_TANPA_SANDI_SUKSES,
  pendaftaranTanpaSandiAktif,
} from "@/lib/pendaftaran-tanpa-sandi";
import { DEFAULT_SYSTEM_PARAMETER, getSystemParameter } from "@/lib/services/system-parameter";
import type { SystemParameter } from "@/types/parameter";

export default function DaftarPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sukses, setSukses] = useState(false);

  // Slice "daftar-tanpa-sandi" — parameter dibaca SEKALI saat halaman
  // dimuat dan dioper apa adanya ke registerWithoutPassword() (pola yang
  // sama dengan completeRegistration() di session.ts: baca sekali,
  // jangan baca ulang di dalam fungsi turunannya).
  const [parameter, setParameter] = useState<SystemParameter | null>(null);
  const [kuotaPenuh, setKuotaPenuh] = useState(false);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSystemParameter()
      .then(async (next) => {
        if (!mounted) return;
        setParameter(next);
        if (pendaftaranTanpaSandiAktif(next)) {
          try {
            const res = await fetch("/api/kuota-hari-ini");
            const body = await res.json();
            if (mounted) setKuotaPenuh(res.ok && body?.penuh === true);
          } catch (err) {
            // Gagal memeriksa kuota BUKAN alasan menutup formulir — kalau
            // memang penuh, server tetap menolak saat pendaftaran
            // sesungguhnya dikirim (penjaga ini hanya kenyamanan, item 6).
            // TAPI kegagalan ini tidak boleh ditelan TOTAL tanpa jejak —
            // console.error di sini supaya "gagal-terbuka karena jaringan"
            // bisa dibedakan dari "memang sedang tidak penuh" saat men-debug.
            console.error("Gagal memeriksa /api/kuota-hari-ini:", err);
          }
        }
        if (mounted) setMemuat(false);
      })
      .catch(() => {
        if (mounted) {
          setParameter(DEFAULT_SYSTEM_PARAMETER);
          setMemuat(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const tanpaSandiAktif = parameter ? pendaftaranTanpaSandiAktif(parameter) : false;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerWithEmail(email, password, displayName);
      router.push("/beranda");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitTanpaSandi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parameter) return;
    // Lapis kedua, BUKAN cuma atribut `disabled` di tombol (§5/§diagnosis):
    // implicit submission (Enter di kolom teks), balapan render, atau
    // klik yang lolos sebelum state ter-render ulang tidak boleh bisa
    // melewati penjaga ini.
    if (kuotaPenuh) {
      setError(PESAN_KUOTA_HARIAN_PENUH);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await registerWithoutPassword(email, displayName, parameter);
      // TIDAK router.push("/beranda") — registerWithoutPassword() SELALU
      // mengeluarkan pengguna (lihat komentarnya di session.ts). Tetap di
      // halaman ini dan tampilkan pesan, sama untuk kedua kemungkinan
      // (pendaftar baru ATAU email yang sudah terdaftar).
      setSukses(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    // Diagnosis: tombol ini SEBELUMNYA tidak pernah memeriksa kuotaPenuh
    // sama sekali — orang bisa membuat akun lewat Google kapan pun,
    // terlepas dari kuota harian. Penjaga di sini berlaku HANYA saat
    // tanpaSandiAktif (sama seperti formulir email di atas) — Google
    // Sign-In sendiri (fungsinya) tidak disentuh, cuma gerbangnya.
    if (tanpaSandiAktif && kuotaPenuh) {
      setError(PESAN_KUOTA_HARIAN_PENUH);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.push("/beranda");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar dengan Google.");
    } finally {
      setSubmitting(false);
    }
  }

  if (memuat) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Daftar</h1>

        {sukses ? (
          <p className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {PESAN_TANPA_SANDI_SUKSES}
          </p>
        ) : tanpaSandiAktif ? (
          <form onSubmit={handleSubmitTanpaSandi} className="space-y-4">
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Nama lengkap
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>

            {kuotaPenuh && <p className="text-sm text-red-600">{PESAN_KUOTA_HARIAN_PENUH}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || kuotaPenuh}
              className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? "Mendaftar..." : "Daftar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Nama
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Kata sandi
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Daftar
            </button>
          </form>
        )}

        {!sukses && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting || (tanpaSandiAktif && kuotaPenuh)}
            className="w-full rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            Daftar dengan Google
          </button>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sudah punya akun?{" "}
          <Link href="/masuk" className="font-medium text-black underline dark:text-zinc-50">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
