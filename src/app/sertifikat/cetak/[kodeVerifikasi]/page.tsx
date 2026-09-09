"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { formatDate } from "@/lib/format-date";
import { getSystemParameter } from "@/lib/services/system-parameter";
import { urlVerifikasiSertifikat } from "@/lib/sertifikat-url";
import type { SertifikatDetail } from "@/types/sertifikat";

export default function SertifikatCetakPage({
  params,
}: {
  params: Promise<{ kodeVerifikasi: string }>;
}) {
  const { kodeVerifikasi } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();

  const [data, setData] = useState<SertifikatDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [urlPublik, setUrlPublik] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  // kodeVerifikasi atau user berubah tanpa remount — kembali ke "sedang
  // memuat" di sini saat render, bukan di badan efek (lihat
  // use-soal-list.ts). Kalau user belum ada, tidak ada yang perlu disetel —
  // layar "Memuat..." di bawah sudah tampil karena kondisi !user di
  // gerbang render.
  const [permintaanSebelumnya, setPermintaanSebelumnya] = useState({ kodeVerifikasi, user });
  if (
    permintaanSebelumnya.kodeVerifikasi !== kodeVerifikasi ||
    permintaanSebelumnya.user !== user
  ) {
    setPermintaanSebelumnya({ kodeVerifikasi, user });
    if (user) {
      setLoadingData(true);
      setError(null);
    }
  }

  useEffect(() => {
    if (!user) {
      return;
    }
    let mounted = true;
    fetchWithAuth(`/api/sertifikat/cetak/${kodeVerifikasi}`)
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
  }, [kodeVerifikasi, user]);

  useEffect(() => {
    let mounted = true;
    getSystemParameter().then((param) => {
      if (mounted) {
        setUrlPublik(param.urlPublik);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Alamat verifikasi TIDAK PERNAH dari window.location — lihat komentar di
  // src/lib/sertifikat-url.ts. urlPublik null selama parameter/global belum
  // selesai dimuat; effect ini menunggunya lewat dependency array supaya
  // tidak sempat memakai "" (kosong) sebagai basis sebelum data itu tiba.
  const verifikasiUrl =
    data && urlPublik !== null ? urlVerifikasiSertifikat(data.kodeVerifikasi, urlPublik) : null;

  useEffect(() => {
    if (!verifikasiUrl) {
      // qrDataUrl sudah default null — verifikasiUrl tidak pernah berubah
      // dari terisi ke kosong dalam siklus hidup komponen ini (data dan
      // urlPublik masing-masing cuma dimuat sekali), jadi tidak perlu
      // setState di sini.
      return;
    }
    let mounted = true;
    QRCode.toDataURL(verifikasiUrl, { margin: 1, width: 220 })
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
  }, [verifikasiUrl]);

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
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const adaKop = Boolean(data.template.kopUrl);
  const adaLogoSaja = !adaKop && Boolean(data.template.logoUrl);
  const adaKepala = adaKop || adaLogoSaja;
  const adaPenandatangan = Boolean(
    data.template.tandaTanganUrl || data.template.penandatanganNama || data.template.penandatanganJabatan
  );

  return (
    <div className="min-h-screen bg-zinc-100 py-8 dark:bg-black print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl px-4 print:max-w-none print:px-0">
        <div className="cetak-sembunyi mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Alamat cetak — hanya berisi sertifikat ini.</p>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Cetak
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Halaman ini sudah diatur ke A4 potret secara otomatis — orientasi tidak perlu diubah
            lagi. Saat mencetak, hilangkan centang &quot;Headers and footers&quot; agar tanggal
            dan alamat halaman tidak ikut tercetak.
          </p>
          {urlPublik !== null && !verifikasiUrl && (
            <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              Alamat verifikasi belum dikonfigurasi — atur env NEXT_PUBLIC_SITE_URL saat deploy,
              atau isi &quot;URL publik&quot; di /admin/parameter. Sertifikat ini akan tercetak
              tanpa QR/alamat verifikasi sampai salah satunya diisi.
            </p>
          )}
        </div>

        <div className="cetak-kertas mx-auto w-full rounded-lg border border-zinc-200 bg-white px-4 py-6 text-black shadow-sm sm:px-8 sm:py-10 print:flex print:min-h-screen print:flex-col print:justify-between print:px-2 print:py-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
          {/* Blok atas — tetap di atas halaman saat cetak. */}
          <div className="space-y-5">
            {adaKepala && (
              <div className="text-center">
                {adaKop ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.template.kopUrl} alt="Kop surat" className="mx-auto w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.template.logoUrl} alt="Logo" className="mx-auto h-16 w-auto" />
                )}
              </div>
            )}

            <p className="text-center text-xl font-bold tracking-[0.4em] text-zinc-700 dark:text-zinc-300">
              SERTIFIKAT
            </p>

            <div className="space-y-2 text-center">
              <p className="text-sm text-zinc-500">Diberikan kepada</p>
              <p className="text-4xl font-bold text-black dark:text-zinc-50">{data.namaLengkap}</p>
              <p className="text-sm text-zinc-500">
                atas keikutsertaan dan kelulusan dalam kegiatan
              </p>
              <p className="text-lg font-bold text-black dark:text-zinc-50">{data.judulKegiatan}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Nilai akhir: {data.nilaiAkhir}
              </p>
            </div>

            {data.items.length > 0 && (
              <table className="mx-auto w-full max-w-sm text-center text-xs">
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-zinc-700">
                    <th className="py-1 font-medium">Modul</th>
                    <th className="py-1 font-medium">Skor</th>
                    <th className="py-1 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr
                      key={item.modulId}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-1">{item.judul}</td>
                      <td className="py-1">{item.skor}</td>
                      <td className="py-1">{item.lulus ? "Lulus" : "Belum lulus"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {data.pernyataanAtestasi.length > 0 && (
              <ul className="mx-auto max-w-sm space-y-1 text-center text-sm text-zinc-700 dark:text-zinc-300">
                {data.pernyataanAtestasi.map((kalimat) => (
                  <li key={kalimat}>{kalimat}</li>
                ))}
              </ul>
            )}

            {data.template.teksTambahan && (
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                {data.template.teksTambahan}
              </p>
            )}
          </div>

          {/* Blok bawah — terdorong ke bawah halaman saat cetak
              (print:justify-between di kartu, blok ini jadi anak flex
              kedua). Di layar cuma menyusul dengan jarak biasa. */}
          <div className="mt-8 space-y-3 print:mt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-left text-xs">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR verifikasi" className="h-16 w-16" />
                ) : (
                  <p className="text-red-600">Alamat verifikasi belum dikonfigurasi</p>
                )}
                <p className="font-mono">Kode: {data.kodeVerifikasi}</p>
                <p className="font-mono">Serial: {data.serial}</p>
                {verifikasiUrl && <p className="break-all text-zinc-500">{verifikasiUrl}</p>}
              </div>
              <div className="space-y-1 text-right text-sm">
                <p className="text-zinc-500">{formatDate(data.terbitPada)}</p>
                {adaPenandatangan && (
                  <div className="pt-2">
                    {data.template.tandaTanganUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.template.tandaTanganUrl}
                        alt="Tanda tangan"
                        className="ml-auto h-16 w-auto"
                      />
                    )}
                    {data.template.penandatanganNama && (
                      <p className="font-medium">{data.template.penandatanganNama}</p>
                    )}
                    {data.template.penandatanganJabatan && (
                      <p className="text-zinc-500">{data.template.penandatanganJabatan}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <p className="border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-400 dark:border-zinc-800">
              Daftar di atas hanya memuat materi yang ditetapkan pada kegiatan ini. Bukan dokumen
              negara.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
