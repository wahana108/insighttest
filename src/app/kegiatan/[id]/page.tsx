"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { statusJendelaKegiatan } from "@/lib/kegiatan-jendela";
import { useModulList } from "@/lib/hooks/use-modul-list";
import { usePendaftaranSaya } from "@/lib/hooks/use-pendaftaran-saya";
import { useSertifikatSaya } from "@/lib/hooks/use-sertifikat-saya";
import { evaluasiKelayakan } from "@/lib/sertifikat-syarat";

const KATEGORI_LABEL: Record<string, string> = {
  referensi: "Referensi",
  atestasi: "Atestasi",
  evaluasi: "Evaluasi",
};

export default function KegiatanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  // Peserta hanya boleh membaca kegiatan isPublished true — lihat catatan
  // di src/lib/hooks/use-kegiatan-list.ts (rules Firestore bukan penyaring).
  const {
    items: kegiatanList,
    loading: loadingKegiatan,
    error: kegiatanListError,
  } = useKegiatanList({ hanyaTerbit: true });
  const kegiatan = useMemo(
    () => kegiatanList.find((item) => item.id === id && !item.isArchived) ?? null,
    [kegiatanList, id]
  );

  const { items: modulList, loading: loadingModul, error: modulListError } = useModulList(id);
  const {
    items: pendaftaranSaya,
    loading: loadingPendaftaran,
    error: pendaftaranError,
    refetch,
  } = usePendaftaranSaya();
  const pendaftaranKegiatanIni = useMemo(
    () => pendaftaranSaya.find((item) => item.kegiatanId === id) ?? null,
    [pendaftaranSaya, id]
  );

  const {
    items: sertifikatSaya,
    loading: loadingSertifikat,
    error: sertifikatListError,
    refetch: refetchSertifikat,
  } = useSertifikatSaya();
  const sertifikatKegiatanIni = useMemo(
    () => sertifikatSaya.find((item) => item.kegiatanId === id) ?? null,
    [sertifikatSaya, id]
  );

  const kelayakanSertifikat = useMemo(() => {
    if (!pendaftaranKegiatanIni || !kegiatan) {
      return null;
    }
    return evaluasiKelayakan(
      {
        modulSnapshot: pendaftaranKegiatanIni.modulSnapshot,
        hasilModul: pendaftaranKegiatanIni.hasilModul,
      },
      { syaratSertifikat: kegiatan.syaratSertifikat }
    );
  }, [pendaftaranKegiatanIni, kegiatan]);

  const [mendaftar, setMendaftar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  const [menerbitkan, setMenerbitkan] = useState(false);
  const [errorSertifikat, setErrorSertifikat] = useState<string | null>(null);
  const [sertifikatBaru, setSertifikatBaru] = useState<{
    id: string;
    serial: string;
    terbitPada: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  async function handleDaftar() {
    setError(null);
    setSukses(null);
    setMendaftar(true);
    try {
      const res = await fetchWithAuth("/api/pendaftaran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kegiatanId: id }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal mendaftar.");
      }
      setSukses(`Berhasil mendaftar. Nomor urut Anda: ${body.nomorUrut}.`);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar.");
    } finally {
      setMendaftar(false);
    }
  }

  async function handleTerbitkanSertifikat() {
    setErrorSertifikat(null);
    setMenerbitkan(true);
    try {
      const res = await fetchWithAuth("/api/sertifikat/terbitkan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kegiatanId: id }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof body?.error === "string" ? body.error : "Gagal menerbitkan sertifikat."
        );
      }
      setSertifikatBaru({ id: body.id, serial: body.serial, terbitPada: body.terbitPada });
      refetchSertifikat();
    } catch (err) {
      setErrorSertifikat(
        err instanceof Error ? err.message : "Gagal menerbitkan sertifikat."
      );
    } finally {
      setMenerbitkan(false);
    }
  }

  if (loading || !user || loadingKegiatan) {
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

  if (kegiatanListError) {
    return (
      <div className="mx-auto min-h-screen max-w-2xl space-y-4 bg-zinc-50 px-4 py-10 dark:bg-black">
        <p className="text-sm text-red-600">Gagal memuat kegiatan: {kegiatanListError}</p>
        <Link href="/kegiatan" className="text-sm font-medium text-black underline dark:text-zinc-50">
          ← Kembali ke daftar kegiatan
        </Link>
      </div>
    );
  }

  if (!kegiatan) {
    return (
      <div className="mx-auto min-h-screen max-w-2xl space-y-4 bg-zinc-50 px-4 py-10 dark:bg-black">
        <p className="text-sm text-zinc-500">Kegiatan tidak ditemukan.</p>
        <Link href="/kegiatan" className="text-sm font-medium text-black underline dark:text-zinc-50">
          ← Kembali ke daftar kegiatan
        </Link>
      </div>
    );
  }

  const namaLengkapKosong = !profile?.namaLengkap?.trim();
  const jendelaStatus = statusJendelaKegiatan(kegiatan);

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <Link href="/kegiatan" className="text-sm text-zinc-500 hover:underline">
        ← Kembali ke Kegiatan
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{kegiatan.judul}</h1>
        {kegiatan.deskripsi && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{kegiatan.deskripsi}</p>
        )}
        <p className="mt-2 text-sm text-zinc-500">
          Jendela waktu:{" "}
          {kegiatan.dibukaPada || kegiatan.ditutupPada
            ? `${kegiatan.dibukaPada ? formatDateTime(kegiatan.dibukaPada) : "-"} – ${
                kegiatan.ditutupPada ? formatDateTime(kegiatan.ditutupPada) : "-"
              }`
            : "Tanpa batas waktu"}
        </p>
        {jendelaStatus === "belum_dibuka" && (
          <p className="mt-1 text-sm font-medium text-amber-600">
            Pendaftaran belum dibuka — mulai {formatDateTime(kegiatan.dibukaPada as string)}.
          </p>
        )}
        {jendelaStatus === "sudah_ditutup" && (
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Pendaftaran sudah ditutup pada {formatDateTime(kegiatan.ditutupPada as string)}.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">
          Modul dalam kegiatan ini
        </h2>
        {pendaftaranKegiatanIni ? (
          // Sudah terdaftar — pakai modulSnapshot milik pendaftaran, BUKAN
          // daftar modul hidup. Admin bisa menyunting modul kegiatan setelah
          // ada peserta (KA-5); peserta yang sudah terdaftar harus tetap
          // melihat persis modul yang dinilai untuknya, bukan versi terbaru.
          <ul className="space-y-2">
            {pendaftaranKegiatanIni.modulSnapshot.length === 0 && (
              <p className="text-sm text-zinc-500">Belum ada modul.</p>
            )}
            {pendaftaranKegiatanIni.modulSnapshot.map((modul) => {
              const hasil = pendaftaranKegiatanIni.hasilModul[modul.modulId];
              return (
                <li
                  key={modul.modulId}
                  className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 text-sm last:border-0 last:pb-0 dark:border-zinc-900"
                >
                  <div>
                    <span className="text-black dark:text-zinc-50">{modul.judul}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {KATEGORI_LABEL[modul.kategori] ?? modul.kategori} ·{" "}
                      {modul.wajib ? "Wajib" : "Opsional"}
                    </span>
                    {hasil && (
                      <span
                        className={`ml-2 text-xs font-medium ${hasil.lulus ? "text-green-600" : "text-amber-600"}`}
                      >
                        Skor {hasil.skorTertinggi} · {hasil.lulus ? "Lulus" : "Belum lulus"}
                      </span>
                    )}
                  </div>
                  {modul.kategori === "evaluasi" && (
                    <Link
                      href={`/kegiatan/${id}/modul/${modul.modulId}`}
                      className="shrink-0 text-sm font-medium text-black underline dark:text-zinc-50"
                    >
                      Kerjakan
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          // Belum terdaftar — gambaran isi kegiatan lewat daftar modul hidup.
          <>
            {loadingModul && <p className="text-sm text-zinc-500">Memuat...</p>}
            {!loadingModul && modulListError && (
              <p className="text-sm text-red-600">Gagal memuat modul: {modulListError}</p>
            )}
            {!loadingModul && !modulListError && modulList.length === 0 && (
              <p className="text-sm text-zinc-500">Belum ada modul.</p>
            )}
            <ul className="space-y-2">
              {modulList.map((modul) => (
                <li
                  key={modul.id}
                  className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 text-sm last:border-0 last:pb-0 dark:border-zinc-900"
                >
                  <span className="text-black dark:text-zinc-50">{modul.judul}</span>
                  <span className="text-xs text-zinc-500">
                    {KATEGORI_LABEL[modul.kategori] ?? modul.kategori} ·{" "}
                    {modul.wajib ? "Wajib" : "Opsional"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {loadingPendaftaran ? (
          <p className="text-sm text-zinc-500">Memeriksa status pendaftaran...</p>
        ) : pendaftaranError ? (
          <p className="text-sm text-red-600">
            Gagal memeriksa status pendaftaran: {pendaftaranError}
          </p>
        ) : pendaftaranKegiatanIni ? (
          <p className="text-sm text-green-600">
            Anda sudah terdaftar — nomor urut {pendaftaranKegiatanIni.nomorUrut}.
          </p>
        ) : jendelaStatus !== "terbuka" ? (
          <p className="text-sm text-zinc-500">
            {jendelaStatus === "belum_dibuka"
              ? "Pendaftaran belum dibuka untuk kegiatan ini."
              : "Pendaftaran sudah ditutup untuk kegiatan ini."}
          </p>
        ) : (
          <div className="space-y-3">
            {namaLengkapKosong && (
              <p className="text-sm text-amber-600">
                Lengkapi nama lengkap Anda di{" "}
                <Link href="/profil" className="underline">
                  halaman Profil
                </Link>{" "}
                sebelum mendaftar.
              </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {sukses && <p className="text-sm text-green-600">{sukses}</p>}
            <button
              type="button"
              onClick={handleDaftar}
              disabled={mendaftar || namaLengkapKosong || Boolean(sukses)}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {mendaftar ? "Mendaftar..." : "Daftar"}
            </button>
          </div>
        )}
      </div>

      {pendaftaranKegiatanIni && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold text-black dark:text-zinc-50">Sertifikat</h2>
          {loadingSertifikat ? (
            <p className="text-sm text-zinc-500">Memeriksa sertifikat...</p>
          ) : sertifikatListError ? (
            <p className="text-sm text-red-600">
              Gagal memeriksa sertifikat: {sertifikatListError}
            </p>
          ) : sertifikatKegiatanIni || sertifikatBaru ? (
            <div className="space-y-2">
              <p className="text-sm text-green-600">Sertifikat sudah terbit.</p>
              <p className="text-sm text-black dark:text-zinc-50">
                Serial:{" "}
                <span className="font-mono">
                  {sertifikatKegiatanIni?.serial ?? sertifikatBaru?.serial}
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                Terbit{" "}
                {formatDate(sertifikatKegiatanIni?.terbitPada ?? sertifikatBaru?.terbitPada ?? "")}
              </p>
              <Link
                href={`/sertifikat/${sertifikatKegiatanIni?.id ?? sertifikatBaru?.id}`}
                className="inline-block text-sm font-medium text-black underline dark:text-zinc-50"
              >
                Lihat sertifikat
              </Link>
            </div>
          ) : kegiatan.syaratSertifikat.jenis === "manual_admin" ? (
            <p className="text-sm text-zinc-500">
              Sertifikat kegiatan ini diterbitkan oleh admin, bukan otomatis.
            </p>
          ) : kelayakanSertifikat?.layak ? (
            <div className="space-y-3">
              <p className="text-sm text-green-600">Anda layak menerima sertifikat.</p>
              {errorSertifikat && <p className="text-sm text-red-600">{errorSertifikat}</p>}
              <button
                type="button"
                onClick={handleTerbitkanSertifikat}
                disabled={menerbitkan}
                className="w-full rounded bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {menerbitkan ? "Menerbitkan..." : "Terbitkan sertifikat saya"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">
                {kelayakanSertifikat?.alasan ?? "Belum layak menerima sertifikat."}
              </p>
              <button
                type="button"
                disabled
                title={kelayakanSertifikat?.alasan}
                className="w-full rounded bg-black px-4 py-3 text-sm font-medium text-white opacity-50 dark:bg-white dark:text-black"
              >
                Terbitkan sertifikat saya
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
