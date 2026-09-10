"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { LABEL_FIELD_FORMULIR } from "@/lib/formulir-peserta";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { updateProfilPeserta } from "@/lib/services/profil";

interface FormState {
  namaLengkap: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
}

function labelInstitusi(wajib: boolean): string {
  return wajib ? "Institusi / asal (wajib)" : "Institusi / asal";
}

function labelNomorIdentitas(wajib: boolean): string {
  return wajib ? "Nomor identitas (NIP/NIK/NIM, wajib)" : "Nomor identitas (NIP/NIK/NIM, opsional)";
}

function labelNoTelepon(wajib: boolean): string {
  return wajib ? "No. telepon (wajib)" : "No. telepon (opsional)";
}

/**
 * useSearchParams() (untuk ?untuk={kegiatanId}, Bagian 2) mensyaratkan
 * Suspense boundary supaya /profil tetap bisa diprarender statis — tanpa
 * ini `next build` gagal ("should be wrapped in a suspense boundary").
 * Fallback sama dengan keadaan "Memuat..." di ProfilContent supaya tidak
 * ada kedipan tampilan yang beda.
 */
export default function ProfilPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
          <p className="text-zinc-500">Memuat...</p>
        </div>
      }
    >
      <ProfilContent />
    </Suspense>
  );
}

function ProfilContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const untukKegiatanId = searchParams.get("untuk");
  const { user, profile, loading } = useAuth();

  // Bagian 2 (Slice 6.1a): peserta yang tombol Daftar-nya terkunci diarahkan
  // ke sini dengan ?untuk={kegiatanId} — HANYA sebuah id, tidak pernah nama
  // kegiatan mentah dari URL (2e: jangan pernah menampilkan teks dari URL
  // ke halaman). Nama & field wajib SELALU dibaca dari data lewat id ini.
  const { items: kegiatanList } = useKegiatanList({ hanyaTerbit: true });
  const kegiatanUntuk = useMemo(
    () =>
      untukKegiatanId
        ? kegiatanList.find((item) => item.id === untukKegiatanId && !item.isArchived) ?? null
        : null,
    [kegiatanList, untukKegiatanId]
  );
  // id yang tidak ditemukan, kegiatan diarsipkan, atau peserta tidak
  // berhak melihatnya (rules: hanya kegiatan isPublished true yang masuk
  // daftar ini) → kegiatanUntuk null → halaman tampil PERSIS seperti
  // /profil biasa (2d/2e), tanpa satu pun tanda wajib.
  const fieldWajibUntukKegiatan = useMemo(
    () =>
      kegiatanUntuk
        ? (["institusi", "nomorIdentitas", "noTelepon"] as const).filter(
            (field) => kegiatanUntuk.formulirPeserta[field] === "wajib"
          )
        : [],
    [kegiatanUntuk]
  );
  const institusiWajib = fieldWajibUntukKegiatan.includes("institusi");
  const nomorIdentitasWajib = fieldWajibUntukKegiatan.includes("nomorIdentitas");
  const noTeleponWajib = fieldWajibUntukKegiatan.includes("noTelepon");

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
      // 2c: kembali ke kegiatan asal HANYA kalau konteksnya benar-benar
      // terverifikasi lewat data (kegiatanUntuk non-null) — bukan cuma
      // karena parameter ada di URL, yang bisa saja basi atau salah ketik.
      if (kegiatanUntuk) {
        router.push(`/kegiatan/${kegiatanUntuk.id}`);
        return;
      }
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

  const labelWajibList = fieldWajibUntukKegiatan.map((field) => LABEL_FIELD_FORMULIR[field]);
  const daftarFieldWajibTeks =
    labelWajibList.length <= 1
      ? labelWajibList[0]
      : `${labelWajibList.slice(0, -1).join(", ")} dan ${labelWajibList[labelWajibList.length - 1]}`;

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

        {kegiatanUntuk && fieldWajibUntukKegiatan.length > 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Kegiatan «{kegiatanUntuk.judul}» mewajibkan {daftarFieldWajibTeks}. Lengkapi lalu
            simpan untuk melanjutkan pendaftaran.
          </p>
        )}

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
              {labelInstitusi(institusiWajib)}
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
              {labelNomorIdentitas(nomorIdentitasWajib)}
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
              {labelNoTelepon(noTeleponWajib)}
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
