"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { formatDate } from "@/lib/format-date";
import type { SertifikatDetail } from "@/types/sertifikat";

export default function SertifikatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();

  const [data, setData] = useState<SertifikatDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let mounted = true;
    setLoadingData(true);
    setError(null);
    fetchWithAuth(`/api/sertifikat/${id}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof body?.error === "string" ? body.error : "Gagal memuat sertifikat."
          );
        }
        if (mounted) {
          setData(body as SertifikatDetail);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Gagal memuat sertifikat.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingData(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [id, user]);

  useEffect(() => {
    if (!data) {
      return;
    }
    let mounted = true;
    const url = `${window.location.origin}/s/${data.kodeVerifikasi}`;
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then((dataUrl) => {
        if (mounted) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (mounted) {
          setQrDataUrl(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [data]);

  if (loading || !user || loadingData) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Memuat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto min-h-screen max-w-2xl space-y-4 bg-zinc-50 px-4 py-10 dark:bg-black">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/beranda" className="text-sm font-medium text-black underline dark:text-zinc-50">
          ← Kembali ke Beranda
        </Link>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const adaLogoAtauKop = Boolean(data.template.logoUrl || data.template.kopUrl);
  const adaPenandatangan = Boolean(
    data.template.penandatanganNama || data.template.tandaTanganUrl
  );

  return (
    <div className="min-h-screen bg-zinc-100 py-8 dark:bg-black">
      <div className="mx-auto max-w-3xl px-4">
        <div className="cetak-sembunyi mb-4 flex items-center justify-between">
          <Link href="/beranda" className="text-sm text-zinc-500 hover:underline">
            ← Kembali ke Beranda
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Cetak
          </button>
        </div>

        <div className="cetak-kertas space-y-6 rounded-lg border border-zinc-200 bg-white p-6 text-black shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
          {adaLogoAtauKop && (
            <div className="flex items-center justify-center gap-6">
              {data.template.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.template.logoUrl} alt="Logo" className="h-16 w-auto" />
              )}
              {data.template.kopUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.template.kopUrl} alt="Kop surat" className="h-16 w-auto" />
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-sm uppercase tracking-wide text-zinc-500">Sertifikat</p>
            <h1 className="mt-1 text-2xl font-semibold">{data.namaLengkap}</h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{data.judulKegiatan}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 border-y border-zinc-200 py-4 text-sm dark:border-zinc-800 sm:grid-cols-4">
            <div>
              <p className="text-zinc-500">Serial</p>
              <p className="font-mono">{data.serial}</p>
            </div>
            <div>
              <p className="text-zinc-500">Tanggal terbit</p>
              <p>{formatDate(data.terbitPada)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Nilai akhir</p>
              <p>{data.nilaiAkhir}</p>
            </div>
            <div>
              <p className="text-zinc-500">Status</p>
              <p className={data.status === "berlaku" ? "text-green-600" : "text-red-600"}>
                {data.status === "berlaku" ? "Berlaku" : "Dicabut"}
              </p>
            </div>
          </div>

          {data.items.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-300 dark:border-zinc-700">
                  <th className="py-1 font-medium">Modul</th>
                  <th className="py-1 font-medium">Skor</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.modulId} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-1">{item.judul}</td>
                    <td className="py-1">{item.skor}</td>
                    <td className="py-1">{item.lulus ? "Lulus" : "Belum lulus"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data.template.teksTambahan && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{data.template.teksTambahan}</p>
          )}

          <div className="flex flex-wrap items-end justify-between gap-6">
            {adaPenandatangan && (
              <div className="text-sm">
                {data.template.tandaTanganUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.template.tandaTanganUrl}
                    alt="Tanda tangan"
                    className="h-16 w-auto"
                  />
                )}
                {data.template.penandatanganNama && (
                  <p className="mt-1 font-medium">{data.template.penandatanganNama}</p>
                )}
                {data.template.penandatanganJabatan && (
                  <p className="text-zinc-500">{data.template.penandatanganJabatan}</p>
                )}
              </div>
            )}
            <div className="ml-auto text-center text-xs">
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR verifikasi" className="mx-auto h-24 w-24" />
              )}
              <p className="mt-1 font-mono">{data.kodeVerifikasi}</p>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-400">
            Daftar di atas hanya memuat materi yang ditetapkan pada kegiatan ini. Bukan dokumen
            negara.
          </p>
        </div>
      </div>
    </div>
  );
}
