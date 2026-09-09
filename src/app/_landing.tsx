"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { DEFAULT_SYSTEM_PARAMETER, getSystemParameter } from "@/lib/services/system-parameter";

/**
 * "/" — sudah masuk: dialihkan ke /beranda. Belum masuk: halaman landing
 * (Slice 9.3 §1), bukan lagi lempar langsung ke /masuk tanpa penjelasan.
 *
 * namaPlatform dibaca dari parameter/global (firestore.rules mengizinkan
 * baca publik tanpa syarat untuk dokumen ini — lihat komentar di sana),
 * jadi aman dipanggil di sini walau pengunjung belum login. Kalau gagal
 * dimuat (offline, dsb.), DEFAULT_SYSTEM_PARAMETER.namaPlatform dipakai.
 */
export function LandingAtauBeranda() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [platformName, setPlatformName] = useState(DEFAULT_SYSTEM_PARAMETER.namaPlatform);
  const [kode, setKode] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/beranda");
    }
  }, [loading, user, router]);

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

  // Hanya menyusun URL lalu menavigasi — TIDAK PERNAH membaca Firestore
  // maupun memanggil API apa pun di sini. Validasi kode sepenuhnya jadi
  // urusan halaman /s/[kode] sendiri (§1c, Slice 9.3).
  function handlePeriksa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kodeBersih = kode.trim();
    if (!kodeBersih) {
      return;
    }
    router.push(`/s/${encodeURIComponent(kodeBersih)}`);
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Memuat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-12 sm:py-16">
        <section className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
            {platformName}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Platform evaluasi yang menerbitkan sertifikat yang bisa diverifikasi publik.
          </p>
        </section>

        {/* Kotak verifikasi — bagian terpenting halaman ini (§1c): satu-
            satunya fungsi yang berguna bagi orang tanpa akun sama sekali.
            Diberi border tebal supaya menonjol, ditaruh di dekat awal
            halaman, bukan di kaki. */}
        <section className="rounded-lg border-2 border-black bg-white p-5 sm:p-6 dark:border-white dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            Periksa keaslian sertifikat
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Menerima sertifikat dari platform ini dan ingin memastikan keasliannya? Masukkan
            kode verifikasinya di bawah — tidak perlu akun.
          </p>
          <form
            onSubmit={handlePeriksa}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={kode}
              onChange={(event) => setKode(event.target.value)}
              placeholder="Kode verifikasi"
              aria-label="Kode verifikasi sertifikat"
              className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={!kode.trim()}
              className="inline-flex min-h-11 items-center justify-center rounded bg-black px-6 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Periksa
            </button>
          </form>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Evaluasi</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Evaluasi berbasis soal, dinilai otomatis di server.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Referensi</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Materi referensi berupa video YouTube dan tautan, dengan syarat &quot;harus
              dibuka&quot;.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Atestasi</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Atestasi interaktif berupa video bersoal dan game, yang membuktikan materi
              benar-benar disaksikan — bukan sekadar diklik.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/masuk"
            className="inline-flex min-h-11 items-center justify-center rounded bg-black px-6 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Masuk
          </Link>
          <Link
            href="/daftar"
            className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-6 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Daftar
          </Link>
        </section>

        <footer className="border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
          Setiap sertifikat yang diterbitkan lewat platform ini bisa diperiksa keasliannya
          secara publik lewat halaman verifikasi di atas.
        </footer>
      </main>
    </div>
  );
}
