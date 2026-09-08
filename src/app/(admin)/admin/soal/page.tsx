"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { WajibBolehBuatSoal } from "@/app/(admin)/_wajib-admin";
import { useAuth } from "@/lib/auth/auth-provider";
import { useSoalList } from "@/lib/hooks/use-soal-list";
import { useTopikList } from "@/lib/hooks/use-topik-list";
import { useUserList } from "@/lib/hooks/use-user-list";
import { bolehSuntingSoal } from "@/lib/izin-soal";
import {
  cekDuplikatTeks,
  createSoal,
  getKunciSoal,
  setSoalActive,
  updateSoal,
  type SoalWriteInput,
} from "@/lib/services/soal";
import { formatTopikLabel } from "@/lib/services/topik";
import type { Soal, TingkatSoal } from "@/types/soal";

const TINGKAT_OPTIONS: TingkatSoal[] = ["mudah", "sedang", "sulit"];

interface OpsiFormState {
  id: string;
  label: string;
}

interface FormState {
  topikKode: string;
  tingkat: TingkatSoal;
  teks: string;
  opsi: OpsiFormState[];
  opsiBenarId: string;
  pembahasan: string;
}

function emptyOpsi(): OpsiFormState {
  return { id: crypto.randomUUID(), label: "" };
}

function emptyForm(): FormState {
  return {
    topikKode: "",
    tingkat: "sedang",
    teks: "",
    opsi: [emptyOpsi(), emptyOpsi()],
    opsiBenarId: "",
    pembahasan: "",
  };
}

function truncate(teks: string, max = 70): string {
  return teks.length > max ? `${teks.slice(0, max)}…` : teks;
}

export default function AdminSoalPage() {
  return (
    <WajibBolehBuatSoal>
      <AdminSoalPageIsi />
    </WajibBolehBuatSoal>
  );
}

/**
 * Nama pembuat soal — hanya admin/superadmin yang bisa membaca profil
 * pengguna LAIN (firestore.rules, users/{uid}), jadi useUserList() (query
 * tanpa filter) hanya dipasang untuk mereka; dipisah ke komponen sendiri
 * supaya sesi panitia (yang tidak butuh ini — dia cuma perlu tahu mana
 * soal miliknya sendiri, sudah ketahuan dari uid-nya sendiri) tidak ikut
 * memasang listener yang pasti ditolak rules.
 */
function NamaPembuat({ uid }: { uid: string }) {
  const { items } = useUserList();
  const orang = items.find((item) => item.uid === uid);
  return <>{orang ? `${orang.displayName} (${orang.email})` : uid}</>;
}

function AdminSoalPageIsi() {
  const { user, profile } = useAuth();
  const isAdminOrSuper = profile?.role === "admin" || profile?.role === "superadmin";
  const { items: topikList, error: topikError } = useTopikList();

  const [filterTopikKode, setFilterTopikKode] = useState("");
  const { items, loading, error: soalError } = useSoalList(filterTopikKode || undefined);

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingKunci, setLoadingKunci] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [duplicateChecked, setDuplicateChecked] = useState(false);

  const topikAktif = useMemo(() => topikList.filter((topik) => topik.isActive), [topikList]);
  const topikLabel = useMemo(() => {
    const map = new Map<string, string>();
    topikList.forEach((topik) => map.set(topik.kode, formatTopikLabel(topik)));
    return map;
  }, [topikList]);

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
    setDuplicateWarning(null);
    setDuplicateChecked(false);
  }

  function updateTeks(teks: string) {
    setForm((f) => ({ ...f, teks }));
    setDuplicateWarning(null);
    setDuplicateChecked(false);
  }

  function updateTopikKode(topikKode: string) {
    setForm((f) => ({ ...f, topikKode }));
    setDuplicateWarning(null);
    setDuplicateChecked(false);
  }

  function updateOpsiLabel(id: string, label: string) {
    setForm((f) => ({
      ...f,
      opsi: f.opsi.map((opsi) => (opsi.id === id ? { ...opsi, label } : opsi)),
    }));
  }

  function addOpsi() {
    setForm((f) => ({ ...f, opsi: [...f.opsi, emptyOpsi()] }));
  }

  function removeOpsi(id: string) {
    setForm((f) => {
      if (f.opsi.length <= 2) {
        return f;
      }
      return {
        ...f,
        opsi: f.opsi.filter((opsi) => opsi.id !== id),
        opsiBenarId: f.opsiBenarId === id ? "" : f.opsiBenarId,
      };
    });
  }

  async function startEdit(soal: Soal) {
    setError(null);
    setDuplicateWarning(null);
    setDuplicateChecked(false);
    setLoadingKunci(true);
    try {
      const kunci = await getKunciSoal(soal.id);
      setEditingId(soal.id);
      setForm({
        topikKode: soal.topikKode,
        tingkat: soal.tingkat,
        teks: soal.teks,
        opsi: soal.opsi.map((opsi) => ({ id: opsi.id, label: opsi.label })),
        opsiBenarId: kunci?.opsiBenarId ?? "",
        pembahasan: kunci?.pembahasan ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat kunci jawaban.");
    } finally {
      setLoadingKunci(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const input: SoalWriteInput = {
        teks: form.teks,
        topikKode: form.topikKode,
        tingkat: form.tingkat,
        opsi: form.opsi.map((opsi) => ({ id: opsi.id, label: opsi.label })),
        opsiBenarId: form.opsiBenarId,
        pembahasan: form.pembahasan,
      };

      if (!duplicateChecked) {
        const isDuplicate = await cekDuplikatTeks(
          form.topikKode,
          form.teks,
          editingId ?? undefined
        );
        if (isDuplicate) {
          setDuplicateWarning(
            'Teks soal ini (setelah dinormalkan) sudah ada di topik yang sama. Klik "Simpan" sekali lagi untuk tetap menyimpan.'
          );
          setDuplicateChecked(true);
          return;
        }
      }

      if (editingId) {
        await updateSoal(editingId, input, user.uid);
      } else {
        await createSoal(input, user.uid);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan soal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(soal: Soal) {
    if (!user) {
      return;
    }
    setError(null);
    setTogglingId(soal.id);
    try {
      await setSoalActive(soal.id, !soal.isActive, user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status soal.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Soal</h1>
          <p className="text-sm text-zinc-500">
            Bank soal pilihan ganda. Kunci jawaban disimpan terpisah dan tidak pernah
            diturunkan ke peserta. Soal tidak pernah dihapus permanen — nonaktifkan kalau
            sudah tidak dipakai.
          </p>
        </div>
        <Link
          href="/admin/soal/impor"
          className="shrink-0 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Impor berbantuan AI
        </Link>
      </div>

      {topikError && (
        <p className="text-sm text-red-600">Gagal memuat daftar topik: {topikError}</p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="topikKode"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Topik
            </label>
            <select
              id="topikKode"
              required
              value={form.topikKode}
              onChange={(event) => updateTopikKode(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Pilih topik...</option>
              {topikAktif.map((topik) => (
                <option key={topik.kode} value={topik.kode}>
                  {formatTopikLabel(topik)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="tingkat"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Tingkat
            </label>
            <select
              id="tingkat"
              value={form.tingkat}
              onChange={(event) =>
                setForm((f) => ({ ...f, tingkat: event.target.value as TingkatSoal }))
              }
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {TINGKAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="teks"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Teks soal
          </label>
          <textarea
            id="teks"
            rows={3}
            required
            value={form.teks}
            onChange={(event) => updateTeks(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="space-y-2">
          <p className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Opsi jawaban (tandai satu sebagai benar)
          </p>
          {form.opsi.map((opsi, index) => (
            <div key={opsi.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="opsiBenarId"
                checked={form.opsiBenarId === opsi.id}
                onChange={() => setForm((f) => ({ ...f, opsiBenarId: opsi.id }))}
                aria-label={`Tandai opsi ${index + 1} sebagai benar`}
              />
              <input
                type="text"
                required
                placeholder={`Opsi ${index + 1}`}
                value={opsi.label}
                onChange={(event) => updateOpsiLabel(opsi.id, event.target.value)}
                className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="button"
                onClick={() => removeOpsi(opsi.id)}
                disabled={form.opsi.length <= 2}
                className="text-sm font-medium text-red-600 hover:underline disabled:opacity-30"
              >
                Hapus
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOpsi}
            className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
          >
            + Tambah opsi
          </button>
        </div>

        <div>
          <label
            htmlFor="pembahasan"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Pembahasan
          </label>
          <textarea
            id="pembahasan"
            rows={2}
            value={form.pembahasan}
            onChange={(event) => setForm((f) => ({ ...f, pembahasan: event.target.value }))}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {duplicateWarning && <p className="text-sm text-amber-600">{duplicateWarning}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {editingId ? "Simpan perubahan" : "Tambah soal"}
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
          {loadingKunci && <p className="self-center text-sm text-zinc-500">Memuat kunci...</p>}
        </div>
      </form>

      <div className="flex items-center gap-2">
        <label htmlFor="filterTopik" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Saring topik:
        </label>
        <select
          id="filterTopik"
          value={filterTopikKode}
          onChange={(event) => setFilterTopikKode(event.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="">Semua topik</option>
          {topikList.map((topik) => (
            <option key={topik.kode} value={topik.kode}>
              {formatTopikLabel(topik)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Teks</th>
              <th className="px-4 py-2 font-medium">Topik</th>
              <th className="px-4 py-2 font-medium">Tingkat</th>
              <th className="px-4 py-2 font-medium">Opsi</th>
              <th className="px-4 py-2 font-medium">Pembuat</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && soalError && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-red-600">
                  Gagal memuat soal: {soalError}
                </td>
              </tr>
            )}
            {!loading && !soalError && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  Belum ada soal.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const bisaSunting = bolehSuntingSoal(profile, item);
              return (
              <tr
                key={item.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <td className="px-4 py-2 text-black dark:text-zinc-50">
                  {truncate(item.teks)}
                </td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                  {topikLabel.get(item.topikKode) ?? item.topikKode}
                </td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{item.tingkat}</td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                  {item.opsi.length}
                </td>
                <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                  {!item.dibuatOleh ? (
                    "Admin"
                  ) : item.dibuatOleh === profile?.uid ? (
                    "Anda"
                  ) : isAdminOrSuper ? (
                    <NamaPembuat uid={item.dibuatOleh} />
                  ) : (
                    "Panitia lain"
                  )}
                </td>
                <td className="px-4 py-2">
                  {item.isActive ? (
                    <span className="text-green-600">Aktif</span>
                  ) : (
                    <span className="text-zinc-500">Nonaktif</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {bisaSunting ? (
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                      >
                        Sunting
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        disabled={togglingId === item.id}
                        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">Hanya lihat</span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
