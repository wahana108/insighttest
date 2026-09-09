"use client";

import Link from "next/link";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState, type FormEvent } from "react";
import { auth } from "@/lib/firebase/client";

// Slice 6.0 §2 — pesan ini adalah INTI slice ini, bukan detail kecil: sama
// persis apa pun hasilnya (email terdaftar atau tidak), supaya orang luar
// tidak bisa menebak email mana yang punya akun di platform ini lewat
// halaman ini.
const PESAN_NETRAL =
  "Kalau email itu terdaftar, tautan setel ulang sudah kami kirim. Periksa kotak masuk dan folder spam.";

function pesanKesalahan(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-email":
        return "Format email tidak valid.";
      case "auth/too-many-requests":
        return "Terlalu banyak percobaan dalam waktu singkat. Coba lagi beberapa saat lagi.";
      case "auth/network-request-failed":
        return "Tidak bisa terhubung ke server — periksa koneksi internet Anda.";
      default:
        return "Gagal mengirim tautan setel ulang. Coba lagi beberapa saat lagi.";
    }
  }
  return "Gagal mengirim tautan setel ulang. Coba lagi beberapa saat lagi.";
}

export default function LupaPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [terkirim, setTerkirim] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setTerkirim(true);
    } catch (err) {
      // auth/user-not-found SENGAJA ditangkap dan diperlakukan SAMA seperti
      // berhasil terkirim (§2) — jangan pernah membocorkan lewat pesan
      // bahwa email ini tidak terdaftar. Error lain tetap tampil apa
      // adanya lewat pesanKesalahan(), tidak ditelan jadi sukses palsu.
      if (err instanceof FirebaseError && err.code === "auth/user-not-found") {
        setTerkirim(true);
      } else {
        setError(pesanKesalahan(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Setel ulang kata sandi
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Masukkan email akun Anda — kami kirimkan tautan untuk membuat kata sandi baru.
          </p>
        </div>

        {terkirim ? (
          <p className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {PESAN_NETRAL}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? "Mengirim..." : "Kirim tautan setel ulang"}
            </button>
          </form>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/masuk" className="font-medium text-black underline dark:text-zinc-50">
            ← Kembali ke Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
