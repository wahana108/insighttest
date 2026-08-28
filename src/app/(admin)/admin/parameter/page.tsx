"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  DEFAULT_SYSTEM_PARAMETER,
  getSystemParameter,
  updateSystemParameter,
} from "@/lib/services/system-parameter";
import type { ModePendaftaran, SystemParameter } from "@/types/parameter";

export default function AdminParameterPage() {
  const { user, profile } = useAuth();
  const [parameter, setParameter] = useState<SystemParameter>(DEFAULT_SYSTEM_PARAMETER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSystemParameter().then((next) => {
      if (mounted) {
        setParameter(next);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canSave = profile?.role === "superadmin";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || !user) {
      return;
    }
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateSystemParameter(
        {
          namaPlatform: parameter.namaPlatform,
          modePendaftaran: parameter.modePendaftaran,
          pesanBeranda: parameter.pesanBeranda,
        },
        user.uid
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan parameter.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-500">Memuat...</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Parameter</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="namaPlatform"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Nama platform
          </label>
          <input
            id="namaPlatform"
            type="text"
            required
            value={parameter.namaPlatform}
            onChange={(event) =>
              setParameter((prev) => ({ ...prev, namaPlatform: event.target.value }))
            }
            disabled={!canSave}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label
            htmlFor="modePendaftaran"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Mode pendaftaran
          </label>
          <select
            id="modePendaftaran"
            value={parameter.modePendaftaran}
            onChange={(event) =>
              setParameter((prev) => ({
                ...prev,
                modePendaftaran: event.target.value as ModePendaftaran,
              }))
            }
            disabled={!canSave}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="terbuka">Terbuka</option>
            <option value="undangan">Undangan</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="pesanBeranda"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Pesan beranda
          </label>
          <textarea
            id="pesanBeranda"
            rows={3}
            value={parameter.pesanBeranda}
            onChange={(event) =>
              setParameter((prev) => ({ ...prev, pesanBeranda: event.target.value }))
            }
            disabled={!canSave}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {!canSave && (
          <p className="text-sm text-zinc-500">
            Hanya superadmin yang boleh menyimpan. Anda hanya bisa melihat.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Tersimpan.</p>}

        {canSave && (
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Simpan
          </button>
        )}
      </form>
    </div>
  );
}
