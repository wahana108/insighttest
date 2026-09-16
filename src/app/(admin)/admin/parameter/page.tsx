"use client";

import { useEffect, useState, type FormEvent } from "react";
import { WajibAdmin } from "@/app/(admin)/_wajib-admin";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  DEFAULT_SYSTEM_PARAMETER,
  getSystemParameter,
  updateSystemParameter,
} from "@/lib/services/system-parameter";
import type { ModePendaftaran, SystemParameter } from "@/types/parameter";

export default function AdminParameterPage() {
  return (
    <WajibAdmin>
      <AdminParameterPageIsi />
    </WajibAdmin>
  );
}

/**
 * Slice "email-brevo" (6a) — membuktikan pengiriman email bekerja, bukan
 * fitur pengguna. Tujuan SELALU alamat akun yang sedang login (ditampilkan
 * sebagai teks mati di sini, TIDAK PERNAH sebagai isian bebas — server
 * yang menentukan tujuan dari token, lihat POST /api/email/uji) —
 * ditampilkan supaya admin tahu persis ke mana email akan pergi sebelum
 * mengklik.
 */
function KirimEmailUji({ emailTujuan }: { emailTujuan: string }) {
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState<{ ok: boolean; pesan: string } | null>(null);

  async function handleKirim() {
    setMengirim(true);
    setHasil(null);
    try {
      const res = await fetchWithAuth("/api/email/uji", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal mengirim email uji.");
      }
      setHasil({ ok: true, pesan: `Email uji berhasil dikirim ke ${body.ke}.` });
    } catch (err) {
      setHasil({
        ok: false,
        pesan: err instanceof Error ? err.message : "Gagal mengirim email uji.",
      });
    } finally {
      setMengirim(false);
    }
  }

  return (
    <div className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email uji (Brevo)</p>
      <p className="text-xs text-zinc-500">
        Tujuan:{" "}
        <span className="font-mono text-black dark:text-zinc-50">
          {emailTujuan || "(alamat akun tidak diketahui)"}
        </span>
      </p>
      <button
        type="button"
        onClick={handleKirim}
        disabled={mengirim || !emailTujuan}
        className="inline-flex min-h-11 items-center justify-center rounded border border-zinc-300 px-4 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
      >
        {mengirim ? "Mengirim..." : "Kirim email uji ke alamat saya"}
      </button>
      {hasil && (
        <p className={`text-xs ${hasil.ok ? "text-green-600" : "text-red-600"}`}>{hasil.pesan}</p>
      )}
    </div>
  );
}

function AdminParameterPageIsi() {
  const { user, profile } = useAuth();
  const [parameter, setParameter] = useState<SystemParameter>(DEFAULT_SYSTEM_PARAMETER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSystemParameter().then((next) => {
      if (mounted) {
        setParameter(next);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canSave = profile?.role === "superadmin";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || !user) {
      return;
    }
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateSystemParameter(
        {
          namaPlatform: parameter.namaPlatform,
          modePendaftaran: parameter.modePendaftaran,
          pesanBeranda: parameter.pesanBeranda,
          urlPublik: parameter.urlPublik,
          batasPendaftaranBaruPerHari: parameter.batasPendaftaranBaruPerHari,
          pendaftaranTanpaKataSandi: parameter.pendaftaranTanpaKataSandi,
          urlDukungan: parameter.urlDukungan,
          pesanDukungan: parameter.pesanDukungan,
          kontakAdmin: parameter.kontakAdmin,
        },
        user.uid
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan parameter.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-500">Memuat...</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Parameter</h1>

      <KirimEmailUji emailTujuan={user?.email ?? ""} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="namaPlatform"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Nama platform
          </label>
          <input
            id="namaPlatform"
            type="text"
            required
            value={parameter.namaPlatform}
            onChange={(event) =>
              setParameter((prev) => ({ ...prev, namaPlatform: event.target.value }))
            }
            disabled={!canSave}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label
            htmlFor="modePendaftaran"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Mode pendaftaran
          </label>
          <select
            id="modePendaftaran"
            value={parameter.modePendaftaran}
            onChange={(event) =>
              setParameter((prev) => ({
                ...prev,
                modePendaftaran: event.target.value as ModePendaftaran,
              }))
            }
            disabled={!canSave}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="terbuka">Terbuka</option>
            <option value="persetujuan">Persetujuan</option>
            <option value="undangan">Undangan</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="pesanBeranda"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Pesan beranda
          </label>
          <textarea
            id="pesanBeranda"
            rows={3}
            value={parameter.pesanBeranda}
            onChange={(event) =>
              setParameter((prev) => ({ ...prev, pesanBeranda: event.target.value }))
            }
            disabled={!canSave}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label
            htmlFor="urlPublik"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            URL publik (fallback verifikasi sertifikat)
          </label>
          <input
            id="urlPublik"
            type="url"
            placeholder="https://insighttest.example.com"
            value={parameter.urlPublik}
            onChange={(event) =>
              setParameter((prev) => ({ ...prev, urlPublik: event.target.value }))
            }
            disabled={!canSave}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Dipakai untuk alamat verifikasi (QR/teks) di sertifikat HANYA kalau env
            NEXT_PUBLIC_SITE_URL belum diisi saat deploy. Tidak pernah diambil dari alamat
            tempat halaman kebetulan dibuka.
          </p>
        </div>

        <div>
          <label
            htmlFor="batasPendaftaranBaruPerHari"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Batas pendaftaran baru per hari
          </label>
          <input
            id="batasPendaftaranBaruPerHari"
            type="number"
            min={0}
            value={parameter.batasPendaftaranBaruPerHari}
            onChange={(event) =>
              setParameter((prev) => ({
                ...prev,
                batasPendaftaranBaruPerHari: Number(event.target.value) || 0,
              }))
            }
            disabled={!canSave}
            className="mt-1 w-full max-w-[160px] rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <p className="mt-1 text-xs text-zinc-500">
            0 berarti tak terbatas. Menghitung pendaftaran BARU ke kegiatan lewat jalur mandiri
            saja (impor daftar hadir oleh admin tidak dihitung) — melindungi kuota Firestore
            paket Spark. Naikkan hanya kalau sudah pindah ke paket Blaze dan tahu berapa
            anggarannya.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={parameter.pendaftaranTanpaKataSandi}
              onChange={(event) =>
                setParameter((prev) => ({
                  ...prev,
                  pendaftaranTanpaKataSandi: event.target.checked,
                }))
              }
              disabled={!canSave}
            />
            Pendaftaran tanpa kata sandi
          </label>
          <p className="mt-1 text-xs text-zinc-500">
            Berlaku HANYA saat mode pendaftaran = Terbuka. /daftar hanya meminta email dan
            nama; kata sandi dibuat acak lalu peserta menerima tautan email untuk membuatnya
            sendiri — membuktikan ia memang pemilik email itu sebelum bisa masuk.
          </p>
        </div>

        <div className="space-y-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Jalur apresiasi
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Kosongkan urlDukungan untuk mematikan fitur ini — tampilan saat kuota harian
              penuh akan persis seperti sebelumnya. Diisi, /daftar dan halaman kegiatan
              menawarkan tautan ini alih-alih sekadar &quot;coba lagi besok&quot;.
            </p>
          </div>
          <div>
            <label
              htmlFor="urlDukungan"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              URL dukungan (mis. Saweria)
            </label>
            <input
              id="urlDukungan"
              type="url"
              placeholder="https://saweria.co/namaAnda"
              value={parameter.urlDukungan}
              onChange={(event) =>
                setParameter((prev) => ({ ...prev, urlDukungan: event.target.value }))
              }
              disabled={!canSave}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div>
            <label
              htmlFor="pesanDukungan"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Pesan dukungan
            </label>
            <textarea
              id="pesanDukungan"
              rows={2}
              placeholder="Kuota hari ini penuh? Dukung platform ini dan dapatkan kode akses untuk mendaftar hari ini juga."
              value={parameter.pesanDukungan}
              onChange={(event) =>
                setParameter((prev) => ({ ...prev, pesanDukungan: event.target.value }))
              }
              disabled={!canSave}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div>
            <label
              htmlFor="kontakAdmin"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Kontak admin (jalan terakhir)
            </label>
            <input
              id="kontakAdmin"
              type="text"
              placeholder="mailto:admin@contoh.com atau https://wa.me/62..."
              value={parameter.kontakAdmin}
              onChange={(event) =>
                setParameter((prev) => ({ ...prev, kontakAdmin: event.target.value }))
              }
              disabled={!canSave}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Ditampilkan sebagai tautan &quot;Hubungi admin&quot; bagi yang kehilangan kode
              aksesnya. Kosong berarti baris ini tidak ditampilkan.
            </p>
          </div>
        </div>

        {!canSave && (
          <p className="text-sm text-zinc-500">
            Hanya superadmin yang boleh menyimpan. Anda hanya bisa melihat.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Tersimpan.</p>}

        {canSave && (
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center rounded bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Simpan
          </button>
        )}
      </form>
    </div>
  );
}
