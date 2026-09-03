"use client";

import Link from "next/link";
import { use, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  dateAndTimeValuesToIso,
  isoToDateValue,
  isoToTimeValue,
} from "@/lib/datetime-local";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { useModulList } from "@/lib/hooks/use-modul-list";
import { useSoalList } from "@/lib/hooks/use-soal-list";
import { useTopikList } from "@/lib/hooks/use-topik-list";
import { updateKegiatan, type KegiatanWriteInput } from "@/lib/services/kegiatan";
import {
  createModul,
  deleteModul,
  updateModul,
  type ModulWriteInput,
} from "@/lib/services/modul";
import { formatTopikLabel } from "@/lib/services/topik";
import { periksaUrlGambar } from "@/lib/validasi-url-gambar";
import { ekstrakYoutubeId } from "@/lib/youtube";
import type {
  JenisSyaratSertifikat,
  KategoriModul,
  ModePemilihanSoal,
  ModulKegiatan,
  TemplateSertifikat,
  TipeReferensi,
} from "@/types/kegiatan";

const KATEGORI_MODUL_OPTIONS: { value: KategoriModul; label: string }[] = [
  { value: "evaluasi", label: "Evaluasi" },
  { value: "referensi", label: "Referensi" },
];

const TIPE_REFERENSI_OPTIONS: { value: TipeReferensi; label: string }[] = [
  { value: "youtube", label: "Video YouTube" },
  { value: "tautan", label: "Tautan keluar" },
  { value: "teks", label: "Teks" },
];

const SYARAT_OPTIONS: JenisSyaratSertifikat[] = ["nilai_minimum", "manual_admin"];

interface KegiatanFormState {
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

interface ModulFormState {
  judul: string;
  kategori: KategoriModul;
  urutan: string;
  wajib: boolean;
  nilaiMinimum: string;
  maksPercobaan: string;
  batasWaktuMenit: string;
  acakUrutanSoal: boolean;
  mode: ModePemilihanSoal;
  topikKode: string;
  jumlah: string;
  soalIds: string[];
  referensiTipe: TipeReferensi;
  referensiSumber: string;
  referensiDeskripsi: string;
}

function emptyModulForm(): ModulFormState {
  return {
    judul: "",
    kategori: "evaluasi",
    urutan: "0",
    wajib: true,
    nilaiMinimum: "70",
    maksPercobaan: "1",
    batasWaktuMenit: "",
    acakUrutanSoal: true,
    mode: "tetap",
    topikKode: "",
    jumlah: "10",
    soalIds: [],
    referensiTipe: "youtube",
    referensiSumber: "",
    referensiDeskripsi: "",
  };
}

function ringkasanModul(modul: ModulKegiatan, topikLabel: Map<string, string>): string {
  if (modul.kategori === "referensi") {
    const label = TIPE_REFERENSI_OPTIONS.find((opt) => opt.value === modul.referensi?.tipe)?.label;
    return `Referensi — ${label ?? "?"}`;
  }
  if (!modul.evaluasi) {
    return "-";
  }
  const { pemilihanSoal } = modul.evaluasi;
  if (pemilihanSoal.mode === "tetap") {
    return `${pemilihanSoal.soalIds.length} soal tetap`;
  }
  const topik = pemilihanSoal.topikKode
    ? (topikLabel.get(pemilihanSoal.topikKode) ?? pemilihanSoal.topikKode)
    : "(topik belum dipilih)";
  return `${pemilihanSoal.jumlah ?? 0} soal acak dari ${topik}`;
}

/**
 * Satu field URL gambar template sertifikat (logo/kop/tanda tangan) —
 * dipakai tiga kali, jadi diekstrak supaya validasi + pratinjau tidak
 * ditulis ulang tiga kali. periksaUrlGambar() cuma memeriksa bentuk URL-nya
 * (protokol, host, query, ekstensi) — img onError di bawah ini memeriksa
 * hal yang tidak bisa diketahui dari teks URL saja: apakah tautannya
 * benar-benar bisa dimuat sekarang.
 */
function FieldUrlGambar({
  id,
  label,
  value,
  onChange,
  gambarGagal,
  onGambarStatus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  gambarGagal: boolean;
  onGambarStatus: (berhasil: boolean) => void;
}) {
  const hasil = periksaUrlGambar(value);
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      <div className="mt-1 flex items-start gap-2">
        <input
          id={id}
          type="url"
          placeholder="https://..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {value.trim() && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-10 w-10 shrink-0 rounded border border-zinc-200 object-contain dark:border-zinc-700"
            onError={() => onGambarStatus(false)}
            onLoad={() => onGambarStatus(true)}
          />
        )}
      </div>
      {!hasil.valid && hasil.alasan && (
        <p className="mt-1 text-xs text-red-600">{hasil.alasan}</p>
      )}
      {hasil.valid && hasil.alasan && (
        <p className="mt-1 text-xs text-amber-600">{hasil.alasan}</p>
      )}
      {gambarGagal && (
        <p className="mt-1 text-xs text-red-600">
          Gambar tidak bisa dimuat — periksa tautannya
        </p>
      )}
    </div>
  );
}

export default function AdminKegiatanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const {
    items: kegiatanList,
    loading: loadingKegiatan,
    error: kegiatanListError,
  } = useKegiatanList();
  const { items: modulList, loading: loadingModul, error: modulListError } = useModulList(id);
  const { items: topikList, error: topikError } = useTopikList();

  const kegiatan = useMemo(() => kegiatanList.find((item) => item.id === id) ?? null, [
    kegiatanList,
    id,
  ]);

  const topikLabel = useMemo(() => {
    const map = new Map<string, string>();
    topikList.forEach((topik) => map.set(topik.kode, formatTopikLabel(topik)));
    return map;
  }, [topikList]);

  // Kegiatan
  const [kegiatanForm, setKegiatanForm] = useState<KegiatanFormState | null>(null);
  const [kegiatanError, setKegiatanError] = useState<string | null>(null);
  const [savingKegiatan, setSavingKegiatan] = useState(false);
  const [gambarGagal, setGambarGagal] = useState<{ logo: boolean; kop: boolean; ttd: boolean }>({
    logo: false,
    kop: false,
    ttd: false,
  });

  const editingKegiatanForm =
    kegiatanForm ??
    (kegiatan
      ? {
          kode: kegiatan.kode,
          judul: kegiatan.judul,
          deskripsi: kegiatan.deskripsi,
          dibukaTanggal: isoToDateValue(kegiatan.dibukaPada),
          dibukaJam: isoToTimeValue(kegiatan.dibukaPada),
          ditutupTanggal: isoToDateValue(kegiatan.ditutupPada),
          ditutupJam: isoToTimeValue(kegiatan.ditutupPada),
          syaratJenis: kegiatan.syaratSertifikat.jenis,
          syaratNilaiMinimum: String(kegiatan.syaratSertifikat.nilaiMinimum),
          templateSertifikat: kegiatan.templateSertifikat,
        }
      : null);

  async function handleSubmitKegiatan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !editingKegiatanForm) {
      return;
    }
    setKegiatanError(null);

    // Pagar di sisi klien — pagar sesungguhnya ada di server saat
    // penerbitan (src/lib/api/sertifikat-server.ts), tapi mencegahnya di
    // sini supaya admin tahu masalahnya sebelum sertifikat pernah terbit.
    const ladangUrl: [string, string][] = [
      ["URL logo", editingKegiatanForm.templateSertifikat.logoUrl],
      ["URL kop/header", editingKegiatanForm.templateSertifikat.kopUrl],
      ["URL gambar tanda tangan", editingKegiatanForm.templateSertifikat.tandaTanganUrl],
    ];
    for (const [label, nilai] of ladangUrl) {
      const hasil = periksaUrlGambar(nilai);
      if (!hasil.valid) {
        setKegiatanError(`${label}: ${hasil.alasan}`);
        return;
      }
    }

    setSavingKegiatan(true);
    try {
      const input: KegiatanWriteInput = {
        kode: editingKegiatanForm.kode,
        judul: editingKegiatanForm.judul,
        deskripsi: editingKegiatanForm.deskripsi,
        dibukaPada: dateAndTimeValuesToIso(
          editingKegiatanForm.dibukaTanggal,
          editingKegiatanForm.dibukaJam
        ),
        ditutupPada: dateAndTimeValuesToIso(
          editingKegiatanForm.ditutupTanggal,
          editingKegiatanForm.ditutupJam
        ),
        syaratSertifikat: {
          jenis: editingKegiatanForm.syaratJenis,
          nilaiMinimum: Number(editingKegiatanForm.syaratNilaiMinimum) || 0,
        },
        templateSertifikat: editingKegiatanForm.templateSertifikat,
      };
      await updateKegiatan(id, input, user.uid);
      setKegiatanForm(null);
    } catch (err) {
      setKegiatanError(err instanceof Error ? err.message : "Gagal menyimpan kegiatan.");
    } finally {
      setSavingKegiatan(false);
    }
  }

  // Modul
  const [modulForm, setModulForm] = useState<ModulFormState>(() => emptyModulForm());
  const [editingModulId, setEditingModulId] = useState<string | null>(null);
  const [modulError, setModulError] = useState<string | null>(null);
  const [savingModul, setSavingModul] = useState(false);
  const [deletingModulId, setDeletingModulId] = useState<string | null>(null);

  const {
    items: soalUntukPemilihan,
    loading: loadingSoalUntukPemilihan,
    error: soalUntukPemilihanError,
  } = useSoalList(modulForm.topikKode || undefined);
  const soalAktifTersedia = soalUntukPemilihan.filter((soal) => soal.isActive).length;

  function resetModulForm() {
    setModulForm(emptyModulForm());
    setEditingModulId(null);
    setModulError(null);
  }

  function startEditModul(modul: ModulKegiatan) {
    setModulError(null);
    setEditingModulId(modul.id);
    setModulForm({
      judul: modul.judul,
      kategori: modul.kategori === "referensi" ? "referensi" : "evaluasi",
      urutan: String(modul.urutan),
      wajib: modul.wajib,
      nilaiMinimum: String(modul.evaluasi?.nilaiMinimum ?? 70),
      maksPercobaan: String(modul.evaluasi?.maksPercobaan ?? 1),
      batasWaktuMenit:
        modul.evaluasi?.batasWaktuMenit != null ? String(modul.evaluasi.batasWaktuMenit) : "",
      acakUrutanSoal: modul.evaluasi?.acakUrutanSoal ?? true,
      mode: modul.evaluasi?.pemilihanSoal.mode ?? "tetap",
      topikKode: modul.evaluasi?.pemilihanSoal.topikKode ?? "",
      jumlah: String(modul.evaluasi?.pemilihanSoal.jumlah ?? 10),
      soalIds: modul.evaluasi?.pemilihanSoal.soalIds ?? [],
      referensiTipe: modul.referensi?.tipe ?? "youtube",
      referensiSumber: modul.referensi?.sumber ?? "",
      referensiDeskripsi: modul.referensi?.deskripsi ?? "",
    });
  }

  function toggleSoalId(soalId: string) {
    setModulForm((f) => ({
      ...f,
      soalIds: f.soalIds.includes(soalId)
        ? f.soalIds.filter((item) => item !== soalId)
        : [...f.soalIds, soalId],
    }));
  }

  async function handleSubmitModul(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setModulError(null);
    setSavingModul(true);
    try {
      const input: ModulWriteInput =
        modulForm.kategori === "referensi"
          ? {
              judul: modulForm.judul,
              kategori: "referensi",
              urutan: Number(modulForm.urutan) || 0,
              wajib: modulForm.wajib,
              evaluasi: null,
              referensi: {
                tipe: modulForm.referensiTipe,
                sumber: modulForm.referensiSumber,
                deskripsi: modulForm.referensiDeskripsi,
              },
            }
          : {
              judul: modulForm.judul,
              kategori: "evaluasi",
              urutan: Number(modulForm.urutan) || 0,
              wajib: modulForm.wajib,
              evaluasi: {
                pemilihanSoal: {
                  mode: modulForm.mode,
                  soalIds: modulForm.mode === "tetap" ? modulForm.soalIds : [],
                  topikKode: modulForm.mode === "acak" ? modulForm.topikKode || null : null,
                  jumlah: modulForm.mode === "acak" ? Number(modulForm.jumlah) || null : null,
                },
                nilaiMinimum: Number(modulForm.nilaiMinimum) || 0,
                maksPercobaan: Number(modulForm.maksPercobaan) || 1,
                batasWaktuMenit: modulForm.batasWaktuMenit
                  ? Number(modulForm.batasWaktuMenit)
                  : null,
                acakUrutanSoal: modulForm.acakUrutanSoal,
              },
              referensi: null,
            };

      if (editingModulId) {
        await updateModul(id, editingModulId, input, user.uid);
      } else {
        await createModul(id, input, user.uid);
      }
      resetModulForm();
    } catch (err) {
      setModulError(err instanceof Error ? err.message : "Gagal menyimpan modul.");
    } finally {
      setSavingModul(false);
    }
  }

  async function handleDeleteModul(modulId: string) {
    setModulError(null);
    setDeletingModulId(modulId);
    try {
      await deleteModul(id, modulId);
      if (editingModulId === modulId) {
        resetModulForm();
      }
    } catch (err) {
      setModulError(err instanceof Error ? err.message : "Gagal menghapus modul.");
    } finally {
      setDeletingModulId(null);
    }
  }

  if (loadingKegiatan) {
    return <p className="text-sm text-zinc-500">Memuat...</p>;
  }

  if (kegiatanListError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">
          Gagal memuat kegiatan: {kegiatanListError}
        </p>
        <Link href="/admin/kegiatan" className="text-sm font-medium text-black underline dark:text-zinc-50">
          ← Kembali ke daftar kegiatan
        </Link>
      </div>
    );
  }

  if (!kegiatan) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">Kegiatan tidak ditemukan.</p>
        <Link href="/admin/kegiatan" className="text-sm font-medium text-black underline dark:text-zinc-50">
          ← Kembali ke daftar kegiatan
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href="/admin/kegiatan" className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke Kegiatan
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          {kegiatan.judul}{" "}
          <span className="font-mono text-sm font-normal text-zinc-400">
            {kegiatan.kode || "(tanpa kode)"}
          </span>
        </h1>
        <Link
          href={`/admin/kegiatan/${id}/peserta`}
          className="mt-1 inline-block text-sm font-medium text-black underline dark:text-zinc-50"
        >
          Lihat peserta & terbitkan sertifikat
        </Link>
      </div>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Sunting kegiatan</h2>
        {editingKegiatanForm && (
          <form onSubmit={handleSubmitKegiatan} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div>
                <label
                  htmlFor="det-kode"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Kode
                </label>
                <input
                  id="det-kode"
                  type="text"
                  required
                  placeholder="DIKLAT-2026"
                  value={editingKegiatanForm.kode}
                  onChange={(event) =>
                    setKegiatanForm({ ...editingKegiatanForm, kode: event.target.value })
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label
                  htmlFor="det-judul"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Judul
                </label>
                <input
                  id="det-judul"
                  type="text"
                  required
                  value={editingKegiatanForm.judul}
                  onChange={(event) =>
                    setKegiatanForm({ ...editingKegiatanForm, judul: event.target.value })
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="det-deskripsi"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Deskripsi
              </label>
              <textarea
                id="det-deskripsi"
                rows={2}
                value={editingKegiatanForm.deskripsi}
                onChange={(event) =>
                  setKegiatanForm({ ...editingKegiatanForm, deskripsi: event.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="det-dibuka"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Dibuka pada (opsional)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="det-dibuka"
                    type="date"
                    value={editingKegiatanForm.dibukaTanggal}
                    onChange={(event) => {
                      const tanggal = event.target.value;
                      setKegiatanForm({
                        ...editingKegiatanForm,
                        dibukaTanggal: tanggal,
                        dibukaJam: tanggal ? editingKegiatanForm.dibukaJam || "00:00" : "",
                      });
                    }}
                    className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <input
                    type="time"
                    aria-label="Jam dibuka"
                    value={editingKegiatanForm.dibukaJam}
                    onChange={(event) =>
                      setKegiatanForm({ ...editingKegiatanForm, dibukaJam: event.target.value })
                    }
                    className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setKegiatanForm({ ...editingKegiatanForm, dibukaTanggal: "", dibukaJam: "" })
                    }
                    className="shrink-0 rounded border border-zinc-300 px-2 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor="det-ditutup"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Ditutup pada (opsional)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="det-ditutup"
                    type="date"
                    value={editingKegiatanForm.ditutupTanggal}
                    onChange={(event) => {
                      const tanggal = event.target.value;
                      setKegiatanForm({
                        ...editingKegiatanForm,
                        ditutupTanggal: tanggal,
                        ditutupJam: tanggal ? editingKegiatanForm.ditutupJam || "23:59" : "",
                      });
                    }}
                    className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <input
                    type="time"
                    aria-label="Jam ditutup"
                    value={editingKegiatanForm.ditutupJam}
                    onChange={(event) =>
                      setKegiatanForm({ ...editingKegiatanForm, ditutupJam: event.target.value })
                    }
                    className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setKegiatanForm({
                        ...editingKegiatanForm,
                        ditutupTanggal: "",
                        ditutupJam: "",
                      })
                    }
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
                  htmlFor="det-syarat"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Syarat sertifikat
                </label>
                <select
                  id="det-syarat"
                  value={editingKegiatanForm.syaratJenis}
                  onChange={(event) =>
                    setKegiatanForm({
                      ...editingKegiatanForm,
                      syaratJenis: event.target.value as JenisSyaratSertifikat,
                    })
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
              {editingKegiatanForm.syaratJenis === "nilai_minimum" && (
                <div>
                  <label
                    htmlFor="det-nilai-minimum"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Nilai minimum lulus
                  </label>
                  <input
                    id="det-nilai-minimum"
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={editingKegiatanForm.syaratNilaiMinimum}
                    onChange={(event) =>
                      setKegiatanForm({
                        ...editingKegiatanForm,
                        syaratNilaiMinimum: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Template sertifikat
                </p>
                <p className="text-xs text-zinc-500">
                  Semuanya opsional — sertifikat minimum tetap sah kalau dikosongkan.
                  Gambar ditautkan lewat URL, tidak diunggah.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldUrlGambar
                  id="tpl-logo"
                  label="URL logo"
                  value={editingKegiatanForm.templateSertifikat.logoUrl}
                  onChange={(nilai) =>
                    setKegiatanForm({
                      ...editingKegiatanForm,
                      templateSertifikat: {
                        ...editingKegiatanForm.templateSertifikat,
                        logoUrl: nilai,
                      },
                    })
                  }
                  gambarGagal={gambarGagal.logo}
                  onGambarStatus={(berhasil) =>
                    setGambarGagal((g) => ({ ...g, logo: !berhasil }))
                  }
                />
                <FieldUrlGambar
                  id="tpl-kop"
                  label="URL kop/header"
                  value={editingKegiatanForm.templateSertifikat.kopUrl}
                  onChange={(nilai) =>
                    setKegiatanForm({
                      ...editingKegiatanForm,
                      templateSertifikat: {
                        ...editingKegiatanForm.templateSertifikat,
                        kopUrl: nilai,
                      },
                    })
                  }
                  gambarGagal={gambarGagal.kop}
                  onGambarStatus={(berhasil) =>
                    setGambarGagal((g) => ({ ...g, kop: !berhasil }))
                  }
                />
                <div>
                  <label
                    htmlFor="tpl-nama"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Nama penandatangan
                  </label>
                  <input
                    id="tpl-nama"
                    type="text"
                    value={editingKegiatanForm.templateSertifikat.penandatanganNama}
                    onChange={(event) =>
                      setKegiatanForm({
                        ...editingKegiatanForm,
                        templateSertifikat: {
                          ...editingKegiatanForm.templateSertifikat,
                          penandatanganNama: event.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label
                    htmlFor="tpl-jabatan"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Jabatan penandatangan
                  </label>
                  <input
                    id="tpl-jabatan"
                    type="text"
                    value={editingKegiatanForm.templateSertifikat.penandatanganJabatan}
                    onChange={(event) =>
                      setKegiatanForm({
                        ...editingKegiatanForm,
                        templateSertifikat: {
                          ...editingKegiatanForm.templateSertifikat,
                          penandatanganJabatan: event.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldUrlGambar
                    id="tpl-ttd"
                    label="URL gambar tanda tangan"
                    value={editingKegiatanForm.templateSertifikat.tandaTanganUrl}
                    onChange={(nilai) =>
                      setKegiatanForm({
                        ...editingKegiatanForm,
                        templateSertifikat: {
                          ...editingKegiatanForm.templateSertifikat,
                          tandaTanganUrl: nilai,
                        },
                      })
                    }
                    gambarGagal={gambarGagal.ttd}
                    onGambarStatus={(berhasil) =>
                      setGambarGagal((g) => ({ ...g, ttd: !berhasil }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="tpl-teks"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Teks tambahan
                  </label>
                  <textarea
                    id="tpl-teks"
                    rows={2}
                    value={editingKegiatanForm.templateSertifikat.teksTambahan}
                    onChange={(event) =>
                      setKegiatanForm({
                        ...editingKegiatanForm,
                        templateSertifikat: {
                          ...editingKegiatanForm.templateSertifikat,
                          teksTambahan: event.target.value,
                        },
                      })
                    }
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
              </div>
            </div>

            {kegiatanError && <p className="text-sm text-red-600">{kegiatanError}</p>}
            <button
              type="submit"
              disabled={savingKegiatan}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Simpan kegiatan
            </button>
          </form>
        )}
      </section>

      {topikError && (
        <p className="text-sm text-red-600">Gagal memuat daftar topik: {topikError}</p>
      )}

      {kegiatan.isPublished && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Kegiatan ini sudah diterbitkan. Mengubah atau menghapus modul setelah ada peserta bisa
          membuat hasil dan sertifikat yang sudah ada jadi tidak konsisten — pendaftaran
          menyimpan cuplikan (snapshot) modul saat peserta mendaftar, jadi perubahan di sini
          tidak menimpa data lama, tapi tetap ganjil untuk peserta baru dan lama melihat modul
          yang berbeda.
        </p>
      )}

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
          {editingModulId ? "Sunting modul" : "Tambah modul"}
        </h2>
        <form onSubmit={handleSubmitModul} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px_120px]">
            <div>
              <label
                htmlFor="mod-judul"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Judul modul
              </label>
              <input
                id="mod-judul"
                type="text"
                required
                value={modulForm.judul}
                onChange={(event) =>
                  setModulForm((f) => ({ ...f, judul: event.target.value }))
                }
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="mod-kategori"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Kategori
              </label>
              <select
                id="mod-kategori"
                value={modulForm.kategori}
                onChange={(event) =>
                  setModulForm((f) => ({
                    ...f,
                    kategori: event.target.value as KategoriModul,
                  }))
                }
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {KATEGORI_MODUL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="mod-urutan"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Urutan
              </label>
              <input
                id="mod-urutan"
                type="number"
                required
                value={modulForm.urutan}
                onChange={(event) =>
                  setModulForm((f) => ({ ...f, urutan: event.target.value }))
                }
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={modulForm.wajib}
              onChange={(event) =>
                setModulForm((f) => ({ ...f, wajib: event.target.checked }))
              }
            />
            Modul wajib
          </label>

          {modulForm.kategori === "referensi" && (
            <div className="space-y-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Konten referensi
              </p>
              <div>
                <label
                  htmlFor="mod-ref-tipe"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Tipe
                </label>
                <select
                  id="mod-ref-tipe"
                  value={modulForm.referensiTipe}
                  onChange={(event) =>
                    setModulForm((f) => ({
                      ...f,
                      referensiTipe: event.target.value as TipeReferensi,
                    }))
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  {TIPE_REFERENSI_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="mod-ref-sumber"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {modulForm.referensiTipe === "youtube"
                    ? "URL video YouTube"
                    : modulForm.referensiTipe === "tautan"
                      ? "URL tujuan"
                      : "Isi teks"}
                </label>
                {modulForm.referensiTipe === "teks" ? (
                  <textarea
                    id="mod-ref-sumber"
                    rows={5}
                    required
                    value={modulForm.referensiSumber}
                    onChange={(event) =>
                      setModulForm((f) => ({ ...f, referensiSumber: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                ) : (
                  <input
                    id="mod-ref-sumber"
                    type="url"
                    required
                    placeholder={
                      modulForm.referensiTipe === "youtube"
                        ? "https://youtu.be/... atau https://www.youtube.com/watch?v=..."
                        : "https://..."
                    }
                    value={modulForm.referensiSumber}
                    onChange={(event) =>
                      setModulForm((f) => ({ ...f, referensiSumber: event.target.value }))
                    }
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                )}
                {modulForm.referensiTipe === "youtube" &&
                  modulForm.referensiSumber.trim() &&
                  !ekstrakYoutubeId(modulForm.referensiSumber.trim()) && (
                    <p className="mt-1 text-xs text-red-600">
                      URL tidak dikenali — gunakan salah satu bentuk: youtu.be/{"{id}"},
                      youtube.com/watch?v={"{id}"}, atau youtube.com/embed/{"{id}"}.
                    </p>
                  )}
              </div>

              <div>
                <label
                  htmlFor="mod-ref-deskripsi"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Deskripsi (opsional)
                </label>
                <textarea
                  id="mod-ref-deskripsi"
                  rows={2}
                  value={modulForm.referensiDeskripsi}
                  onChange={(event) =>
                    setModulForm((f) => ({ ...f, referensiDeskripsi: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
            </div>
          )}

          {modulForm.kategori === "evaluasi" && (
          <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="mod-nilai-minimum"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Nilai minimum lulus
              </label>
              <input
                id="mod-nilai-minimum"
                type="number"
                min={0}
                max={100}
                required
                value={modulForm.nilaiMinimum}
                onChange={(event) =>
                  setModulForm((f) => ({ ...f, nilaiMinimum: event.target.value }))
                }
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="mod-maks-percobaan"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Maks percobaan
              </label>
              <input
                id="mod-maks-percobaan"
                type="number"
                min={1}
                required
                value={modulForm.maksPercobaan}
                onChange={(event) =>
                  setModulForm((f) => ({ ...f, maksPercobaan: event.target.value }))
                }
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label
                htmlFor="mod-batas-waktu"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Batas waktu (menit, opsional)
              </label>
              <input
                id="mod-batas-waktu"
                type="number"
                min={1}
                value={modulForm.batasWaktuMenit}
                onChange={(event) =>
                  setModulForm((f) => ({ ...f, batasWaktuMenit: event.target.value }))
                }
                placeholder="Tanpa batas"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={modulForm.acakUrutanSoal}
              onChange={(event) =>
                setModulForm((f) => ({ ...f, acakUrutanSoal: event.target.checked }))
              }
            />
            Acak urutan soal untuk tiap peserta
          </label>

          <div className="space-y-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Pemilihan soal
            </p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode-pemilihan"
                  checked={modulForm.mode === "tetap"}
                  onChange={() => setModulForm((f) => ({ ...f, mode: "tetap" }))}
                />
                Tetap (pilih soal manual)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode-pemilihan"
                  checked={modulForm.mode === "acak"}
                  onChange={() => setModulForm((f) => ({ ...f, mode: "acak" }))}
                />
                Acak (N soal dari satu topik)
              </label>
            </div>

            <div>
              <label
                htmlFor="mod-topik"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {modulForm.mode === "tetap" ? "Saring topik (opsional)" : "Topik"}
              </label>
              <select
                id="mod-topik"
                required={modulForm.mode === "acak"}
                value={modulForm.topikKode}
                onChange={(event) =>
                  setModulForm((f) => ({ ...f, topikKode: event.target.value }))
                }
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">
                  {modulForm.mode === "tetap" ? "Semua topik" : "Pilih topik..."}
                </option>
                {topikList.map((topik) => (
                  <option key={topik.kode} value={topik.kode}>
                    {formatTopikLabel(topik)}
                  </option>
                ))}
              </select>
            </div>

            {modulForm.mode === "acak" ? (
              <div>
                <label
                  htmlFor="mod-jumlah"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Jumlah soal
                </label>
                <input
                  id="mod-jumlah"
                  type="number"
                  min={1}
                  required
                  value={modulForm.jumlah}
                  onChange={(event) =>
                    setModulForm((f) => ({ ...f, jumlah: event.target.value }))
                  }
                  className="mt-1 w-40 rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                {modulForm.topikKode && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Soal aktif tersedia di topik ini: {soalAktifTersedia}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Soal terpilih: {modulForm.soalIds.length}
                </p>
                <div className="max-h-56 overflow-y-auto rounded border border-zinc-200 dark:border-zinc-800">
                  {loadingSoalUntukPemilihan && (
                    <p className="p-3 text-sm text-zinc-500">Memuat...</p>
                  )}
                  {!loadingSoalUntukPemilihan && soalUntukPemilihanError && (
                    <p className="p-3 text-sm text-red-600">
                      Gagal memuat soal: {soalUntukPemilihanError}
                    </p>
                  )}
                  {!loadingSoalUntukPemilihan &&
                    !soalUntukPemilihanError &&
                    soalUntukPemilihan.length === 0 && (
                      <p className="p-3 text-sm text-zinc-500">
                        Tidak ada soal untuk saringan ini.
                      </p>
                    )}
                  {soalUntukPemilihan.map((soal) => (
                    <label
                      key={soal.id}
                      className="flex items-start gap-2 border-b border-zinc-100 px-3 py-2 text-sm last:border-0 dark:border-zinc-900"
                    >
                      <input
                        type="checkbox"
                        checked={modulForm.soalIds.includes(soal.id)}
                        onChange={() => toggleSoalId(soal.id)}
                        className="mt-1"
                      />
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {soal.teks}
                        {!soal.isActive && (
                          <span className="ml-1 text-xs text-zinc-400">(nonaktif)</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          </>
          )}

          {modulError && <p className="text-sm text-red-600">{modulError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={savingModul}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {editingModulId ? "Simpan modul" : "Tambah modul"}
            </button>
            {editingModulId && (
              <button
                type="button"
                onClick={resetModulForm}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Daftar modul</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">Urutan</th>
                <th className="px-4 py-2 font-medium">Judul</th>
                <th className="px-4 py-2 font-medium">Wajib</th>
                <th className="px-4 py-2 font-medium">Nilai min.</th>
                <th className="px-4 py-2 font-medium">Sumber soal</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loadingModul && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loadingModul && modulListError && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-red-600">
                    Gagal memuat modul: {modulListError}
                  </td>
                </tr>
              )}
              {!loadingModul && !modulListError && modulList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    Belum ada modul.
                  </td>
                </tr>
              )}
              {modulList.map((modul) => (
                <tr
                  key={modul.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{modul.urutan}</td>
                  <td className="px-4 py-2 text-black dark:text-zinc-50">{modul.judul}</td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                    {modul.wajib ? "Ya" : "Tidak"}
                  </td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                    {modul.evaluasi?.nilaiMinimum ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                    {ringkasanModul(modul, topikLabel)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => startEditModul(modul)}
                        className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                      >
                        Sunting
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteModul(modul.id)}
                        disabled={deletingModulId === modul.id}
                        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
