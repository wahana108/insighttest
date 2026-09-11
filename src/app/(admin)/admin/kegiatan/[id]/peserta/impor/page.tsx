"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { WajibAdmin } from "@/app/(admin)/_wajib-admin";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { auth } from "@/lib/firebase/client";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";
import {
  contohBarisImporCsv,
  headerTemplatImporCsv,
  kolomTambahanUntukFormulir,
  MAKS_BARIS_IMPOR_HADIR,
  type HasilBarisHadir,
  type KolomTambahanImpor,
  type StatusBarisHadir,
} from "@/lib/services/impor-hadir";

// Potongan kecil per permintaan eksekusi — batas laju pembuatan akun
// Firebase Auth DAN supaya progres bisa dilaporkan per baris (BAGIAN f),
// sama pola dengan handleTerbitkanTerpilih() di halaman peserta.
const UKURAN_POTONGAN_EKSEKUSI = 10;
const JEDA_ANTAR_TAUTAN_MS = 300;

type HasilBarisEksekusi =
  | { baris: number; email: string; hasil: "berhasil"; akunBaru: boolean; uid: string; nomorUrut: number }
  | { baris: number; email: string; hasil: "dilewati"; pesan: string }
  | { baris: number; email: string; hasil: "gagal"; pesan: string };

interface HasilPratinjau {
  ok: boolean;
  kolomTambahan?: KolomTambahanImpor[];
  baris?: HasilBarisHadir[];
  batasBaris?: number;
  pemisahMungkinSalah?: boolean;
  error?: string;
}

const LABEL_STATUS: Record<StatusBarisHadir, string> = {
  akan_dibuatkan_akun: "Akan dibuatkan akun",
  akun_sudah_ada: "Akun sudah ada",
  sudah_terdaftar: "Sudah terdaftar",
  duplikat_dalam_tempelan: "Duplikat dalam tempelan",
  baris_tidak_sah: "Baris tidak sah",
  data_wajib_kurang: "Data wajib kurang",
};

function badgeClass(status: StatusBarisHadir): string {
  if (status === "akan_dibuatkan_akun" || status === "akun_sudah_ada") {
    return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400";
  }
  if (status === "sudah_terdaftar") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  }
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
}

const LABEL_KOLOM_TAMBAHAN: Record<KolomTambahanImpor, string> = {
  institusi: "institusi",
  nomorIdentitas: "nomor identitas",
  noTelepon: "no. telepon",
};

export default function AdminImporHadirPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <WajibAdmin>
      <AdminImporHadirPageIsi params={params} />
    </WajibAdmin>
  );
}

function AdminImporHadirPageIsi({ params }: { params: Promise<{ id: string }> }) {
  const { id: kegiatanId } = use(params);
  const { items: kegiatanList } = useKegiatanList({});
  const kegiatan = useMemo(
    () => kegiatanList.find((item) => item.id === kegiatanId) ?? null,
    [kegiatanList, kegiatanId]
  );
  const kolomTambahan = useMemo(
    () => (kegiatan ? kolomTambahanUntukFormulir(kegiatan.formulirPeserta) : []),
    [kegiatan]
  );
  const formatKolom = ["email", "nama lengkap", ...kolomTambahan.map((k) => LABEL_KOLOM_TAMBAHAN[k])].join(
    ", "
  );
  const contohBaris = kegiatan ? contohBarisImporCsv(kegiatan.formulirPeserta) : "";

  // Slice 6.2a (CACAT 2a) — templat DIBUAT DARI kegiatan ini, bukan statis:
  // hanya kolom yang formulirPeserta-nya bukan 'tidak', ditandai "(wajib)"
  // kalau memang wajib. BOM UTF-8 sama seperti unduhan rekap CSV lain
  // (src/app/api/admin/rekap/[kegiatanId]/route.ts) supaya Excel tidak
  // merusak karakter beraksen.
  function handleUnduhTemplat() {
    if (!kegiatan) {
      return;
    }
    const header = headerTemplatImporCsv(kegiatan.formulirPeserta);
    const BOM_UTF8 = String.fromCharCode(0xfeff);
    const isi = BOM_UTF8 + header.join(",") + "\r\n";
    const blob = new Blob([isi], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `templat-impor-hadir-${kegiatanId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const [teks, setTeks] = useState("");
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [memeriksa, setMemeriksa] = useState(false);
  const [pratinjau, setPratinjau] = useState<HasilPratinjau | null>(null);
  const [errorPratinjau, setErrorPratinjau] = useState<string | null>(null);

  const [mengeksekusi, setMengeksekusi] = useState(false);
  const [progresEksekusi, setProgresEksekusi] = useState<{ selesai: number; total: number } | null>(
    null
  );
  const [hasilEksekusi, setHasilEksekusi] = useState<HasilBarisEksekusi[] | null>(null);
  const [errorEksekusi, setErrorEksekusi] = useState<string | null>(null);

  const [mengirimTautan, setMengirimTautan] = useState(false);
  const [progresTautan, setProgresTautan] = useState<{ selesai: number; total: number } | null>(null);
  const [hasilTautan, setHasilTautan] = useState<{ email: string; ok: boolean; pesan?: string }[] | null>(
    null
  );

  const isStale = checkedText !== null && checkedText !== teks;
  const barisSiapEksekusi = useMemo(
    () => (pratinjau?.baris ?? []).filter((baris) => baris.akanDieksekusi),
    [pratinjau]
  );
  const bisaEksekusi =
    pratinjau?.ok === true && !isStale && barisSiapEksekusi.length > 0 && !mengeksekusi;

  async function handlePeriksa() {
    setErrorPratinjau(null);
    setPratinjau(null);
    setHasilEksekusi(null);
    setHasilTautan(null);
    setMemeriksa(true);
    try {
      const res = await fetchWithAuth(`/api/admin/kegiatan/${kegiatanId}/impor-hadir/pratinjau`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teks }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal memeriksa tempelan.");
      }
      setPratinjau(body);
      setCheckedText(teks);
    } catch (err) {
      setErrorPratinjau(err instanceof Error ? err.message : "Gagal memeriksa tempelan.");
    } finally {
      setMemeriksa(false);
    }
  }

  async function handleEksekusi() {
    if (barisSiapEksekusi.length === 0) {
      return;
    }
    setErrorEksekusi(null);
    setMengeksekusi(true);
    setProgresEksekusi({ selesai: 0, total: barisSiapEksekusi.length });
    const semuaHasil: HasilBarisEksekusi[] = [];
    try {
      for (let i = 0; i < barisSiapEksekusi.length; i += UKURAN_POTONGAN_EKSEKUSI) {
        const potongan = barisSiapEksekusi.slice(i, i + UKURAN_POTONGAN_EKSEKUSI);
        const res = await fetchWithAuth(`/api/admin/kegiatan/${kegiatanId}/impor-hadir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baris: potongan }),
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(typeof body?.error === "string" ? body.error : "Gagal mengeksekusi impor.");
        }
        const hasilPotongan: HasilBarisEksekusi[] = Array.isArray(body.hasil) ? body.hasil : [];
        semuaHasil.push(...hasilPotongan);
        setProgresEksekusi({
          selesai: Math.min(i + potongan.length, barisSiapEksekusi.length),
          total: barisSiapEksekusi.length,
        });
      }
      setHasilEksekusi(semuaHasil);
    } catch (err) {
      // BAGIAN g — potongan yang SUDAH selesai tetap ditampilkan; error
      // hanya menghentikan potongan berikutnya, tidak menyembunyikan hasil
      // yang sudah didapat.
      setHasilEksekusi(semuaHasil);
      setErrorEksekusi(err instanceof Error ? err.message : "Gagal mengeksekusi impor.");
    } finally {
      setMengeksekusi(false);
      setProgresEksekusi(null);
    }
  }

  const akunBaruEmails = useMemo(
    () =>
      (hasilEksekusi ?? [])
        .filter((h): h is Extract<HasilBarisEksekusi, { hasil: "berhasil" }> => h.hasil === "berhasil")
        .filter((h) => h.akunBaru)
        .map((h) => h.email),
    [hasilEksekusi]
  );

  async function handleKirimTautan() {
    if (akunBaruEmails.length === 0) {
      return;
    }
    setMengirimTautan(true);
    setProgresTautan({ selesai: 0, total: akunBaruEmails.length });
    const hasil: { email: string; ok: boolean; pesan?: string }[] = [];
    for (let i = 0; i < akunBaruEmails.length; i += 1) {
      const email = akunBaruEmails[i];
      try {
        await sendPasswordResetEmail(auth, email);
        hasil.push({ email, ok: true });
      } catch (err) {
        // auth/too-many-requests DITANGANI DENGAN JELAS (BAGIAN "SETELAH
        // IMPOR"), bukan didiamkan — kalau ini terjadi, sisa email di
        // daftar KEMUNGKINAN BESAR juga akan gagal karena alasan yang
        // sama; tetap dicoba satu-satu supaya yang sempat berhasil
        // tercatat, tapi pesannya menyebut alasan sungguhan.
        const pesan =
          err instanceof FirebaseError && err.code === "auth/too-many-requests"
            ? "Terlalu banyak permintaan dalam waktu singkat — tunggu beberapa saat lalu coba sisanya."
            : err instanceof Error
              ? err.message
              : "Gagal mengirim tautan.";
        hasil.push({ email, ok: false, pesan });
      }
      setProgresTautan({ selesai: i + 1, total: akunBaruEmails.length });
      if (i < akunBaruEmails.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, JEDA_ANTAR_TAUTAN_MS));
      }
    }
    setHasilTautan(hasil);
    setMengirimTautan(false);
    setProgresTautan(null);
  }

  const jumlahBerhasil = (hasilEksekusi ?? []).filter((h) => h.hasil === "berhasil").length;
  const jumlahDilewati = (hasilEksekusi ?? []).filter((h) => h.hasil === "dilewati").length;
  const jumlahGagal = (hasilEksekusi ?? []).filter((h) => h.hasil === "gagal").length;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link
          href={`/admin/kegiatan/${kegiatanId}/peserta`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Kembali ke Peserta
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          Impor daftar hadir {kegiatan ? `— ${kegiatan.judul}` : ""}
        </h1>
        <p className="text-sm text-zinc-500">
          Untuk peserta yang hadir tapi belum punya akun. Akun dibuat tanpa kata sandi — kirim
          tautan setel kata sandi setelah impor.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
            Langkah 1 — Tempel daftar hadir
          </h2>
          <button
            type="button"
            onClick={handleUnduhTemplat}
            disabled={!kegiatan}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            Unduh templat CSV
          </button>
        </div>
        <p className="text-sm text-zinc-500">
          Kolom (tanpa header wajib, tapi baris judul kolom akan dikenali dan dilewati):{" "}
          <strong>{formatKolom}</strong>. Maksimal {MAKS_BARIS_IMPOR_HADIR} baris per impor.
        </p>
        <p className="text-sm text-zinc-500">
          Pemisah kolom yang didukung hanya <strong>TAB</strong> (hasil salin dari Excel/Sheets)
          atau <strong>koma</strong>. Mengetik spasi sebagai pemisah TIDAK BEKERJA — seluruh
          baris akan terbaca sebagai satu nama panjang. Kalau ragu, unduh templat CSV di atas,
          isi di Excel, lalu salin balik ke sini.
        </p>
        {contohBaris && (
          <p className="text-sm text-zinc-500">
            Contoh baris yang benar (bentuk koma, bisa disalin langsung):{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-black dark:bg-zinc-900 dark:text-zinc-50">
              {contohBaris}
            </code>
          </p>
        )}
        <textarea
          rows={10}
          value={teks}
          onChange={(event) => setTeks(event.target.value)}
          placeholder="email@contoh.com	Nama Lengkap"
          className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Langkah 2 — Periksa</h2>
          <button
            type="button"
            onClick={handlePeriksa}
            disabled={memeriksa || !teks.trim()}
            className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {memeriksa ? "Memeriksa..." : "Periksa"}
          </button>
        </div>

        {errorPratinjau && <p className="text-sm text-red-600">{errorPratinjau}</p>}

        {pratinjau?.ok && (
          <>
            {isStale && (
              <p className="text-sm text-amber-600">
                Tempelan berubah sejak pemeriksaan terakhir — klik &quot;Periksa&quot; lagi.
              </p>
            )}
            {pratinjau.pemisahMungkinSalah && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Sepertinya kolom dipisah dengan spasi. Pemisah yang didukung adalah TAB (salin
                dari Excel) atau koma.
              </p>
            )}
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {barisSiapEksekusi.length} dari {pratinjau.baris?.length ?? 0} baris siap dieksekusi.
            </p>

            {/* Kartu di layar sempit — tabel di sm: ke atas (rule 9.2b). */}
            <ul className="space-y-3 sm:hidden">
              {pratinjau.baris?.map((baris) => (
                <li
                  key={baris.baris}
                  className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-zinc-500">Baris {baris.baris}</p>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badgeClass(baris.status)}`}
                    >
                      {LABEL_STATUS[baris.status]}
                    </span>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {baris.namaLengkap} — {baris.email}
                  </p>
                  {/* Slice 6.2a (CACAT 2b): hasil URAIAN apa adanya — kalau
                      tempelannya salah format, nilainya di sini akan
                      terlihat aneh (mis. institusi berisi seluruh sisa
                      baris) dan admin tahu apa yang salah tanpa menebak. */}
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500">Institusi (terurai): </span>
                    {baris.institusi || "(kosong)"}
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500">Nomor identitas (terurai): </span>
                    {baris.nomorIdentitas || "(kosong)"}
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <span className="text-zinc-500">No. telepon (terurai): </span>
                    {baris.noTelepon || "(kosong)"}
                  </p>
                  {baris.pesan.length > 0 && (
                    <ul className="list-inside list-disc space-y-0.5 text-zinc-700 dark:text-zinc-300">
                      {baris.pesan.map((pesan, index) => (
                        <li key={index}>{pesan}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 sm:block dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Baris</th>
                    <th className="px-3 py-2 font-medium">Nama</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Institusi (terurai)</th>
                    <th className="px-3 py-2 font-medium">Nomor Identitas (terurai)</th>
                    <th className="px-3 py-2 font-medium">No. Telepon (terurai)</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Pesan</th>
                  </tr>
                </thead>
                <tbody>
                  {pratinjau.baris?.map((baris) => (
                    <tr
                      key={baris.baris}
                      className="border-b border-zinc-100 align-top last:border-0 dark:border-zinc-900"
                    >
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{baris.baris}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{baris.namaLengkap}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{baris.email}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {baris.institusi || "(kosong)"}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {baris.nomorIdentitas || "(kosong)"}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {baris.noTelepon || "(kosong)"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass(baris.status)}`}
                        >
                          {LABEL_STATUS[baris.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {baris.pesan.length > 0 ? (
                          <ul className="list-inside list-disc space-y-0.5">
                            {baris.pesan.map((pesan, index) => (
                              <li key={index}>{pesan}</li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Langkah 3 — Jalankan</h2>
        <p className="text-sm text-zinc-500">
          Baris berstatus &quot;Sudah terdaftar&quot;, &quot;Duplikat dalam tempelan&quot;,
          &quot;Baris tidak sah&quot;, dan &quot;Data wajib kurang&quot; TIDAK dieksekusi.
        </p>
        <button
          type="button"
          onClick={handleEksekusi}
          disabled={!bisaEksekusi}
          className="inline-flex min-h-11 items-center justify-center rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {mengeksekusi
            ? progresEksekusi
              ? `Menjalankan ${progresEksekusi.selesai} dari ${progresEksekusi.total}…`
              : "Menjalankan..."
            : `Jalankan (${barisSiapEksekusi.length} baris)`}
        </button>
        {errorEksekusi && <p className="text-sm text-red-600">{errorEksekusi}</p>}

        {hasilEksekusi && (
          <div className="space-y-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            <p className="font-medium text-black dark:text-zinc-50">
              {jumlahBerhasil} berhasil, {jumlahDilewati} dilewati, {jumlahGagal} gagal.
            </p>
            <ul className="space-y-1">
              {hasilEksekusi.map((h) => (
                <li
                  key={h.baris}
                  className={
                    h.hasil === "berhasil"
                      ? "text-green-600"
                      : h.hasil === "dilewati"
                        ? "text-amber-600"
                        : "text-red-600"
                  }
                >
                  Baris {h.baris} ({h.email}):{" "}
                  {h.hasil === "berhasil"
                    ? `berhasil, nomor urut ${h.nomorUrut}${h.akunBaru ? " — akun baru" : " — akun sudah ada"}`
                    : h.pesan}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {hasilEksekusi && akunBaruEmails.length > 0 && (
        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
            Langkah 4 — Kirim tautan setel kata sandi
          </h2>
          <p className="text-sm text-zinc-500">
            {akunBaruEmails.length} akun baru dibuat tanpa kata sandi. Tanpa tautan ini, mereka
            tidak tahu punya akun.
          </p>
          <button
            type="button"
            onClick={handleKirimTautan}
            disabled={mengirimTautan}
            className="inline-flex min-h-11 items-center justify-center rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {mengirimTautan
              ? progresTautan
                ? `Mengirim ${progresTautan.selesai} dari ${progresTautan.total}…`
                : "Mengirim..."
              : `Kirim tautan setel kata sandi (${akunBaruEmails.length})`}
          </button>
          {hasilTautan && (
            <ul className="space-y-1 text-sm">
              {hasilTautan.map((h) => (
                <li key={h.email} className={h.ok ? "text-green-600" : "text-red-600"}>
                  {h.email}: {h.ok ? "terkirim" : h.pesan}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
