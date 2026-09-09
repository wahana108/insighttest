"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { nilaiAtestasi } from "@/lib/atestasi-pernyataan";
import type { TingkatAtestasi } from "@/lib/atestasi-pernyataan";
import { formatSisaWaktu } from "@/lib/format-date";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { useModulList } from "@/lib/hooks/use-modul-list";
import { usePendaftaranSaya } from "@/lib/hooks/use-pendaftaran-saya";
import {
  bacaJawabanTersimpan,
  bersihkanJawabanAttemptLain,
  hapusJawabanTersimpan,
  pulihkanJawaban,
  simpanJawabanTersimpan,
} from "@/lib/jawaban-tersimpan";
import { ekstrakYoutubeId } from "@/lib/youtube";
import type {
  AttemptDetailResponse,
  JawabanAttempt,
  MulaiAttemptResponse,
  SoalUntukAttempt,
  SubmitAttemptResponse,
} from "@/types/attempt";
import type { ModulKegiatan } from "@/types/kegiatan";
import type { HasilAtestasi } from "@/types/pendaftaran";

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

interface LaporanCcl {
  gameId: string;
  hp: number;
  score: number;
  watchCreditSec: number;
  currentTimeSec: number;
  durationSec: number | null;
  chapterIndex: number;
  wave: number;
}

function laporanDariCcl(rec: Record<string, unknown>): LaporanCcl {
  return {
    gameId: typeof rec.game_id === "string" ? rec.game_id : "",
    hp: typeof rec.hp === "number" ? rec.hp : 0,
    score: typeof rec.score === "number" ? rec.score : 0,
    watchCreditSec: typeof rec.watch_credit_sec === "number" ? rec.watch_credit_sec : 0,
    currentTimeSec: typeof rec.current_time_sec === "number" ? rec.current_time_sec : 0,
    durationSec: typeof rec.duration_sec === "number" ? rec.duration_sec : null,
    chapterIndex: typeof rec.chapter_index === "number" ? rec.chapter_index : 0,
    wave: typeof rec.wave === "number" ? rec.wave : 0,
  };
}

function laporanDariHasilTersimpan(hasil: HasilAtestasi): LaporanCcl {
  return {
    gameId: hasil.gameId,
    hp: hasil.hp,
    score: hasil.score,
    watchCreditSec: hasil.watchCreditSec,
    currentTimeSec: hasil.currentTimeSec,
    durationSec: hasil.durationSec,
    chapterIndex: hasil.chapterIndex,
    wave: hasil.chapterIndex + 1,
  };
}

function laporanSama(a: LaporanCcl, b: LaporanCcl): boolean {
  return (
    a.gameId === b.gameId &&
    a.hp === b.hp &&
    a.score === b.score &&
    a.watchCreditSec === b.watchCreditSec &&
    a.currentTimeSec === b.currentTimeSec &&
    a.durationSec === b.durationSec &&
    a.chapterIndex === b.chapterIndex &&
    a.wave === b.wave
  );
}

// Tabel status dan "kredit tercapai dari detikTersaksikan, bukan
// watch_credit_sec mentah" (Slice 7.2a) sekarang hidup di satu tempat:
// nilaiAtestasi() (src/lib/atestasi-pernyataan.ts) — dipakai bersama oleh
// halaman ini, evaluasiKelayakan(), dan kalimat pernyataan sertifikat
// (Slice 7.3), supaya "tuntas" berarti persis sama di mana pun ia dicek.
const LABEL_STATUS_ATESTASI: Record<TingkatAtestasi, string> = {
  belum: "Belum menuntaskan",
  menuntaskan: "Telah menuntaskan",
  memahami: "Telah menuntaskan dan memahami",
};

/**
 * Modul atestasi (game CCL) — memuat game di iframe, mendengarkan
 * telemetrinya, dan menyimpan HANYA laporan terakhir ke server pada tiga
 * momen (ambang tercapai pertama kali, tab disembunyikan, komponen
 * dilepas). TIDAK PERNAH menulis per laporan (~1 pesan/detik selama
 * ratusan–ribuan detik) — itu jebakan kuota tulis harian Firestore
 * (ARSITEKTUR §5). Lihat src/app/api/atestasi/lapor/route.ts untuk sisi
 * server.
 */
function ModulAtestasi({
  modul,
  kegiatanId,
  modulId,
  hasilTersimpan,
}: {
  modul: ModulKegiatan;
  kegiatanId: string;
  modulId: string;
  hasilTersimpan: HasilAtestasi | undefined;
}) {
  const atestasi = modul.atestasi;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fullscreenWrapperRef = useRef<HTMLDivElement>(null);

  // Nilai awal dihitung SEKALI sebagai variabel biasa (bukan lewat ref
  // lain) — membaca ref.current di dalam inisialisasi useRef/useState lain
  // dianggap "akses ref saat render" dan dilarang React Compiler.
  const laporanAwal = hasilTersimpan ? laporanDariHasilTersimpan(hasilTersimpan) : null;
  const detikTersaksikanAwal = hasilTersimpan?.detikTersaksikan ?? 0;
  const ambangSudahTercapaiAwal = atestasi
    ? nilaiAtestasi(atestasi, {
        score: laporanAwal?.score ?? 0,
        detikTersaksikan: detikTersaksikanAwal,
      }).tingkat !== "belum"
    : false;

  // Sumber kebenaran untuk keputusan kapan menulis — TIDAK memicu render
  // (larangan eksplisit spesifikasi: bukan di state yang dirender tiap
  // pesan ~1/detik).
  const laporanTerakhirRef = useRef<LaporanCcl | null>(laporanAwal);
  const terakhirDikirimRef = useRef<LaporanCcl | null>(null);
  const waktuKirimTerakhirRef = useRef(0);
  const ambangTercapaiSudahDikirimRef = useRef(ambangSudahTercapaiAwal);

  // Penghitung "portal menyaksikan keterlibatan nyata" — SESI INI SAJA,
  // selalu mulai dari 0 di setiap mount (server yang menggabungkannya
  // dengan riwayat, lihat POST /api/atestasi/lapor). Bertambah HANYA
  // kalau watch_credit_sec/score/wave/hp berbeda dari pesan sebelumnya;
  // laporan yang identik tidak menambah apa pun.
  const detikTersaksikanSesiRef = useRef(0);
  const pesanSebelumnyaRef = useRef<{
    watchCreditSec: number;
    score: number;
    wave: number;
    hp: number;
    waktu: number;
  } | null>(null);

  // HANYA untuk ditampilkan — disinkronkan dari ref di atas lewat interval
  // yang dijeda (bukan setiap pesan ~1/detik), supaya tidak render tiap
  // detik selama game berjalan.
  const [laporanTampil, setLaporanTampil] = useState<LaporanCcl | null>(laporanAwal);
  const laporanTampilSyncRef = useRef(laporanAwal);
  const [detikTersaksikanTampil, setDetikTersaksikanTampil] = useState(detikTersaksikanAwal);
  const detikTersaksikanTampilSyncRef = useRef(detikTersaksikanAwal);

  const [nickname, setNickname] = useState(hasilTersimpan?.nicknameCcl ?? "");
  const nicknameRef = useRef(nickname);
  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === fullscreenWrapperRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Dipanggil dari onClick tombol — requestFullscreen() HARUS berasal dari
  // gestur pengguna langsung (klik ini), tidak boleh dari effect/async
  // yang tertunda, atau browser menolaknya.
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void fullscreenWrapperRef.current?.requestFullscreen();
    }
  }

  async function kirimLaporan(opsi: { paksa?: boolean } = {}) {
    const laporan = laporanTerakhirRef.current;
    if (!laporan) {
      // Belum pernah menerima laporan sama sekali — tidak ada yang ditulis.
      return;
    }
    if (terakhirDikirimRef.current && laporanSama(laporan, terakhirDikirimRef.current)) {
      return;
    }
    if (!opsi.paksa && Date.now() - waktuKirimTerakhirRef.current < 60_000) {
      return;
    }

    terakhirDikirimRef.current = laporan;
    waktuKirimTerakhirRef.current = Date.now();

    try {
      await fetchWithAuth("/api/atestasi/lapor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // keepalive — permintaan ini juga dikirim saat pagehide/unmount,
        // ketika halaman bisa hilang sebelum fetch biasa sempat selesai.
        keepalive: true,
        body: JSON.stringify({
          kegiatanId,
          modulId,
          gameId: laporan.gameId,
          hp: laporan.hp,
          score: laporan.score,
          watchCreditSec: laporan.watchCreditSec,
          currentTimeSec: laporan.currentTimeSec,
          durationSec: laporan.durationSec,
          chapterIndex: laporan.chapterIndex,
          // Kumulatif SESI INI (bukan sejak-kirim-terakhir) — server yang
          // menghitung pertambahannya terhadap laporTerakhirPada tersimpan
          // (§4, Slice 7.2a).
          detikTersaksikan: detikTersaksikanSesiRef.current,
          nickname: nicknameRef.current.trim() || undefined,
        }),
      });
    } catch {
      // Diam-diam gagal — penyimpanan latar belakang di momen kritis (tab
      // ditutup, dst.), tidak ada UI untuk melapor kegagalan jaringan.
    }
  }

  // Dengarkan telemetri — HANYA terima kalau ketiganya benar: origin,
  // event.source (iframe yang SAMA persis, bukan iframe lain atau skrip
  // konsol), dan data.source. Bedakan CCL_READY dari laporan keadaan
  // berdasarkan BENTUK pesan, sama seperti gerbang verifikasi 7.1
  // (src/lib/verifikasi-atestasi-client.ts) — bukan urutan kedatangan.
  useEffect(() => {
    if (!atestasi) {
      return;
    }
    const originDiizinkan = atestasi.originDiizinkan;
    const ambangKeterlibatan = atestasi.ambangKeterlibatan;
    const targetSkor = atestasi.targetSkor;
    const durasiDetikModul = atestasi.durasiDetik;

    function onMessage(event: MessageEvent) {
      if (event.origin !== originDiizinkan) {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const data = event.data;
      if (typeof data !== "object" || data === null) {
        return;
      }
      const rec = data as Record<string, unknown>;
      if (rec.source !== "CCL_GAME") {
        return;
      }
      if (rec.type === "CCL_READY") {
        // Sinyal siap, bukan laporan keadaan — tidak ada metrik untuk
        // direkam di sini (7.1 sudah memakainya saat verifikasi modul).
        return;
      }
      const terlihatSepertiLaporanKeadaan =
        typeof rec.duration_sec === "number" || rec.type === undefined;
      if (!terlihatSepertiLaporanKeadaan) {
        return;
      }

      const laporan = laporanDariCcl(rec);
      laporanTerakhirRef.current = laporan;

      // "Tersaksikan" — bertambah HANYA kalau salah satu dari empat field
      // ini berbeda dari pesan sebelumnya (bukti keterlibatan nyata, bukan
      // sekadar pesan berkala yang isinya beku).
      const sekarang = Date.now();
      const sebelumnya = pesanSebelumnyaRef.current;
      if (sebelumnya) {
        const berubah =
          laporan.watchCreditSec !== sebelumnya.watchCreditSec ||
          laporan.score !== sebelumnya.score ||
          laporan.wave !== sebelumnya.wave ||
          laporan.hp !== sebelumnya.hp;
        if (berubah) {
          const elapsedSec = (sekarang - sebelumnya.waktu) / 1000;
          detikTersaksikanSesiRef.current += Math.max(0, elapsedSec);
        }
      }
      pesanSebelumnyaRef.current = {
        watchCreditSec: laporan.watchCreditSec,
        score: laporan.score,
        wave: laporan.wave,
        hp: laporan.hp,
        waktu: sekarang,
      };

      const detikTersaksikanSekarang = detikTersaksikanAwal + detikTersaksikanSesiRef.current;
      if (
        !ambangTercapaiSudahDikirimRef.current &&
        nilaiAtestasi(
          { ambangKeterlibatan, targetSkor, durasiDetik: durasiDetikModul },
          { score: laporan.score, detikTersaksikan: detikTersaksikanSekarang }
        ).tingkat !== "belum"
      ) {
        // (a) Ambang tercapai untuk PERTAMA kalinya — kirim SEGERA (paksa,
        // lewati batas 60 detik) supaya hasil baik terselamatkan kalau tab
        // ditutup mendadak sesaat setelah ini. Edge-triggered lewat ref di
        // atas — tidak pernah ditulis ulang untuk alasan yang sama.
        ambangTercapaiSudahDikirimRef.current = true;
        void kirimLaporan({ paksa: true });
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      // (c) Komponen dilepas.
      void kirimLaporan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atestasi?.originDiizinkan]);

  // (b) pagehide atau visibilitychange ke hidden — bisa terpicu berkali-
  // kali kalau peserta gonta-ganti tab; kirimLaporan() sendiri yang
  // memagari duplikat (laporan sama persis) dan laju (maks 1x/60 detik).
  useEffect(() => {
    function onPageHide() {
      void kirimLaporan();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void kirimLaporan();
      }
    }
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan state tampilan dari ref setiap 2 detik, HANYA kalau
  // berubah — bukan setiap pesan (~1/detik) seperti larangan di
  // spesifikasi. Peserta tetap melihat progres bergerak, hanya tidak
  // sehalus per detik.
  useEffect(() => {
    const interval = setInterval(() => {
      const terbaru = laporanTerakhirRef.current;
      if (
        terbaru &&
        (!laporanTampilSyncRef.current || !laporanSama(terbaru, laporanTampilSyncRef.current))
      ) {
        laporanTampilSyncRef.current = terbaru;
        setLaporanTampil(terbaru);
      }
      const detikTerbaru = detikTersaksikanAwal + detikTersaksikanSesiRef.current;
      if (detikTerbaru !== detikTersaksikanTampilSyncRef.current) {
        detikTersaksikanTampilSyncRef.current = detikTerbaru;
        setDetikTersaksikanTampil(detikTerbaru);
      }
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!atestasi) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-red-600">Modul ini belum punya konfigurasi atestasi.</p>
      </div>
    );
  }

  const status = nilaiAtestasi(atestasi, {
    score: laporanTampil?.score ?? 0,
    detikTersaksikan: detikTersaksikanTampil,
  }).tingkat;
  const durasiDiketahui = atestasi.durasiDetik !== null && atestasi.durasiDetik > 0;
  const persenKreditMentah = laporanTampil?.hp ?? 0;
  const persenTersaksikan = durasiDiketahui
    ? Math.min(100, (detikTersaksikanTampil / (atestasi.durasiDetik as number)) * 100)
    : 0;
  const menitTersaksikan = detikTersaksikanTampil / 60;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-black dark:text-zinc-50">{modul.judul}</h1>

      <p className="text-xs text-amber-600 sm:hidden">
        Putar perangkat Anda ke posisi mendatar (landscape) supaya game lebih mudah dibaca.
      </p>

      {atestasi.mintaNicknameCcl && (
        <div>
          <label
            htmlFor="at-nickname"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Nickname CCL
          </label>
          <input
            id="at-nickname"
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            className="mt-1 w-full max-w-sm rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Dipakai admin untuk mencocokkan hasil Anda dengan papan peringkat CCL.
          </p>
        </div>
      )}

      {/* Wadah ini yang di-fullscreen — bilah status IKUT masuk supaya
          tetap terlihat saat layar penuh (§2, Slice 7.2a). */}
      <div ref={fullscreenWrapperRef} className="bg-black">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {durasiDiketahui ? (
              <>
                <span>Kredit tonton (CCL): {Math.round(persenKreditMentah)}%</span>
                <span>Tersaksikan: {Math.round(persenTersaksikan)}%</span>
              </>
            ) : (
              <span>Tersaksikan: {menitTersaksikan.toFixed(1)} menit</span>
            )}
            <span>Skor: {laporanTampil?.score ?? 0}</span>
            <span
              className={
                status === "belum" ? "text-zinc-300" : "font-semibold text-green-400"
              }
            >
              {LABEL_STATUS_ATESTASI[status]}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="shrink-0 rounded border border-zinc-600 px-2 py-1 font-medium text-zinc-100"
          >
            {isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
          </button>
        </div>
        <div className="aspect-video max-h-[80vh] w-full overflow-hidden">
          <iframe
            ref={iframeRef}
            src={atestasi.sumberUrl}
            title={modul.judul}
            className="h-full w-full"
            allow="autoplay; fullscreen"
          />
        </div>
      </div>

      {durasiDiketahui && (
        <p className="text-xs text-zinc-500">
          Persentase &quot;Tersaksikan&quot; yang dipakai untuk menentukan kelayakan, bukan kredit
          tonton dari game.
        </p>
      )}

      <Link
        href={`/kegiatan/${kegiatanId}`}
        className="block w-full max-w-sm rounded border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
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

  // Mencatat dimulaiPada (waktu server) untuk modul atestasi — SEKALI
  // setiap kali halaman ini dibuka, dipakai POST /api/atestasi/lapor untuk
  // memeriksa kewajaran watchCreditSec (§4, Slice 7.2).
  useEffect(() => {
    if (!modul || modul.kategori !== "atestasi" || !pendaftaran) {
      return;
    }
    fetchWithAuth("/api/atestasi/mulai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kegiatanId, modulId }),
    }).catch(() => {
      // Diam-diam gagal — peserta tetap bisa memainkan gamenya; laporan
      // akan ditolak server kalau dimulaiPada betul-betul tidak pernah
      // tercatat (lihat POST /api/atestasi/lapor), bukan gagal diam-diam.
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

  // Jam berdetak untuk penghitung mundur (Slice 3.4b, tertunda) — cuma
  // dijalankan saat benar-benar mengerjakan attempt berbatas waktu, supaya
  // layar lain tidak me-render ulang tiap detik tanpa alasan.
  const [sekarang, setSekarang] = useState(() => Date.now());
  useEffect(() => {
    if (layar !== "mengerjakan" || !kadaluarsaPada) {
      return;
    }
    const id = setInterval(() => setSekarang(Date.now()), 1000);
    return () => clearInterval(id);
  }, [layar, kadaluarsaPada]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  // attemptIdDariUrl atau user berubah tanpa remount — sesuaikan memuatUlang
  // di sini saat render, bukan di badan efek (lihat use-soal-list.ts). Error
  // sengaja tidak disetel ulang di sini — efek aslinya juga tidak pernah
  // membersihkannya di jalur ini, cuma mengisinya lewat catch().
  const [pemulihanSebelumnya, setPemulihanSebelumnya] = useState({ attemptIdDariUrl, user });
  if (
    pemulihanSebelumnya.attemptIdDariUrl !== attemptIdDariUrl ||
    pemulihanSebelumnya.user !== user
  ) {
    setPemulihanSebelumnya({ attemptIdDariUrl, user });
    setMemuatUlang(Boolean(attemptIdDariUrl && user));
  }

  // Pemulihan setelah halaman dimuat ulang — attemptId disimpan di URL,
  // bukan di memori, supaya reload tidak kehilangan attempt yang sedang
  // berlangsung. Lihat GET /api/attempt/[id].
  useEffect(() => {
    if (!attemptIdDariUrl || !user) {
      return;
    }
    let mounted = true;
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
          // jawaban dari server selalu kosong untuk attempt yang masih
          // berlangsung (§5 arsitektur.md — ditulis sekali saat submit).
          // Pemulihan sebenarnya datang dari localStorage, divalidasi
          // terhadap soalId attempt ini — lihat jawaban-tersimpan.ts.
          const soalIds = data.soal.map((butir) => butir.id);
          const jawabanTersimpan = pulihkanJawaban(
            bacaJawabanTersimpan(data.attemptId),
            soalIds
          );
          setJawaban({ ...jawabanAwal, ...jawabanTersimpan });
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
      // Server bisa mengembalikan attempt "berlangsung" yang sudah ada
      // (bukan selalu yang baru) — coba pulihkan drafnya juga; kalau memang
      // baru, bacaJawabanTersimpan() cuma mengembalikan null.
      const soalIds = data.soal.map((butir) => butir.id);
      setJawaban(pulihkanJawaban(bacaJawabanTersimpan(data.attemptId), soalIds));
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

  // Autosave — setiap kali jawaban berubah, simpan ke localStorage. Gratis,
  // tidak menyentuh kuota tulis Firestore sama sekali (lihat komentar di
  // jawaban-tersimpan.ts).
  useEffect(() => {
    if (!attemptId) {
      return;
    }
    simpanJawabanTersimpan(attemptId, jawaban);
  }, [attemptId, jawaban]);

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
      hapusJawabanTersimpan(attemptId);
      bersihkanJawabanAttemptLain(attemptId);
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

  if (modul.kategori === "atestasi") {
    // Lebar penuh dengan padding minimal — BEDA dari wadah sempit
    // max-w-md di kategori lain, supaya game (dan teks di dalamnya)
    // terbaca (§2, Slice 7.2a).
    return (
      <div className="mx-auto min-h-screen w-full max-w-4xl space-y-3 bg-zinc-50 px-2 py-3 dark:bg-black">
        <Link href={`/kegiatan/${kegiatanId}`} className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke {kegiatan.judul}
        </Link>
        <ModulAtestasi
          modul={modul}
          kegiatanId={kegiatanId}
          modulId={modulId}
          hasilTersimpan={pendaftaran.atestasi[modulId]}
        />
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

  // Sisa waktu — cuma berarti kalau attempt ini memang punya kadaluarsaPada
  // (kebijakan bawaan ARSITEKTUR §11 adalah timer mati). Server MENERIMA
  // submit yang datang setelah kadaluarsaPada (lihat POST
  // /api/attempt/[id]/submit) — dinilai seperti biasa dari jawaban yang
  // dikirim, cuma status attempt-nya tercatat "kadaluarsa" alih-alih
  // "selesai". Jadi begitu waktu habis, pesannya mendorong SEGERA
  // mengirim — bukan bilang jawaban akan ditolak (tidak akan).
  const sisaDetik = kadaluarsaPada
    ? Math.max(0, Math.round((new Date(kadaluarsaPada).getTime() - sekarang) / 1000))
    : null;
  const waktuHabis = sisaDetik !== null && sisaDetik <= 0;

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
        <div className="space-y-4 pb-40">
          <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
            <p className="text-sm font-medium text-black dark:text-zinc-50">{modul.judul}</p>
            <p
              className={
                waktuHabis
                  ? "text-xs font-medium text-red-600"
                  : "text-xs text-zinc-500"
              }
            >
              {sisaDetik !== null ? (
                waktuHabis ? (
                  "Waktu habis — jawaban tetap dinilai kalau dikirim, segera kirim"
                ) : (
                  <>Sisa waktu: {formatSisaWaktu(sisaDetik)}</>
                )
              ) : (
                "Tanpa batas waktu"
              )}{" "}
              · Terjawab {jumlahTerjawab} dari {soal.length}
            </p>
          </div>

          <p className="text-xs text-zinc-400">
            Jawaban tersimpan otomatis di perangkat ini dan pulih kalau halaman ini dimuat
            ulang — tapi hanya di perangkat yang sama; berpindah perangkat memulai dari
            kosong.
          </p>

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
                    className="flex min-h-11 items-center gap-2 rounded border border-zinc-200 p-2.5 text-sm dark:border-zinc-800"
                  >
                    <input
                      type="radio"
                      name={`soal-${butir.id}`}
                      checked={jawaban[butir.id] === opsi.id}
                      onChange={() => handlePilihJawaban(butir.id, opsi.id)}
                      className="shrink-0"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">{opsi.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div
            className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white px-4 pt-4 dark:border-zinc-800 dark:bg-zinc-950"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
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
