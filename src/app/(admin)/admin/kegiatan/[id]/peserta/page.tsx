"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { useAuth } from "@/lib/auth/auth-provider";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { izinPanitia } from "@/lib/izin-panitia";
import type { PrasyaratMateri } from "@/lib/sertifikat-syarat";
import type { PesertaAdminRingkas } from "@/types/admin-pendaftaran";

const UKURAN_POTONGAN = 25;

/**
 * Kalimat ringkas keadaan materi untuk kolom Kelayakan (Slice 7.4 §3).
 *
 * Slice 7.6: sebuah kategori ditampilkan kalau (a) syaratnya AKTIF —
 * relevan bagi keputusan admin apa pun keadaannya — ATAU (b) TIDAK aktif
 * TAPI ada modul wajib yang nyatanya belum tuntas — supaya keadaan itu
 * tidak diam-diam hilang dari tampilan hanya karena gerbangnya mati
 * ("jangan pernah mengklaim tuntas ketika gerbangnya mati"). Kategori
 * yang tidak aktif dan semuanya sudah tuntas TETAP disembunyikan — tidak
 * ada yang perlu diketahui admin di situ. Modul yang belum disebut NAMANYA
 * (bukan cuma jumlah), sama seperti pesan ringkasan di halaman peserta.
 */
function deskripsiMateriAdmin(p: PrasyaratMateri): string | null {
  const bagian: string[] = [];

  if (p.referensiWajibTotal > 0 && (p.wajibBukaReferensi || p.referensiBelumDibuka > 0)) {
    const belum = p.referensiPerModul.filter((m) => m.wajib && !m.dibuka);
    if (belum.length === 0) {
      bagian.push(`Referensi: ${p.referensiWajibTotal} dari ${p.referensiWajibTotal} dibuka`);
    } else {
      const gerbang = p.wajibBukaReferensi ? "" : "gerbang tidak aktif — ";
      bagian.push(`Referensi: ${gerbang}belum dibuka: ${belum.map((m) => m.judul).join(", ")}`);
    }
  }

  if (p.atestasiWajibTotal > 0 && (p.atestasiJadiSyarat || p.atestasiBelumTuntas > 0)) {
    const belum = p.atestasiPerModul.filter((m) => m.wajib && m.tingkat === "belum");
    if (belum.length === 0) {
      bagian.push(`Atestasi: ${p.atestasiWajibTotal} dari ${p.atestasiWajibTotal} tuntas`);
    } else {
      const gerbang = p.atestasiJadiSyarat ? "" : "gerbang tidak aktif — ";
      bagian.push(`Atestasi: ${gerbang}belum tuntas: ${belum.map((m) => m.judul).join(", ")}`);
    }
  }

  return bagian.length > 0 ? bagian.join(" · ") : null;
}

interface HasilBarisTerbitkan {
  uid: string;
  ok: boolean;
  serial?: string;
  error?: string;
}

export default function AdminPesertaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: kegiatanId } = use(params);
  const { user, profile } = useAuth();
  const isAdminOrSuper = profile?.role === "admin" || profile?.role === "superadmin";
  const { items: kegiatanList } = useKegiatanList(
    isAdminOrSuper ? {} : { untukPanitiaUid: user?.uid }
  );
  const kegiatan = useMemo(
    () => kegiatanList.find((item) => item.id === kegiatanId) ?? null,
    [kegiatanList, kegiatanId]
  );

  // Satu sumber kebenaran (Slice 8.1) — pasangan penolakannya ada di server
  // (GET /api/admin/pendaftaran dan POST /api/sertifikat/terbitkan[-massal]/
  // cabut memakai izinPanitia() yang sama), bukan cuma disembunyikan di sini.
  const izin = izinPanitia(profile, kegiatan);

  const [items, setItems] = useState<PesertaAdminRingkas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menerbitkan, setMenerbitkan] = useState(false);
  const [progres, setProgres] = useState<{ selesai: number; total: number } | null>(null);
  const [hasilTerbitkan, setHasilTerbitkan] = useState<HasilBarisTerbitkan[] | null>(null);
  const [errorTerbitkan, setErrorTerbitkan] = useState<string | null>(null);

  const [cabutTarget, setCabutTarget] = useState<{ uid: string; namaLengkap: string } | null>(null);
  const [alasanCabut, setAlasanCabut] = useState("");
  const [mencabut, setMencabut] = useState(false);
  const [errorCabut, setErrorCabut] = useState<string | null>(null);

  const [menerbitkanSatuUid, setMenerbitkanSatuUid] = useState<string | null>(null);
  const [errorTerbitSatu, setErrorTerbitSatu] = useState<string | null>(null);

  // muat() cuma menjalankan pengambilan data — tidak menyetel loading/error
  // di badan sinkronnya, supaya efek mount di bawah bisa memanggilnya
  // langsung tanpa kena react-hooks/set-state-in-effect. muatData() (dipakai
  // oleh event handler setelah menerbitkan/mencabut) tetap menyetel ulang
  // ke "sedang memuat" secara sinkron — itu aman karena dipanggil dari
  // handler klik, bukan dari badan efek.
  const muat = useCallback(() => {
    fetchWithAuth(`/api/admin/pendaftaran?kegiatanId=${encodeURIComponent(kegiatanId)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(typeof body?.error === "string" ? body.error : "Gagal memuat peserta.");
        }
        setItems(Array.isArray(body.items) ? body.items : []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Gagal memuat peserta.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [kegiatanId]);

  const muatData = useCallback(() => {
    setLoading(true);
    setError(null);
    muat();
  }, [muat]);

  // kegiatanId berubah tanpa remount — kembali ke "sedang memuat" di sini
  // saat render, bukan di badan efek (lihat use-soal-list.ts).
  const [kegiatanIdSebelumnya, setKegiatanIdSebelumnya] = useState(kegiatanId);
  if (kegiatanIdSebelumnya !== kegiatanId) {
    setKegiatanIdSebelumnya(kegiatanId);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    muat();
  }, [muat]);

  // Bisa dipilih/diterbitkan kalau belum punya sertifikat SAMA SEKALI, atau
  // sertifikatnya sudah dicabut (penerbitan ulang). Hanya status 'berlaku'
  // yang mengunci baris — pencabutan harus bisa dibatalkan.
  const dapatDipilih = useMemo(
    () => items.filter((item) => item.sertifikat?.status !== "berlaku"),
    [items]
  );

  // Rekap ringkas (Slice 8.3 §1) — dihitung dari `items` yang SUDAH dimuat
  // di atas, tidak ada pembacaan Firestore tambahan untuk ini.
  const ringkasan = useMemo(() => {
    const sudahMengerjakanEvaluasi = items.filter((item) =>
      Object.values(item.hasilModul).some((hasil) => hasil.percobaan > 0)
    ).length;
    const lulusNilai = items.filter((item) => item.statusKelayakan === "layak").length;
    const materiTuntas = items.filter((item) => item.prasyaratMateri.tuntas).length;
    const sertifikatTerbit = items.filter((item) => item.sertifikat?.status === "berlaku").length;
    const sertifikatDicabut = items.filter((item) => item.sertifikat?.status === "dicabut").length;
    return {
      totalPendaftar: items.length,
      sudahMengerjakanEvaluasi,
      lulusNilai,
      materiTuntas,
      sertifikatTerbit,
      sertifikatDicabut,
    };
  }, [items]);

  const [mengunduh, setMengunduh] = useState<"koma" | "titik-koma" | null>(null);
  const [errorUnduh, setErrorUnduh] = useState<string | null>(null);

  // GET /api/admin/rekap/[kegiatanId] mengembalikan berkas, bukan JSON —
  // diunduh lewat blob + tautan sementara, bukan window.location, supaya
  // header Authorization (fetchWithAuth) ikut terkirim.
  //
  // DUA tombol, bukan satu dengan tebakan lokal Excel pengguna — mendeteksi
  // lokal dari browser tidak bisa diandalkan (dan salah tebak membuat
  // seluruh baris menumpuk di satu kolom, membingungkan), jadi peserta
  // memilih sendiri lewat percobaan yang mana yang cocok dengan Excel-nya.
  async function handleUnduhRekap(pemisah: "koma" | "titik-koma") {
    setErrorUnduh(null);
    setMengunduh(pemisah);
    try {
      const query = pemisah === "koma" ? "?pemisah=koma" : "";
      const res = await fetchWithAuth(
        `/api/admin/rekap/${encodeURIComponent(kegiatanId)}${query}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.error === "string" ? body.error : "Gagal mengunduh rekap."
        );
      }
      const blob = await res.blob();
      const cocok = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "");
      const namaBerkas = cocok?.[1] ?? `rekap-${kegiatanId}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaBerkas;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorUnduh(err instanceof Error ? err.message : "Gagal mengunduh rekap.");
    } finally {
      setMengunduh(null);
    }
  }

  function toggleSelect(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (prev.size === dapatDipilih.length && dapatDipilih.length > 0) {
        return new Set();
      }
      return new Set(dapatDipilih.map((item) => item.uid));
    });
  }

  async function handleTerbitkanTerpilih() {
    const uids = Array.from(selected);
    if (uids.length === 0) {
      return;
    }
    setErrorTerbitkan(null);
    setHasilTerbitkan(null);
    setMenerbitkan(true);
    setProgres({ selesai: 0, total: uids.length });
    const semuaHasil: HasilBarisTerbitkan[] = [];
    try {
      for (let i = 0; i < uids.length; i += UKURAN_POTONGAN) {
        const potongan = uids.slice(i, i + UKURAN_POTONGAN);
        const res = await fetchWithAuth("/api/sertifikat/terbitkan-massal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kegiatanId, uids: potongan }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(typeof body?.error === "string" ? body.error : "Gagal menerbitkan.");
        }
        const hasilPotongan: HasilBarisTerbitkan[] = Array.isArray(body.hasil) ? body.hasil : [];
        semuaHasil.push(...hasilPotongan);
        setProgres({ selesai: Math.min(i + potongan.length, uids.length), total: uids.length });
      }
      setHasilTerbitkan(semuaHasil);
      setSelected(new Set());
      muatData();
    } catch (err) {
      setErrorTerbitkan(err instanceof Error ? err.message : "Gagal menerbitkan sertifikat.");
    } finally {
      setMenerbitkan(false);
      setProgres(null);
    }
  }

  async function handleTerbitkanSatu(uid: string) {
    setErrorTerbitSatu(null);
    setMenerbitkanSatuUid(uid);
    try {
      const res = await fetchWithAuth("/api/sertifikat/terbitkan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kegiatanId, uid }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal menerbitkan.");
      }
      muatData();
    } catch (err) {
      setErrorTerbitSatu(err instanceof Error ? err.message : "Gagal menerbitkan sertifikat.");
    } finally {
      setMenerbitkanSatuUid(null);
    }
  }

  async function handleKonfirmasiCabut() {
    if (!cabutTarget) {
      return;
    }
    if (!alasanCabut.trim()) {
      setErrorCabut("Alasan pencabutan wajib diisi.");
      return;
    }
    setErrorCabut(null);
    setMencabut(true);
    try {
      const res = await fetchWithAuth("/api/sertifikat/cabut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kegiatanId, uid: cabutTarget.uid, alasan: alasanCabut.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal mencabut sertifikat.");
      }
      setCabutTarget(null);
      setAlasanCabut("");
      muatData();
    } catch (err) {
      setErrorCabut(err instanceof Error ? err.message : "Gagal mencabut sertifikat.");
    } finally {
      setMencabut(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href={`/admin/kegiatan/${kegiatanId}`} className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke Kegiatan
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          Peserta {kegiatan ? `— ${kegiatan.judul}` : ""}
        </h1>
        <p className="text-sm text-zinc-500">
          Pratinjau kelayakan sertifikat. Centang peserta yang mau diterbitkan, lalu
          &quot;Terbitkan terpilih&quot;.
        </p>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-3 lg:grid-cols-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <p className="text-xs text-zinc-500">Pendaftar</p>
            <p className="text-lg font-semibold text-black dark:text-zinc-50">
              {ringkasan.totalPendaftar}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Sudah mengerjakan evaluasi</p>
            <p className="text-lg font-semibold text-black dark:text-zinc-50">
              {ringkasan.sudahMengerjakanEvaluasi}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Lulus nilai</p>
            <p className="text-lg font-semibold text-black dark:text-zinc-50">
              {ringkasan.lulusNilai}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Materi wajib tuntas</p>
            <p className="text-lg font-semibold text-black dark:text-zinc-50">
              {ringkasan.materiTuntas}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Sertifikat terbit</p>
            <p className="text-lg font-semibold text-green-600">{ringkasan.sertifikatTerbit}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Sertifikat dicabut</p>
            <p className="text-lg font-semibold text-red-600">{ringkasan.sertifikatDicabut}</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <p className="text-xs text-zinc-500">
          Di berkas CSV rekap: sel <strong>kosong</strong> pada kolom modul evaluasi/atestasi
          berarti modul itu ada tapi belum dikerjakan peserta (dihitung 0 ke nilai akhir);
          tanda &quot;<strong>-</strong>&quot; berarti modul itu belum ada saat peserta
          bersangkutan mendaftar (tidak dihitung sama sekali).
        </p>
      )}

      {izin.lihatPeserta && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleUnduhRekap("koma")}
              disabled={mengunduh !== null}
              className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {mengunduh === "koma" ? "Mengunduh..." : "Unduh CSV (pemisah koma)"}
            </button>
            <button
              type="button"
              onClick={() => handleUnduhRekap("titik-koma")}
              disabled={mengunduh !== null}
              className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {mengunduh === "titik-koma" ? "Mengunduh..." : "Unduh CSV (pemisah titik koma)"}
            </button>
            {errorUnduh && <p className="text-sm text-red-600">{errorUnduh}</p>}
          </div>
          <p className="text-xs text-zinc-500">
            Kalau kolomnya menumpuk jadi satu saat dibuka di Excel, coba unduhan yang satunya
            lagi — pemisah yang cocok berbeda tergantung region Excel Anda.
          </p>
          <p className="text-xs text-zinc-500">
            Berkas ini memuat data pribadi peserta — email, nomor identitas, dan nomor
            telepon — jadi perlakukan sesuai.
          </p>
        </div>
      )}

      {cabutTarget && (
        <div className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Cabut sertifikat {cabutTarget.namaLengkap}?
          </p>
          <label
            htmlFor="alasan-cabut"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Alasan pencabutan
          </label>
          <textarea
            id="alasan-cabut"
            rows={2}
            value={alasanCabut}
            onChange={(event) => setAlasanCabut(event.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          {errorCabut && <p className="text-sm text-red-600">{errorCabut}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleKonfirmasiCabut}
              disabled={mencabut}
              className="inline-flex min-h-11 items-center justify-center rounded bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {mencabut ? "Mencabut..." : "Cabut sertifikat"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCabutTarget(null);
                setAlasanCabut("");
                setErrorCabut(null);
              }}
              disabled={mencabut}
              className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {izin.terbitkanSertifikat && (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleTerbitkanTerpilih}
          disabled={selected.size === 0 || menerbitkan}
          className="inline-flex min-h-11 items-center justify-center rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {menerbitkan
            ? progres
              ? `Menerbitkan ${progres.selesai} dari ${progres.total}…`
              : "Menerbitkan..."
            : `Terbitkan terpilih (${selected.size})`}
        </button>
        {errorTerbitkan && <p className="text-sm text-red-600">{errorTerbitkan}</p>}
      </div>
      )}

      {hasilTerbitkan && (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="font-medium text-black dark:text-zinc-50">
            Hasil penerbitan ({hasilTerbitkan.filter((h) => h.ok).length} berhasil,{" "}
            {hasilTerbitkan.filter((h) => !h.ok).length} gagal)
          </p>
          <ul className="space-y-1">
            {hasilTerbitkan.map((hasil) => {
              const peserta = items.find((item) => item.uid === hasil.uid);
              return (
                <li key={hasil.uid} className={hasil.ok ? "text-green-600" : "text-red-600"}>
                  {peserta?.namaLengkap ?? hasil.uid}:{" "}
                  {hasil.ok ? `berhasil, serial ${hasil.serial}` : hasil.error}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {errorTerbitSatu && <p className="text-sm text-red-600">{errorTerbitSatu}</p>}

      {loading && <p className="text-sm text-zinc-500">Memuat...</p>}
      {!loading && error && (
        <p className="text-sm text-red-600">Gagal memuat peserta: {error}</p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-black dark:text-zinc-50">
            Belum ada peserta terdaftar.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Peserta akan muncul di sini setelah mereka mendaftar sendiri ke kegiatan ini —
            tidak ada tindakan admin yang bisa dilakukan dari sisi ini.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
      <>
      {/* Kartu di layar sempit — tabel di sm: ke atas (rule 9.2b). */}
      <ul className="space-y-3 sm:hidden">
        {items.map((item) => {
          const terkunci = item.sertifikat?.status === "berlaku";
          const materiAdmin = deskripsiMateriAdmin(item.prasyaratMateri);
          return (
            <li
              key={item.uid}
              className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start gap-3">
                {izin.terbitkanSertifikat && (
                  <input
                    type="checkbox"
                    checked={selected.has(item.uid)}
                    onChange={() => toggleSelect(item.uid)}
                    disabled={terkunci}
                    aria-label={`Pilih ${item.namaLengkap}`}
                    className="mt-1 h-5 w-5 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-black dark:text-zinc-50">
                    {item.nomorUrut}. {item.namaLengkap}
                  </p>
                  <p className="break-words text-zinc-700 dark:text-zinc-300">{item.email}</p>
                </div>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500">Institusi: </span>
                {item.institusi || "-"}
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500">Status: </span>
                {item.status}
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500">Nilai: </span>
                {item.nilaiAkhir}
                {" · "}
                {item.items.filter((modul) => modul.lulus).length}/{item.items.length} modul
                lulus
              </p>
              <div>
                <span className="text-zinc-500">Kelayakan: </span>
                {item.statusKelayakan === "layak" && item.bisaTerbit && (
                  <span className="text-green-600">Layak</span>
                )}
                {item.statusKelayakan === "layak" && !item.bisaTerbit && (
                  <span className="text-amber-600">Nilai OK, materi belum tuntas</span>
                )}
                {item.statusKelayakan === "belum_layak" && (
                  <span className="text-red-600">Belum layak</span>
                )}
                {item.statusKelayakan === "ditentukan_admin" && (
                  <span className="text-zinc-600 dark:text-zinc-400">Ditentukan admin</span>
                )}
                {item.statusKelayakan === "belum_layak" && (
                  <p className="text-xs text-zinc-400">{item.alasanKelayakan}</p>
                )}
                {item.statusKelayakan === "ditentukan_admin" && (
                  <p className="text-xs text-zinc-400">
                    Kegiatan ini bersyarat manual — nilai di atas sebagai bahan pertimbangan.
                  </p>
                )}
                {materiAdmin && <p className="text-xs text-zinc-400">{materiAdmin}</p>}
              </div>
              <p>
                <span className="text-zinc-500">Sertifikat: </span>
                {item.sertifikat ? (
                  <span
                    className={
                      item.sertifikat.status === "berlaku" ? "text-green-600" : "text-zinc-400"
                    }
                  >
                    {item.sertifikat.status === "berlaku" ? "Terbit" : "Dicabut"} ·{" "}
                    <span className="font-mono">{item.sertifikat.serial}</span>
                  </span>
                ) : (
                  <span className="text-zinc-400">Belum terbit</span>
                )}
              </p>
              <div className="pt-1">
                {!izin.terbitkanSertifikat ? (
                  <span className="text-xs text-zinc-400">Hanya lihat</span>
                ) : terkunci ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCabutTarget({ uid: item.uid, namaLengkap: item.namaLengkap })
                    }
                    className="inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:underline"
                  >
                    Cabut
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTerbitkanSatu(item.uid)}
                    disabled={menerbitkanSatuUid === item.uid || menerbitkan}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-black hover:underline disabled:opacity-50 dark:text-zinc-50"
                  >
                    {menerbitkanSatuUid === item.uid
                      ? "Menerbitkan..."
                      : item.sertifikat?.status === "dicabut"
                        ? "Terbitkan ulang"
                        : "Terbit"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 sm:block dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              {izin.terbitkanSertifikat && (
                <th className="px-3 py-2 font-medium">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === dapatDipilih.length}
                    onChange={toggleSelectAll}
                    disabled={dapatDipilih.length === 0}
                    aria-label="Pilih semua yang bisa diterbitkan"
                  />
                </th>
              )}
              <th className="px-3 py-2 font-medium">No.</th>
              <th className="px-3 py-2 font-medium">Nama</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Institusi</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Nilai</th>
              <th className="px-3 py-2 font-medium">Modul lulus</th>
              <th className="px-3 py-2 font-medium">Kelayakan</th>
              <th className="px-3 py-2 font-medium">Sertifikat</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const terkunci = item.sertifikat?.status === "berlaku";
              const materiAdmin = deskripsiMateriAdmin(item.prasyaratMateri);
              return (
                <tr
                  key={item.uid}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  {izin.terbitkanSertifikat && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(item.uid)}
                        onChange={() => toggleSelect(item.uid)}
                        disabled={terkunci}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{item.nomorUrut}</td>
                  <td className="px-3 py-2 text-black dark:text-zinc-50">{item.namaLengkap}</td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{item.email}</td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {item.institusi || "-"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{item.status}</td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{item.nilaiAkhir}</td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {item.items.filter((modul) => modul.lulus).length}/{item.items.length} modul
                    lulus
                  </td>
                  <td className="px-3 py-2">
                    {item.statusKelayakan === "layak" && item.bisaTerbit && (
                      <div>
                        <span className="text-green-600">Layak</span>
                        {materiAdmin && <p className="text-xs text-zinc-400">{materiAdmin}</p>}
                      </div>
                    )}
                    {item.statusKelayakan === "layak" && !item.bisaTerbit && (
                      <div>
                        <span className="text-amber-600">Nilai OK, materi belum tuntas</span>
                        {materiAdmin && <p className="text-xs text-zinc-400">{materiAdmin}</p>}
                      </div>
                    )}
                    {item.statusKelayakan === "belum_layak" && (
                      <div>
                        <span className="text-red-600">Belum layak</span>
                        <p className="text-xs text-zinc-400">{item.alasanKelayakan}</p>
                      </div>
                    )}
                    {item.statusKelayakan === "ditentukan_admin" && (
                      <div>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          Ditentukan admin{materiAdmin && ` · ${materiAdmin}`}
                        </span>
                        <p className="text-xs text-zinc-400">
                          Kegiatan ini bersyarat manual — nilai di samping sebagai bahan
                          pertimbangan.
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {item.sertifikat ? (
                      <span
                        className={
                          item.sertifikat.status === "berlaku" ? "text-green-600" : "text-zinc-400"
                        }
                      >
                        {item.sertifikat.status === "berlaku" ? "Terbit" : "Dicabut"} ·{" "}
                        <span className="font-mono">{item.sertifikat.serial}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400">Belum terbit</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!izin.terbitkanSertifikat ? (
                      <span className="text-xs text-zinc-400">Hanya lihat</span>
                    ) : terkunci ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCabutTarget({ uid: item.uid, namaLengkap: item.namaLengkap })
                        }
                        className="inline-flex min-h-11 items-center text-sm font-medium text-red-600 hover:underline"
                      >
                        Cabut
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTerbitkanSatu(item.uid)}
                        disabled={menerbitkanSatuUid === item.uid || menerbitkan}
                        className="inline-flex min-h-11 items-center text-sm font-medium text-black hover:underline disabled:opacity-50 dark:text-zinc-50"
                      >
                        {menerbitkanSatuUid === item.uid
                          ? "Menerbitkan..."
                          : item.sertifikat?.status === "dicabut"
                            ? "Terbitkan ulang"
                            : "Terbit"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}
