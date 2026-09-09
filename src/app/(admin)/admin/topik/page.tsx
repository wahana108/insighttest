"use client";

import { useState, type FormEvent } from "react";
import { WajibAdmin } from "@/app/(admin)/_wajib-admin";
import { useAuth } from "@/lib/auth/auth-provider";
import { useTopikList } from "@/lib/hooks/use-topik-list";
import {
  createTopik,
  setTopikActive,
  updateTopik,
} from "@/lib/services/topik";
import type { Topik } from "@/types/topik";

interface FormState {
  kode: string;
  nama: string;
  deskripsi: string;
  urutan: string;
}

const EMPTY_FORM: FormState = { kode: "", nama: "", deskripsi: "", urutan: "0" };

export default function AdminTopikPage() {
  return (
    <WajibAdmin>
      <AdminTopikPageIsi />
    </WajibAdmin>
  );
}

function AdminTopikPageIsi() {
  const { user } = useAuth();
  const { items, loading, error: listError } = useTopikList();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingKode, setEditingKode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingKode, setTogglingKode] = useState<string | null>(null);

  function startEdit(topik: Topik) {
    setError(null);
    setEditingKode(topik.kode);
    setForm({
      kode: topik.kode,
      nama: topik.nama,
      deskripsi: topik.deskripsi,
      urutan: String(topik.urutan),
    });
  }

  function cancelEdit() {
    setError(null);
    setEditingKode(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const urutan = Number(form.urutan);
      if (!Number.isFinite(urutan)) {
        throw new Error("Urutan harus berupa angka.");
      }
      if (editingKode) {
        await updateTopik(
          editingKode,
          { nama: form.nama, deskripsi: form.deskripsi, urutan },
          user.uid
        );
      } else {
        await createTopik(
          { kode: form.kode, nama: form.nama, deskripsi: form.deskripsi, urutan },
          user.uid
        );
      }
      setEditingKode(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan topik.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(topik: Topik) {
    if (!user) {
      return;
    }
    setError(null);
    setTogglingKode(topik.kode);
    try {
      await setTopikActive(topik.kode, !topik.isActive, user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status topik.");
    } finally {
      setTogglingKode(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Topik</h1>
        <p className="text-sm text-zinc-500">
          Pengelompokan bank soal. Topik tidak pernah dihapus permanen — nonaktifkan
          kalau sudah tidak dipakai.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="kode"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Kode
            </label>
            <input
              id="kode"
              type="text"
              required
              disabled={Boolean(editingKode)}
              placeholder="PENALARAN-DASAR"
              value={form.kode}
              onChange={(event) => setForm({ ...form, kode: event.target.value })}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            {editingKode && (
              <p className="mt-1 text-xs text-zinc-500">
                Kode dikunci saat menyunting — ia adalah ID dokumen.
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="nama"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nama
            </label>
            <input
              id="nama"
              type="text"
              required
              value={form.nama}
              onChange={(event) => setForm({ ...form, nama: event.target.value })}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div>
            <label
              htmlFor="deskripsi"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Deskripsi
            </label>
            <textarea
              id="deskripsi"
              rows={2}
              value={form.deskripsi}
              onChange={(event) => setForm({ ...form, deskripsi: event.target.value })}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div>
            <label
              htmlFor="urutan"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Urutan
            </label>
            <input
              id="urutan"
              type="number"
              required
              value={form.urutan}
              onChange={(event) => setForm({ ...form, urutan: event.target.value })}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {editingKode ? "Simpan perubahan" : "Tambah topik"}
          </button>
          {editingKode && (
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      {loading && <p className="text-sm text-zinc-500">Memuat...</p>}
      {!loading && listError && (
        <p className="text-sm text-red-600">Gagal memuat topik: {listError}</p>
      )}
      {!loading && !listError && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-black dark:text-zinc-50">Belum ada topik.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Topik mengelompokkan bank soal per kategori. Isi form di atas untuk menambahkan
            topik pertama.
          </p>
        </div>
      )}

      {!loading && !listError && items.length > 0 && (
        <>
          {/* Kartu di layar sempit — tabel di sm: ke atas (rule 9.2b). */}
          <ul className="space-y-3 sm:hidden">
            {items.map((item) => (
              <li
                key={item.kode}
                className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-zinc-400">{item.kode}</p>
                    <p className="font-medium text-black dark:text-zinc-50">{item.nama}</p>
                  </div>
                  {item.isActive ? (
                    <span className="shrink-0 text-green-600">Aktif</span>
                  ) : (
                    <span className="shrink-0 text-zinc-500">Nonaktif</span>
                  )}
                </div>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="text-zinc-500">Deskripsi: </span>
                  {item.deskripsi || "-"}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="text-zinc-500">Urutan: </span>
                  {item.urutan}
                </p>
                <div className="flex gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    Sunting
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    disabled={togglingKode === item.kode}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden rounded-lg border border-zinc-200 sm:block dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Kode</th>
                  <th className="px-4 py-2 font-medium">Nama</th>
                  <th className="px-4 py-2 font-medium">Deskripsi</th>
                  <th className="px-4 py-2 font-medium">Urutan</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.kode}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="px-4 py-2 font-mono text-black dark:text-zinc-50">
                      {item.kode}
                    </td>
                    <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{item.nama}</td>
                    <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                      {item.deskripsi || "-"}
                    </td>
                    <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{item.urutan}</td>
                    <td className="px-4 py-2">
                      {item.isActive ? (
                        <span className="text-green-600">Aktif</span>
                      ) : (
                        <span className="text-zinc-500">Nonaktif</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                        >
                          Sunting
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          disabled={togglingKode === item.kode}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
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
