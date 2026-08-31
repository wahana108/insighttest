"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  dateAndTimeValuesToIso,
  isoToDateValue,
  isoToTimeValue,
} from "@/lib/datetime-local";
import { formatDateTime } from "@/lib/format-date";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { useModulList } from "@/lib/hooks/use-modul-list";
import {
  createKegiatan,
  setKegiatanArchived,
  setKegiatanPublished,
  TEMPLATE_SERTIFIKAT_KOSONG,
  updateKegiatan,
  type KegiatanWriteInput,
} from "@/lib/services/kegiatan";
import type { JenisSyaratSertifikat, Kegiatan, TemplateSertifikat } from "@/types/kegiatan";

const SYARAT_OPTIONS: JenisSyaratSertifikat[] = ["nilai_minimum", "manual_admin"];

interface FormState {
  kode: string;
  judul: string;
  deskripsi: string;
  dibukaTanggal: string;
  dibukaJam: string;
  ditutupTanggal: string;
  ditutupJam: string;
  syaratJenis: JenisSyaratSertifikat;
  syaratNilaiMinimum: string;
  templateSertifikat: TemplateSertifikat;
}

function emptyForm(): FormState {
  return {
    kode: "",
    judul: "",
    deskripsi: "",
    dibukaTanggal: "",
    dibukaJam: "",
    ditutupTanggal: "",
    ditutupJam: "",
    syaratJenis: "manual_admin",
    syaratNilaiMinimum: "70",
    templateSertifikat: TEMPLATE_SERTIFIKAT_KOSONG,
  };
}

function formatJendela(kegiatan: Kegiatan): string {
  if (!kegiatan.dibukaPada && !kegiatan.ditutupPada) {
    return "Tanpa batas waktu";
  }
  const buka = kegiatan.dibukaPada ? formatDateTime(kegiatan.dibukaPada) : "-";
  const tutup = kegiatan.ditutupPada ? formatDateTime(kegiatan.ditutupPada) : "-";
  return `${buka} – ${tutup}`;
}

function JumlahModul({ kegiatanId }: { kegiatanId: string }) {
  const { items, loading, error } = useModulList(kegiatanId);
  if (loading) {
    return <>…</>;
  }
  if (error) {
    return (
      <span className="text-red-600" title={`Gagal memuat modul: ${error}`}>
        Galat
      </span>
    );
  }
  return <>{items.length}</>;
}

export default function AdminKegiatanPage() {
  const { user } = useAuth();
  const { items, loading, error: listError } = useKegiatanList();

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
    setError(null);
  }

  function startEdit(kegiatan: Kegiatan) {
    setError(null);
    setEditingId(kegiatan.id);
    setForm({
      kode: kegiatan.kode,
      judul: kegiatan.judul,
      deskripsi: kegiatan.deskripsi,
      dibukaTanggal: isoToDateValue(kegiatan.dibukaPada),
      dibukaJam: isoToTimeValue(kegiatan.dibukaPada),
      ditutupTanggal: isoToDateValue(kegiatan.ditutupPada),
      ditutupJam: isoToTimeValue(kegiatan.ditutupPada),
      syaratJenis: kegiatan.syaratSertifikat.jenis,
      syaratNilaiMinimum: String(kegiatan.syaratSertifikat.nilaiMinimum),
      // Blok "Template sertifikat" disunting di /admin/kegiatan/[id], bukan
      // di sini — dioper apa adanya supaya "Simpan perubahan" di halaman
      // ini tidak menimpanya jadi kosong.
      templateSertifikat: kegiatan.templateSertifikat,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const input: KegiatanWriteInput = {
        kode: form.kode,
        judul: form.judul,
        deskripsi: form.deskripsi,
        dibukaPada: dateAndTimeValuesToIso(form.dibukaTanggal, form.dibukaJam),
        ditutupPada: dateAndTimeValuesToIso(form.ditutupTanggal, form.ditutupJam),
        syaratSertifikat: {
          jenis: form.syaratJenis,
          nilaiMinimum: Number(form.syaratNilaiMinimum) || 0,
        },
        templateSertifikat: form.templateSertifikat,
      };

      if (editingId) {
        await updateKegiatan(editingId, input, user.uid);
      } else {
        await createKegiatan(input, user.uid);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan kegiatan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePublished(kegiatan: Kegiatan) {
    if (!user) {
      return;
    }
    setError(null);
    setPublishingId(kegiatan.id);
    try {
      await setKegiatanPublished(kegiatan.id, !kegiatan.isPublished, user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status terbit.");
    } finally {
      setPublishingId(null);
    }
  }

  async function handleToggleArchived(kegiatan: Kegiatan) {
    if (!user) {
      return;
    }
    setError(null);
    setArchivingId(kegiatan.id);
    try {
      await setKegiatanArchived(kegiatan.id, !kegiatan.isArchived, user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status arsip.");
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Kegiatan</h1>
        <p className="text-sm text-zinc-500">
          Satu gelombang = satu kegiatan. Kelola modul evaluasinya lewat halaman detail.
          Kegiatan tidak pernah dihapus permanen — arsipkan kalau sudah selesai.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
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
              placeholder="DIKLAT-2026"
              value={form.kode}
              onChange={(event) => setForm((f) => ({ ...f, kode: event.target.value }))}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500">Dipakai di nomor serial sertifikat.</p>
          </div>
          <div>
            <label
              htmlFor="judul"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Judul
            </label>
            <input
              id="judul"
              type="text"
              required
              value={form.judul}
              onChange={(event) => setForm((f) => ({ ...f, judul: event.target.value }))}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>

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
            onChange={(event) => setForm((f) => ({ ...f, deskripsi: event.target.value }))}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="dibukaTanggal"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Dibuka pada (opsional)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="dibukaTanggal"
                type="date"
                value={form.dibukaTanggal}
                onChange={(event) => {
                  const tanggal = event.target.value;
                  setForm((f) => ({
                    ...f,
                    dibukaTanggal: tanggal,
                    dibukaJam: tanggal ? f.dibukaJam || "00:00" : "",
                  }));
                }}
                className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                type="time"
                aria-label="Jam dibuka"
                value={form.dibukaJam}
                onChange={(event) =>
                  setForm((f) => ({ ...f, dibukaJam: event.target.value }))
                }
                className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, dibukaTanggal: "", dibukaJam: "" }))}
                className="shrink-0 rounded border border-zinc-300 px-2 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                Kosongkan
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="ditutupTanggal"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Ditutup pada (opsional)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="ditutupTanggal"
                type="date"
                value={form.ditutupTanggal}
                onChange={(event) => {
                  const tanggal = event.target.value;
                  setForm((f) => ({
                    ...f,
                    ditutupTanggal: tanggal,
                    ditutupJam: tanggal ? f.ditutupJam || "23:59" : "",
                  }));
                }}
                className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                type="time"
                aria-label="Jam ditutup"
                value={form.ditutupJam}
                onChange={(event) =>
                  setForm((f) => ({ ...f, ditutupJam: event.target.value }))
                }
                className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, ditutupTanggal: "", ditutupJam: "" }))}
                className="shrink-0 rounded border border-zinc-300 px-2 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                Kosongkan
              </button>
            </div>
          </div>
          <p className="sm:col-span-2 text-xs text-zinc-500">
            Kosongkan kalau tidak dibatasi waktu. Kalau diisi, tanggal dan jam harus lengkap.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="syaratJenis"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Syarat sertifikat
            </label>
            <select
              id="syaratJenis"
              value={form.syaratJenis}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  syaratJenis: event.target.value as JenisSyaratSertifikat,
                }))
              }
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {SYARAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "nilai_minimum" ? "Nilai minimum" : "Manual oleh admin"}
                </option>
              ))}
            </select>
          </div>
          {form.syaratJenis === "nilai_minimum" && (
            <div>
              <label
                htmlFor="syaratNilaiMinimum"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Nilai minimum lulus
              </label>
              <input
                id="syaratNilaiMinimum"
                type="number"
                min={1}
                max={100}
                required
                value={form.syaratNilaiMinimum}
                onChange={(event) =>
                  setForm((f) => ({ ...f, syaratNilaiMinimum: event.target.value }))
                }
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {editingId ? "Simpan perubahan" : "Tambah kegiatan"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Judul</th>
              <th className="px-4 py-2 font-medium">Jendela waktu</th>
              <th className="px-4 py-2 font-medium">Modul</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && listError && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-red-600">
                  Gagal memuat kegiatan: {listError}
                </td>
              </tr>
            )}
            {!loading && !listError && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Belum ada kegiatan.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <td className="px-4 py-2 text-black dark:text-zinc-50">
                  <Link href={`/admin/kegiatan/${item.id}`} className="hover:underline">
                    {item.judul}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-zinc-400">
                    {item.kode || "(tanpa kode)"}
                  </span>
                  {item.isArchived && (
                    <span className="ml-2 text-xs text-zinc-400">(diarsipkan)</span>
                  )}
                </td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                  {formatJendela(item)}
                </td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                  <JumlahModul kegiatanId={item.id} />
                </td>
                <td className="px-4 py-2">
                  {item.isPublished ? (
                    <span className="text-green-600">Terbit</span>
                  ) : (
                    <span className="text-zinc-500">Draf</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex flex-wrap justify-end gap-3">
                    <Link
                      href={`/admin/kegiatan/${item.id}`}
                      className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                    >
                      Kelola modul
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                    >
                      Sunting
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePublished(item)}
                      disabled={publishingId === item.id}
                      className="text-sm font-medium text-zinc-700 hover:underline disabled:opacity-50 dark:text-zinc-300"
                    >
                      {item.isPublished ? "Tarik" : "Terbitkan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleArchived(item)}
                      disabled={archivingId === item.id}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      {item.isArchived ? "Buka arsip" : "Arsipkan"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
