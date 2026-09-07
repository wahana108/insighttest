"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { updateProfilPeserta } from "@/lib/services/profil";

interface FormState {
  namaLengkap: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
}

export default function ProfilPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  if (profile && !form) {
    setForm({
      namaLengkap: profile.namaLengkap,
      institusi: profile.institusi,
      nomorIdentitas: profile.nomorIdentitas,
      noTelepon: profile.noTelepon,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !form) {
      return;
    }
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await updateProfilPeserta(user.uid, form);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan profil.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user || !form) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Memuat...</p>
      </div>
    );
  }

  if (profile && (profile.status === "pending" || profile.status === "nonaktif")) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 px-4 text-center dark:bg-black">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Akun Anda belum aktif — hubungi admin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-md space-y-6">
        <div>
          <Link href="/beranda" className="text-sm text-zinc-500 hover:underline">
            ← Kembali ke Beranda
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">Profil</h1>
          <p className="text-sm text-zinc-500">
            Data ini dipakai saat Anda mendaftar ke kegiatan dan tercetak di sertifikat.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div>
            <label
              htmlFor="namaLengkap"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nama lengkap — inilah yang akan tercetak di sertifikat
            </label>
            <input
              id="namaLengkap"
              type="text"
              required
              value={form.namaLengkap}
              onChange={(event) =>
                setForm({ ...form, namaLengkap: event.target.value })
              }
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Pratinjau:{" "}
              <span className="font-medium text-black dark:text-zinc-50">
                {form.namaLengkap.trim() || "(belum diisi)"}
              </span>
            </p>
          </div>

          <div>
            <label
              htmlFor="institusi"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Institusi / asal
            </label>
            <input
              id="institusi"
              type="text"
              value={form.institusi}
              onChange={(event) => setForm({ ...form, institusi: event.target.value })}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label
              htmlFor="nomorIdentitas"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nomor identitas (NIP/NIK/NIM, opsional)
            </label>
            <input
              id="nomorIdentitas"
              type="text"
              value={form.nomorIdentitas}
              onChange={(event) =>
                setForm({ ...form, nomorIdentitas: event.target.value })
              }
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label
              htmlFor="noTelepon"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              No. telepon (opsional)
            </label>
            <input
              id="noTelepon"
              type="text"
              value={form.noTelepon}
              onChange={(event) => setForm({ ...form, noTelepon: event.target.value })}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-600">Profil tersimpan.</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Simpan profil
          </button>
        </form>
      </div>
    </div>
  );
}
