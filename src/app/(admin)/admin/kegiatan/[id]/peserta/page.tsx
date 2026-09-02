"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import type { PesertaAdminRingkas } from "@/types/admin-pendaftaran";

const UKURAN_POTONGAN = 25;

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
  const { items: kegiatanList } = useKegiatanList();
  const kegiatan = useMemo(
    () => kegiatanList.find((item) => item.id === kegiatanId) ?? null,
    [kegiatanList, kegiatanId]
  );

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

  const muatData = useCallback(() => {
    setLoading(true);
    setError(null);
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

  useEffect(() => {
    muatData();
  }, [muatData]);

  // Bisa dipilih/diterbitkan kalau belum punya sertifikat SAMA SEKALI, atau
  // sertifikatnya sudah dicabut (penerbitan ulang). Hanya status 'berlaku'
  // yang mengunci baris — pencabutan harus bisa dibatalkan.
  const dapatDipilih = useMemo(
    () => items.filter((item) => item.sertifikat?.status !== "berlaku"),
    [items]
  );

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
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
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
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleTerbitkanTerpilih}
          disabled={selected.size === 0 || menerbitkan}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {menerbitkan
            ? progres
              ? `Menerbitkan ${progres.selesai} dari ${progres.total}…`
              : "Menerbitkan..."
            : `Terbitkan terpilih (${selected.size})`}
        </button>
        {errorTerbitkan && <p className="text-sm text-red-600">{errorTerbitkan}</p>}
      </div>

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

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-medium">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === dapatDipilih.length}
                  onChange={toggleSelectAll}
                  disabled={dapatDipilih.length === 0}
                  aria-label="Pilih semua yang bisa diterbitkan"
                />
              </th>
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
            {loading && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-zinc-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-red-600">
                  Gagal memuat peserta: {error}
                </td>
              </tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-zinc-500">
                  Belum ada peserta terdaftar.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const terkunci = item.sertifikat?.status === "berlaku";
              return (
                <tr
                  key={item.uid}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(item.uid)}
                      onChange={() => toggleSelect(item.uid)}
                      disabled={terkunci}
                    />
                  </td>
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
                    {item.statusKelayakan === "layak" && (
                      <span className="text-green-600">Layak</span>
                    )}
                    {item.statusKelayakan === "belum_layak" && (
                      <span className="text-red-600" title={item.alasanKelayakan}>
                        Belum layak
                      </span>
                    )}
                    {item.statusKelayakan === "ditentukan_admin" && (
                      <div>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          Ditentukan admin
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
                    {terkunci ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCabutTarget({ uid: item.uid, namaLengkap: item.namaLengkap })
                        }
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Cabut
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTerbitkanSatu(item.uid)}
                        disabled={menerbitkanSatuUid === item.uid || menerbitkan}
                        className="text-sm font-medium text-black hover:underline disabled:opacity-50 dark:text-zinc-50"
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
    </div>
  );
}
