"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { writeBatch } from "firebase/firestore";
import { WajibAdmin } from "@/app/(admin)/_wajib-admin";
import { useAuth } from "@/lib/auth/auth-provider";
import { db } from "@/lib/firebase/client";
import { useTopikList } from "@/lib/hooks/use-topik-list";
import { buildSoalWrite } from "@/lib/services/soal";
import {
  periksaBerkasImpor,
  SOAL_IMPOR_SCHEMA_VERSION,
  type HasilPeriksaImpor,
  type StatusBarisImpor,
} from "@/lib/services/soal-import";
import { formatTopikLabel } from "@/lib/services/topik";
import type { Topik } from "@/types/topik";

function buildPrompt(topikAktif: Topik[]): string {
  const daftarTopik = topikAktif.map((topik) => `- ${formatTopikLabel(topik)}`).join("\n");

  return `Buatkan soal pilihan ganda dalam format JSON PERSIS seperti skema di bawah. Balas HANYA dengan JSON itu, tanpa teks lain, tanpa markdown code fence.

Skema (schemaVersion "${SOAL_IMPOR_SCHEMA_VERSION}"):
{
  "schemaVersion": "${SOAL_IMPOR_SCHEMA_VERSION}",
  "soal": [
    {
      "topikKode": "KODE_TOPIK",
      "pertanyaan": "Teks pertanyaan di sini",
      "tingkat": "mudah" | "sedang" | "sulit",
      "opsi": [
        { "teks": "Opsi A", "benar": true },
        { "teks": "Opsi B", "benar": false },
        { "teks": "Opsi C", "benar": false }
      ]
    }
  ]
}

Aturan wajib:
- "topikKode" harus PERSIS salah satu kode berikut (huruf besar apa adanya):
${daftarTopik || "(belum ada topik aktif — buat topik dulu di /admin/topik)"}
- Setiap soal minimal 2 opsi, dan TEPAT SATU opsi bertanda "benar": true.
- "tingkat" hanya salah satu dari "mudah", "sedang", "sulit".
- "pertanyaan" tidak boleh kosong.

Buatkan [ISI: jumlah soal] soal untuk topik [ISI: kode topik yang diinginkan].`;
}

function badgeClass(status: StatusBarisImpor): string {
  if (status === "galat") {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  }
  if (status === "peringatan") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  }
  return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400";
}

function badgeLabel(status: StatusBarisImpor): string {
  if (status === "galat") return "Galat";
  if (status === "peringatan") return "Peringatan";
  return "Siap";
}

export default function AdminSoalImporPage() {
  return (
    <WajibAdmin>
      <AdminSoalImporPageIsi />
    </WajibAdmin>
  );
}

function AdminSoalImporPageIsi() {
  const { user } = useAuth();
  const { items: topikList, error: topikError } = useTopikList();
  const topikAktif = useMemo(() => topikList.filter((topik) => topik.isActive), [topikList]);
  const prompt = useMemo(() => buildPrompt(topikAktif), [topikAktif]);

  const [copied, setCopied] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [periksaResult, setPeriksaResult] = useState<HasilPeriksaImpor | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isStale = checkedText !== null && checkedText !== jsonText;
  const bisaSimpan =
    Boolean(user) &&
    periksaResult?.ok === true &&
    periksaResult.siapDisimpan &&
    !isStale &&
    !saving;

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Gagal menyalin ke clipboard — salin manual dari kotak di atas.");
    }
  }

  async function handlePeriksa() {
    setError(null);
    setSaveSuccess(null);
    setChecking(true);
    try {
      const hasil = await periksaBerkasImpor(jsonText);
      setPeriksaResult(hasil);
      setCheckedText(jsonText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memeriksa berkas.");
    } finally {
      setChecking(false);
    }
  }

  async function handleSimpanSemua() {
    if (!user || !periksaResult || !periksaResult.ok) {
      return;
    }
    setError(null);
    setSaveSuccess(null);
    setSaving(true);
    try {
      const batch = writeBatch(db);
      let jumlah = 0;
      for (const baris of periksaResult.baris) {
        if (!baris.input) {
          continue;
        }
        buildSoalWrite(batch, baris.input, { actorId: user.uid });
        jumlah += 1;
      }
      await batch.commit();
      setSaveSuccess(`${jumlah} soal berhasil disimpan.`);
      setJsonText("");
      setCheckedText(null);
      setPeriksaResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan soal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href="/admin/soal" className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke Soal
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          Impor soal berbantuan AI
        </h1>
        <p className="text-sm text-zinc-500">
          Salin prompt ke AI mana pun, tempel hasilnya, periksa, lalu simpan semua sekaligus.
        </p>
      </div>

      {topikError && (
        <p className="text-sm text-red-600">
          Gagal memuat daftar topik: {topikError}. Daftar kode topik di prompt di bawah bisa
          tidak lengkap — jangan pakai sampai ini teratasi.
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
          Langkah 1 — Salin prompt
        </h2>
        <textarea
          readOnly
          rows={8}
          value={prompt}
          className="w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="button"
          onClick={handleCopyPrompt}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          {copied ? "Tersalin!" : "Salin prompt"}
        </button>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
          Langkah 2 — Tempel hasil JSON dari AI
        </h2>
        <textarea
          rows={10}
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder='{ "schemaVersion": "1.0", "soal": [ ... ] }'
          className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
            Langkah 3 — Periksa
          </h2>
          <button
            type="button"
            onClick={handlePeriksa}
            disabled={checking || !jsonText.trim()}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {checking ? "Memeriksa..." : "Periksa"}
          </button>
        </div>

        {periksaResult && !periksaResult.ok && (
          <p className="text-sm text-red-600">{periksaResult.pesanBentuk}</p>
        )}

        {periksaResult && periksaResult.ok && (
          <>
            {isStale && (
              <p className="text-sm text-amber-600">
                Isi berkas berubah sejak pemeriksaan terakhir — klik &quot;Periksa&quot; lagi
                sebelum menyimpan.
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Baris</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Topik</th>
                    <th className="px-3 py-2 font-medium">Pertanyaan</th>
                    <th className="px-3 py-2 font-medium">Pesan</th>
                  </tr>
                </thead>
                <tbody>
                  {periksaResult.baris.map((baris) => (
                    <tr
                      key={baris.baris}
                      className="border-b border-zinc-100 align-top last:border-0 dark:border-zinc-900"
                    >
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{baris.baris}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass(baris.status)}`}
                        >
                          {badgeLabel(baris.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {baris.pratinjau?.topikKode ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {baris.pratinjau?.teks ?? "-"}
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
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
          Langkah 4 — Simpan
        </h2>
        <p className="text-sm text-zinc-500">
          Aktif hanya kalau tidak ada baris berstatus galat. Semua baris tersimpan dalam satu
          writeBatch — semua atau tidak sama sekali.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saveSuccess && <p className="text-sm text-green-600">{saveSuccess}</p>}
        <button
          type="button"
          onClick={handleSimpanSemua}
          disabled={!bisaSimpan}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "Menyimpan..." : "Simpan semua"}
        </button>
      </section>
    </div>
  );
}
