"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { useAuth } from "@/lib/auth/auth-provider";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import { izinPanitia } from "@/lib/izin-panitia";
import { keCsv, type SelRekap } from "@/lib/rekap-csv";
import { headerTemplatImporCsv } from "@/lib/services/impor-hadir";
import { petakanNiatDukunganKeBarisImpor } from "@/lib/niat-dukungan";
import type { NiatDukungan } from "@/types/niat-dukungan";

const LABEL_DIBUAT_OLEH: Record<string, string> = {
  sendiri: "Sendiri",
  admin: "Admin",
};

const LABEL_STATUS: Record<string, string> = {
  terkirim: "Terkirim",
  gagal: "Gagal",
};

/**
 * Slice "niat-dukungan" (6b) — daftar niat dukungan satu kegiatan, untuk
 * admin/panitia mencocokkan dengan daftar donatur Saweria. niat_dukungan
 * server-only (firestore.rules) — daftar ini SELALU lewat GET
 * /api/admin/kegiatan/[kegiatanId]/dukungan, tidak pernah client SDK.
 */
export default function AdminDukunganPage({
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
  // (GET /api/admin/kegiatan/[kegiatanId]/dukungan memakai izinPanitia()
  // yang sama), bukan cuma disembunyikan di sini.
  const izin = izinPanitia(profile, kegiatan);

  const [items, setItems] = useState<NiatDukungan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Slice "urutan-dukungan" (6c) — sama pola dengan handleUnduhRekap()
  // (src/app/(admin)/admin/kegiatan/[id]/peserta/page.tsx): DUA tombol,
  // bukan satu dengan tebakan lokal Excel pengguna. Pemisah/pengapit/BOM
  // di GET /api/admin/kegiatan/[kegiatanId]/dukungan SUDAH SAMA PERSIS
  // dengan GET /api/admin/rekap/[kegiatanId] sejak awal (keduanya memakai
  // keCsv() yang sama, bawaan titik koma, ?pemisah=koma sebagai pilihan) —
  // yang tadinya beda cuma UI ini hanya punya satu tombol (selalu memakai
  // bawaan titik koma, tidak pernah memberi pilihan koma).
  const [mengunduh, setMengunduh] = useState<"koma" | "titik-koma" | null>(null);
  // Slice "csv-siap-impor" (6d) — dibangun LANGSUNG dari `items` yang sudah
  // dimuat untuk tabel di bawah (tidak lewat route server terpisah): tidak
  // ada data baru yang dibutuhkan selain yang sudah ada di halaman ini.
  const [mengunduhImpor, setMengunduhImpor] = useState(false);

  const muat = useCallback(() => {
    fetchWithAuth(`/api/admin/kegiatan/${encodeURIComponent(kegiatanId)}/dukungan`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(typeof body?.error === "string" ? body.error : "Gagal memuat daftar dukungan.");
        }
        setItems(Array.isArray(body?.items) ? body.items : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat daftar dukungan."))
      .finally(() => setLoading(false));
  }, [kegiatanId]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function handleUnduhCsv(pemisah: "koma" | "titik-koma") {
    setError(null);
    setMengunduh(pemisah);
    try {
      const query = pemisah === "koma" ? "&pemisah=koma" : "";
      const res = await fetchWithAuth(
        `/api/admin/kegiatan/${encodeURIComponent(kegiatanId)}/dukungan?format=csv${query}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal mengunduh CSV.");
      }
      const blob = await res.blob();
      const cocok = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "");
      const namaBerkas = cocok?.[1] ?? `dukungan-${kegiatanId}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaBerkas;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunduh CSV.");
    } finally {
      setMengunduh(null);
    }
  }

  /**
   * Slice "csv-siap-impor" (6d) — SELURUH baris niat dukungan kegiatan ini
   * (tidak disaring status), dipetakan ke kolom yang PERSIS sama dengan
   * headerTemplatImporCsv() supaya siap ditempel ke Impor peserta.
   * HANYA pemisah koma (bukan pilihan koma/titik-koma seperti dua tombol
   * di atas) — uraiDaftarHadir() (importir) hanya mengenali TAB atau KOMA
   * sebagai pemisah, tidak titik koma; menyediakan pilihan titik-koma di
   * sini akan membuat berkasnya rusak kalau ditempel mentah ke importir.
   * Dibangun sinkron dari `items`/`kegiatan` yang sudah dimuat di halaman
   * ini — tidak ada panggilan jaringan baru.
   */
  function handleUnduhCsvImpor() {
    if (!kegiatan) {
      return;
    }
    setMengunduhImpor(true);
    try {
      const header = headerTemplatImporCsv(kegiatan.formulirPeserta);
      const baris: SelRekap[][] = [
        header,
        ...items.map((item) => petakanNiatDukunganKeBarisImpor(item, kegiatan.formulirPeserta)),
      ];
      const BOM_UTF8 = String.fromCharCode(0xfeff);
      const isiBerkas = BOM_UTF8 + keCsv(baris, ",");
      const blob = new Blob([isiBerkas], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dukungan-siap-impor-${kegiatanId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setMengunduhImpor(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/admin/kegiatan/${kegiatanId}`} className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke kegiatan
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          Daftar dukungan{kegiatan ? ` — ${kegiatan.judul}` : ""}
        </h1>
      </div>

      {!izin.boleh ? (
        <p className="text-sm text-zinc-500">Anda tidak berwenang melihat halaman ini.</p>
      ) : (
        <>
          <BuatkanCatatan kegiatanId={kegiatanId} onBerhasil={muat} />

          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-500">{items.length} catatan.</p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleUnduhCsv("koma")}
                  disabled={mengunduh !== null}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {mengunduh === "koma" ? "Mengunduh..." : "Unduh CSV (pemisah koma)"}
                </button>
                <button
                  type="button"
                  onClick={() => handleUnduhCsv("titik-koma")}
                  disabled={mengunduh !== null}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {mengunduh === "titik-koma" ? "Mengunduh..." : "Unduh CSV (pemisah titik koma)"}
                </button>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Kalau kolomnya menumpuk jadi satu saat dibuka di Excel, coba unduhan yang satunya.
            </p>
          </div>

          <div className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={handleUnduhCsvImpor}
              disabled={mengunduhImpor || !kegiatan}
              className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
            >
              {mengunduhImpor ? "Mengunduh..." : "Unduh CSV siap impor"}
            </button>
            <p className="text-xs text-zinc-500">
              Berkas ini bisa langsung ditempel ke Impor peserta. Saring dulu barisnya di
              spreadsheet — semua baris ikut terunduh, termasuk yang belum Anda setujui.
            </p>
          </div>

          {loading && <p className="text-sm text-zinc-500">Memuat...</p>}
          {!loading && error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-zinc-500">Belum ada catatan dukungan untuk kegiatan ini.</p>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nama dipakai</th>
                    <th className="px-3 py-2 font-medium">Email akun</th>
                    <th className="px-3 py-2 font-medium">Nominal</th>
                    <th className="px-3 py-2 font-medium">Catatan</th>
                    <th className="px-3 py-2 font-medium">Waktu</th>
                    <th className="px-3 py-2 font-medium">Dibuat oleh</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-100 align-top last:border-0 dark:border-zinc-900"
                    >
                      <td className="px-3 py-2 text-black dark:text-zinc-50">{item.namaDipakai}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{item.email}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {item.nominal ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {item.catatan || "-"}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{item.dibuatPada}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {LABEL_DIBUAT_OLEH[item.dibuatOleh] ?? item.dibuatOleh}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            item.status === "terkirim"
                              ? "text-green-600"
                              : "text-red-600"
                          }
                          title={item.alasanGagal || undefined}
                        >
                          {LABEL_STATUS[item.status] ?? item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * "Buatkan catatan untuk peserta" — memanggil POST /api/dukungan/admin
 * (Slice "niat-dukungan" §5). Dipakai saat donatur tidak mengisi formulir
 * sendiri (mis. tidak punya akun saat menyumbang) tapi sudah punya akun
 * SEKARANG dan admin ingin mengirimkan kode akses atas namanya.
 */
function BuatkanCatatan({
  kegiatanId,
  onBerhasil,
}: {
  kegiatanId: string;
  onBerhasil: () => void;
}) {
  const [email, setEmail] = useState("");
  const [namaDipakai, setNamaDipakai] = useState("");
  const [nominal, setNominal] = useState("");
  const [catatan, setCatatan] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasil, setHasil] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setHasil(null);
    setMengirim(true);
    try {
      const res = await fetchWithAuth("/api/dukungan/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kegiatanId,
          email,
          namaDipakai,
          nominal: nominal.trim() ? Number(nominal) : undefined,
          catatan,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal membuat catatan.");
      }
      if (body.sudahAda) {
        setHasil(`Catatan untuk ${body.ke} sudah ada sebelumnya — tidak dikirim ulang.`);
      } else if (body.terkirim) {
        setHasil(`Kode akses berhasil dikirim ke ${body.ke}.`);
      } else {
        setHasil(`Catatan dibuat, tapi email gagal terkirim: ${body.alasanGagal}`);
      }
      setEmail("");
      setNamaDipakai("");
      setNominal("");
      setCatatan("");
      onBerhasil();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat catatan.");
    } finally {
      setMengirim(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Buatkan catatan untuk peserta
      </p>
      <p className="text-xs text-zinc-500">
        Untuk donatur yang tidak mengisi formulir sendiri. Akunnya HARUS sudah ada — buat
        atau impor akunnya dulu kalau belum.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="dk-email" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Email akun peserta
          </label>
          <input
            id="dk-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div>
          <label htmlFor="dk-nama" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Nama yang dipakai
          </label>
          <input
            id="dk-nama"
            type="text"
            required
            value={namaDipakai}
            onChange={(event) => setNamaDipakai(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div>
          <label htmlFor="dk-nominal" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Nominal (opsional)
          </label>
          <input
            id="dk-nominal"
            type="number"
            min={0}
            value={nominal}
            onChange={(event) => setNominal(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div>
          <label htmlFor="dk-catatan" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Catatan (opsional)
          </label>
          <input
            id="dk-catatan"
            type="text"
            value={catatan}
            onChange={(event) => setCatatan(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hasil && <p className="text-xs text-green-600">{hasil}</p>}
      <button
        type="submit"
        disabled={mengirim}
        className="inline-flex min-h-11 items-center rounded bg-black px-4 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {mengirim ? "Mengirim..." : "Buat dan kirim kode"}
      </button>
    </form>
  );
}
