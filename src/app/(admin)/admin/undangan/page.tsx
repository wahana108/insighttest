"use client";

import { useState, type FormEvent } from "react";
import { WajibAdmin } from "@/app/(admin)/_wajib-admin";
import { useAuth } from "@/lib/auth/auth-provider";
import { formatDate } from "@/lib/format-date";
import { useUndanganList } from "@/lib/hooks/use-undangan-list";
import { createUndangan, deleteUndangan } from "@/lib/services/user-invitation";
import type { UndanganRole } from "@/types/undangan";

const ROLE_OPTIONS: UndanganRole[] = ["admin", "panitia", "peserta"];

export default function AdminUndanganPage() {
  return (
    <WajibAdmin>
      <AdminUndanganPageIsi />
    </WajibAdmin>
  );
}

function AdminUndanganPageIsi() {
  const { user } = useAuth();
  const { items, loading, error: listError } = useUndanganList();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UndanganRole>("peserta");
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createUndangan({ email, role, catatan }, user.uid);
      setEmail("");
      setRole("peserta");
      setCatatan("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah undangan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(targetEmail: string) {
    setError(null);
    setDeletingEmail(targetEmail);
    try {
      await deleteUndangan(targetEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus undangan.");
    } finally {
      setDeletingEmail(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Undangan</h1>
        <p className="text-sm text-zinc-500">
          Kendalikan siapa yang boleh mendaftar saat mode pendaftaran adalah
          &quot;undangan&quot;.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid gap-4 sm:grid-cols-2">
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
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value as UndanganRole)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="catatan"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Catatan
          </label>
          <textarea
            id="catatan"
            rows={2}
            value={catatan}
            onChange={(event) => setCatatan(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 items-center justify-center rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Tambah undangan
        </button>
      </form>

      {loading && <p className="text-sm text-zinc-500">Memuat...</p>}
      {!loading && listError && (
        <p className="text-sm text-red-600">Gagal memuat undangan: {listError}</p>
      )}
      {!loading && !listError && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-black dark:text-zinc-50">Belum ada undangan.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Undangan mengendalikan siapa yang boleh mendaftar saat mode pendaftaran
            &quot;undangan&quot;. Tambahkan lewat form di atas.
          </p>
        </div>
      )}

      {!loading && !listError && items.length > 0 && (
        <>
          <ul className="space-y-3 sm:hidden">
            {items.map((item) => (
              <li
                key={item.email}
                className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-black dark:text-zinc-50">{item.email}</p>
                  {item.usedAt ? (
                    <span className="shrink-0 text-zinc-500">Sudah terpakai</span>
                  ) : (
                    <span className="shrink-0 text-green-600">Belum terpakai</span>
                  )}
                </div>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="text-zinc-500">Role: </span>
                  {item.role}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="text-zinc-500">Catatan: </span>
                  {item.catatan || "-"}
                </p>
                <p className="text-zinc-500">Dibuat {formatDate(item.createdAt)}</p>
                {!item.usedAt && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.email)}
                    disabled={deletingEmail === item.email}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    Hapus
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden rounded-lg border border-zinc-200 sm:block dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Catatan</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Dibuat</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.email}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="px-4 py-2 text-black dark:text-zinc-50">{item.email}</td>
                    <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{item.role}</td>
                    <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                      {item.catatan || "-"}
                    </td>
                    <td className="px-4 py-2">
                      {item.usedAt ? (
                        <span className="text-zinc-500">Sudah terpakai</span>
                      ) : (
                        <span className="text-green-600">Belum terpakai</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-2 text-right">
                      {!item.usedAt && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.email)}
                          disabled={deletingEmail === item.email}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
