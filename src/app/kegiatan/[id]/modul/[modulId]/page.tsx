"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { formatDateTime } from "@/lib/format-date";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { useModulList } from "@/lib/hooks/use-modul-list";
import { usePendaftaranSaya } from "@/lib/hooks/use-pendaftaran-saya";
import { ekstrakYoutubeId } from "@/lib/youtube";
import type {
  AttemptDetailResponse,
  JawabanAttempt,
  MulaiAttemptResponse,
  SoalUntukAttempt,
  SubmitAttemptResponse,
} from "@/types/attempt";
import type { ModulKegiatan } from "@/types/kegiatan";

/**
 * Modul referensi tidak punya skor/attempt (lihat komentar di
 * ModulKegiatan, src/types/kegiatan.ts) — cuma menampilkan konten. Dipisah
 * dari komponen utama supaya alur mulai/mengerjakan/hasil di bawah tetap
 * hanya menangani kategori evaluasi.
 */
function ModulReferensi({ modul, kegiatanId }: { modul: ModulKegiatan; kegiatanId: string }) {
  const referensi = modul.referensi;
  if (!referensi) {
    return null;
  }
  const videoId = referensi.tipe === "youtube" ? ekstrakYoutubeId(referensi.sumber) : null;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h1 className="text-lg font-semibold text-black dark:text-zinc-50">{modul.judul}</h1>
      {referensi.deskripsi && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{referensi.deskripsi}</p>
      )}

      {referensi.tipe === "youtube" &&
        (videoId ? (
          <div className="mx-auto aspect-video w-full max-w-[390px] overflow-hidden rounded-lg bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={modul.judul}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="text-sm text-red-600">
            Video tidak bisa ditampilkan — tautannya tidak valid.
          </p>
        ))}

      {referensi.tipe === "tautan" && (
        <a
          href={referensi.sumber}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded bg-black px-4 py-3 text-center text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Buka tautan
        </a>
      )}

      {referensi.tipe === "teks" && (
        <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
          {referensi.sumber}
        </p>
      )}

      <Link
        href={`/kegiatan/${kegiatanId}`}
        className="block w-full rounded border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
      >
        Kembali ke kegiatan
      </Link>
    </div>
  );
}

type Layar = "mulai" | "mengerjakan" | "hasil";

export default function ModulAttemptPage({
  params,
}: {
  params: Promise<{ id: string; modulId: string }>;
}) {
  const { id: kegiatanId, modulId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptIdDariUrl = searchParams.get("attemptId");

  const { user, profile, loading } = useAuth();

  // Peserta hanya boleh membaca kegiatan isPublished true (lihat catatan di
  // use-kegiatan-list.ts — firestore.rules bukan penyaring).
  const { items: kegiatanList, loading: loadingKegiatan } = useKegiatanList({
    hanyaTerbit: true,
  });
  const kegiatan = useMemo(
    () => kegiatanList.find((item) => item.id === kegiatanId && !item.isArchived) ?? null,
    [kegiatanList, kegiatanId]
  );

  const { items: modulList, loading: loadingModul } = useModulList(kegiatanId);
  const modul = useMemo(
    () => modulList.find((item) => item.id === modulId) ?? null,
    [modulList, modulId]
  );

  const { items: pendaftaranSaya, loading: loadingPendaftaran } = usePendaftaranSaya();
  const pendaftaran = useMemo(
    () => pendaftaranSaya.find((item) => item.kegiatanId === kegiatanId) ?? null,
    [pendaftaranSaya, kegiatanId]
  );

  // Menandai modul referensi ini "sudah dibuka" — sekali saat modulnya
  // terbuka, dan hanya kalau modulId belum ada di pendaftaran.referensiDibuka.
  // ARSITEKTUR §5: kuota tulis harian Firestore terbatas, jadi ini TIDAK
  // dipanggil ulang di setiap render begitu sudah tercatat.
  useEffect(() => {
    if (!modul || modul.kategori !== "referensi" || !pendaftaran) {
      return;
    }
    if (pendaftaran.referensiDibuka.includes(modulId)) {
      return;
    }
    fetchWithAuth("/api/modul/dibuka", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kegiatanId, modulId }),
    }).catch(() => {
      // Diam-diam gagal — bukan penghalang untuk melihat konten referensinya.
    });
  }, [modul, pendaftaran, kegiatanId, modulId]);

  const [layar, setLayar] = useState<Layar>("mulai");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [kadaluarsaPada, setKadaluarsaPada] = useState<string | null>(null);
  const [soal, setSoal] = useState<SoalUntukAttempt[]>([]);
  const [jawaban, setJawaban] = useState<Record<string, string>>({});
  const [hasil, setHasil] = useState<SubmitAttemptResponse | null>(null);

  const [memuatUlang, setMemuatUlang] = useState(Boolean(attemptIdDariUrl));
  const [memulai, setMemulai] = useState(false);
  const [mengonfirmasi, setMengonfirmasi] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  // Pemulihan setelah halaman dimuat ulang — attemptId disimpan di URL,
  // bukan di memori, supaya reload tidak kehilangan attempt yang sedang
  // berlangsung. Lihat GET /api/attempt/[id].
  useEffect(() => {
    if (!attemptIdDariUrl || !user) {
      setMemuatUlang(false);
      return;
    }
    let mounted = true;
    setMemuatUlang(true);
    fetchWithAuth(`/api/attempt/${attemptIdDariUrl}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(typeof body?.error === "string" ? body.error : "Gagal memuat attempt.");
        }
        if (!mounted) {
          return;
        }
        const data = body as AttemptDetailResponse;
        setAttemptId(data.attemptId);
        setKadaluarsaPada(data.kadaluarsaPada);
        setSoal(data.soal);
        if (data.status === "berlangsung") {
          const jawabanAwal: Record<string, string> = {};
          data.jawaban.forEach((item) => {
            jawabanAwal[item.soalId] = item.opsiId;
          });
          setJawaban(jawabanAwal);
          setLayar("mengerjakan");
        } else {
          setHasil({
            skor: data.skor ?? 0,
            benar: data.benar ?? 0,
            total: data.total ?? 0,
            lulus: data.lulus ?? false,
          });
          setLayar("hasil");
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Gagal memuat attempt.");
        }
      })
      .finally(() => {
        if (mounted) {
          setMemuatUlang(false);
        }
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptIdDariUrl, user]);

  async function handleMulai() {
    setError(null);
    setMemulai(true);
    try {
      const res = await fetchWithAuth("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kegiatanId, modulId }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal memulai.");
      }
      const data = body as MulaiAttemptResponse;
      setAttemptId(data.attemptId);
      setKadaluarsaPada(data.kadaluarsaPada);
      setSoal(data.soal);
      setJawaban({});
      setLayar("mengerjakan");
      router.replace(
        `/kegiatan/${kegiatanId}/modul/${modulId}?attemptId=${data.attemptId}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai.");
    } finally {
      setMemulai(false);
    }
  }

  function handlePilihJawaban(soalId: string, opsiId: string) {
    setJawaban((j) => ({ ...j, [soalId]: opsiId }));
  }

  async function handleKirimFinal() {
    if (!attemptId) {
      return;
    }
    setError(null);
    setMengirim(true);
    try {
      const payload: JawabanAttempt[] = Object.entries(jawaban).map(([soalId, opsiId]) => ({
        soalId,
        opsiId,
      }));
      const res = await fetchWithAuth(`/api/attempt/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jawaban: payload }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal mengirim jawaban.");
      }
      setHasil(body as SubmitAttemptResponse);
      setLayar("hasil");
      setMengonfirmasi(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim jawaban.");
    } finally {
      setMengirim(false);
    }
  }

  if (loading || !user || loadingKegiatan || loadingModul || loadingPendaftaran || memuatUlang) {
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

  if (!kegiatan || !modul) {
    return (
      <div className="mx-auto min-h-screen max-w-md space-y-4 bg-zinc-50 px-4 py-10 dark:bg-black">
        <p className="text-sm text-zinc-500">Modul tidak ditemukan.</p>
        <Link
          href={`/kegiatan/${kegiatanId}`}
          className="text-sm font-medium text-black underline dark:text-zinc-50"
        >
          ← Kembali ke kegiatan
        </Link>
      </div>
    );
  }

  if (!pendaftaran) {
    return (
      <div className="mx-auto min-h-screen max-w-md space-y-4 bg-zinc-50 px-4 py-10 dark:bg-black">
        <p className="text-sm text-zinc-500">
          Anda belum terdaftar di kegiatan ini.
        </p>
        <Link
          href={`/kegiatan/${kegiatanId}`}
          className="text-sm font-medium text-black underline dark:text-zinc-50"
        >
          ← Kembali ke kegiatan
        </Link>
      </div>
    );
  }

  if (modul.kategori === "referensi") {
    return (
      <div className="mx-auto min-h-screen max-w-md space-y-5 bg-zinc-50 px-4 py-6 dark:bg-black">
        <Link href={`/kegiatan/${kegiatanId}`} className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke {kegiatan.judul}
        </Link>
        <ModulReferensi modul={modul} kegiatanId={kegiatanId} />
      </div>
    );
  }

  if (modul.kategori !== "evaluasi" || !modul.evaluasi) {
    return (
      <div className="mx-auto min-h-screen max-w-md space-y-4 bg-zinc-50 px-4 py-10 dark:bg-black">
        <p className="text-sm text-zinc-500">Modul tidak ditemukan.</p>
        <Link
          href={`/kegiatan/${kegiatanId}`}
          className="text-sm font-medium text-black underline dark:text-zinc-50"
        >
          ← Kembali ke kegiatan
        </Link>
      </div>
    );
  }

  const evaluasi = modul.evaluasi;
  const jumlahSoalRencana =
    evaluasi.pemilihanSoal.mode === "tetap"
      ? evaluasi.pemilihanSoal.soalIds.length
      : (evaluasi.pemilihanSoal.jumlah ?? 0);
  const hasilSebelumnya = pendaftaran.hasilModul[modulId];
  const percobaanKe = (hasilSebelumnya?.percobaan ?? 0) + 1;

  const jumlahTerjawab = Object.keys(jawaban).length;

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-5 bg-zinc-50 px-4 py-6 dark:bg-black">
      {layar !== "mengerjakan" && (
        <Link href={`/kegiatan/${kegiatanId}`} className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke {kegiatan.judul}
        </Link>
      )}

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
          {error}
        </p>
      )}

      {layar === "mulai" && (
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-lg font-semibold text-black dark:text-zinc-50">{modul.judul}</h1>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Jumlah soal</dt>
              <dd className="text-black dark:text-zinc-50">{jumlahSoalRencana}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Nilai minimum</dt>
              <dd className="text-black dark:text-zinc-50">{evaluasi.nilaiMinimum}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Batas waktu</dt>
              <dd className="text-black dark:text-zinc-50">
                {evaluasi.batasWaktuMenit ? `${evaluasi.batasWaktuMenit} menit` : "Tanpa batas"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Percobaan</dt>
              <dd className="text-black dark:text-zinc-50">
                ke-{percobaanKe} dari {evaluasi.maksPercobaan}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleMulai}
            disabled={memulai || percobaanKe > evaluasi.maksPercobaan}
            className="w-full rounded bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {memulai
              ? "Memulai..."
              : percobaanKe > evaluasi.maksPercobaan
                ? "Batas percobaan tercapai"
                : "Mulai mengerjakan"}
          </button>
        </div>
      )}

      {layar === "mengerjakan" && (
        <div className="space-y-4 pb-24">
          <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
            <p className="text-sm font-medium text-black dark:text-zinc-50">{modul.judul}</p>
            <p className="text-xs text-zinc-500">
              {kadaluarsaPada
                ? `Batas waktu: ${formatDateTime(kadaluarsaPada)}`
                : "Tanpa batas waktu"}{" "}
              · Terjawab {jumlahTerjawab} dari {soal.length}
            </p>
          </div>

          {soal.map((butir, index) => (
            <div
              key={butir.id}
              className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="text-sm font-medium text-black dark:text-zinc-50">
                {index + 1}. {butir.teks}
              </p>
              <div className="space-y-1.5">
                {butir.opsi.map((opsi) => (
                  <label
                    key={opsi.id}
                    className="flex items-start gap-2 rounded border border-zinc-200 p-2.5 text-sm dark:border-zinc-800"
                  >
                    <input
                      type="radio"
                      name={`soal-${butir.id}`}
                      checked={jawaban[butir.id] === opsi.id}
                      onChange={() => handlePilihJawaban(butir.id, opsi.id)}
                      className="mt-0.5"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">{opsi.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mx-auto max-w-md">
              {!mengonfirmasi ? (
                <button
                  type="button"
                  onClick={() => setMengonfirmasi(true)}
                  className="w-full rounded bg-black px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
                >
                  Kirim jawaban
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {jumlahTerjawab} dari {soal.length} soal terjawab. Setelah dikirim, jawaban
                    tidak bisa diubah lagi. Yakin?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleKirimFinal}
                      disabled={mengirim}
                      className="flex-1 rounded bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                    >
                      {mengirim ? "Mengirim..." : "Ya, kirim sekarang"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMengonfirmasi(false)}
                      disabled={mengirim}
                      className="rounded border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {layar === "hasil" && hasil && (
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-lg font-semibold text-black dark:text-zinc-50">{modul.judul}</h1>
          <p className="text-4xl font-semibold text-black dark:text-zinc-50">{hasil.skor}</p>
          <p className="text-sm text-zinc-500">
            {hasil.benar} benar dari {hasil.total} soal
          </p>
          <p
            className={
              hasil.lulus
                ? "text-sm font-semibold text-green-600"
                : "text-sm font-semibold text-red-600"
            }
          >
            {hasil.lulus ? "Lulus" : "Belum lulus"}
          </p>
          <Link
            href={`/kegiatan/${kegiatanId}`}
            className="block w-full rounded bg-black px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Kembali ke kegiatan
          </Link>
        </div>
      )}
    </div>
  );
}
