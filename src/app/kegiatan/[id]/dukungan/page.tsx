"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/api/client-fetch";
import { useAuth } from "@/lib/auth/auth-provider";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";

interface HasilKirim {
  sudahAda: boolean;
  urlSaweria: string;
  pesan: string;
  /** 'tercatat' | 'terkirim' | 'gagal' — status TERSIMPAN di server SAAT formulir ini dikirim/dibaca, BUKAN diperbarui live setelah itu (lihat kodeStatus di bawah untuk status kode SETELAH interaksi di halaman ini). */
  status?: string;
}

type StatusKode = "idle" | "mengirim" | "terkirim" | "gagal";

/**
 * Slice "niat-dukungan" (6b), URUTAN KEJADIAN diperbaiki di Slice
 * "urutan-dukungan" (6c) — halaman TERPISAH (bukan dialog) supaya tidak
 * menambah state machine baru ke halaman kegiatan yang sudah kompleks
 * (docs: "pilih yang paling sedikit mengubah struktur yang ada").
 *
 * PERUBAHAN 6c — urutan kejadian dibalik, bukan cuma teksnya: SEBELUM 6c,
 * email kode terkirim SAAT formulir dikirim, jadi peserta sudah punya
 * kodenya sebelum sempat membuka Saweria (tidak ada alasan lagi
 * membukanya). Sekarang POST /api/dukungan/niat HANYA mencatat niat
 * (TIDAK mengirim email sama sekali) — kode baru dibaca dan dikirim lewat
 * POST /api/dukungan/kirim-kode, dipanggil SETELAH tab Saweria dibuka
 * (lihat handleBukaSaweria() di bawah: window.open() adalah baris PERTAMA,
 * sebelum await apa pun — wajib, supaya peramban tidak memblokirnya
 * sebagai popup).
 */
export default function DukunganPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const { items: kegiatanList, loading: loadingKegiatan } = useKegiatanList({ hanyaTerbit: true });
  const kegiatan = useMemo(
    () => kegiatanList.find((item) => item.id === id) ?? null,
    [kegiatanList, id]
  );

  // namaDipakai kosong berarti "belum disunting admin" — value INPUT-nya
  // jatuh ke nama profil (lihat namaDipakaiEfektif di bawah). Dipilih
  // ketimbang useEffect+setState (proyek ini melarang setState di dalam
  // effect, react-hooks/set-state-in-effect) supaya profil yang baru
  // selesai dimuat langsung terlihat di render berikutnya tanpa efek
  // terpisah.
  const [namaDipakai, setNamaDipakai] = useState("");
  const namaDipakaiEfektif = namaDipakai || profile?.namaLengkap || "";
  const [nominal, setNominal] = useState("");
  const [catatan, setCatatan] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [mengirimUlang, setMengirimUlang] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilKirim | null>(null);

  // Status kode SETELAH interaksi di halaman ini (klik "Buka Saweria" atau
  // "kirim ulang") — TERPISAH dari hasil.status (status yang sudah
  // tersimpan SAAT formulir dikirim/dibaca). 'idle' berarti belum ada
  // interaksi apa pun di sesi halaman ini; render di bawah jatuh ke
  // hasil.status untuk kasus itu.
  const [kodeStatus, setKodeStatus] = useState<StatusKode>("idle");
  const [kodeAlasanGagal, setKodeAlasanGagal] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  async function handleSubmit() {
    if (!namaDipakaiEfektif.trim()) {
      setError("Nama yang dipakai wajib diisi.");
      return;
    }
    setError(null);
    setMengirim(true);
    try {
      const res = await fetchWithAuth("/api/dukungan/niat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kegiatanId: id,
          namaDipakai: namaDipakaiEfektif,
          nominal: nominal.trim() ? Number(nominal) : undefined,
          catatan,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal mengirim formulir.");
      }
      setHasil(body as HasilKirim);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim formulir.");
    } finally {
      setMengirim(false);
    }
  }

  async function panggilKirimKode() {
    setKodeStatus("mengirim");
    setKodeAlasanGagal(null);
    try {
      const res = await fetchWithAuth("/api/dukungan/kirim-kode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kegiatanId: id }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "Gagal mengirim kode.");
      }
      if (body.terkirim) {
        setKodeStatus("terkirim");
      } else {
        setKodeStatus("gagal");
        setKodeAlasanGagal(body.alasanGagal ?? "Gagal mengirim kode akses.");
      }
    } catch (err) {
      setKodeStatus("gagal");
      setKodeAlasanGagal(err instanceof Error ? err.message : "Gagal mengirim kode.");
    }
  }

  // Slice "urutan-dukungan" (6c) — window.open() WAJIB baris PERTAMA di
  // sini, SEBELUM await apa pun (termasuk await di dalam panggilKirimKode()
  // yang dipanggil belakangan): peramban memblokir window.open() yang
  // dipanggil setelah sebuah await sebagai popup, karena dianggap tidak
  // lagi bagian dari gestur klik pengguna yang sama.
  async function handleBukaSaweria() {
    if (!hasil) {
      return;
    }
    window.open(hasil.urlSaweria, "_blank", "noopener");

    // Kode sudah pernah terkirim (baik dari respons server saat formulir
    // ini dibaca/dikirim, MAUPUN dari interaksi kita sendiri sebelumnya di
    // sesi halaman ini) — tab tetap dibuka di atas, tapi TIDAK memanggil
    // kirim-kode lagi.
    if (hasil.status === "terkirim" || kodeStatus === "terkirim") {
      return;
    }
    await panggilKirimKode();
  }

  async function handleKirimUlang() {
    setMengirimUlang(true);
    try {
      await panggilKirimKode();
    } finally {
      setMengirimUlang(false);
    }
  }

  if (loading || !user || loadingKegiatan) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Memuat...</p>
      </div>
    );
  }

  if (!kegiatan || !kegiatan.dukungan.aktif) {
    return (
      <div className="mx-auto min-h-screen max-w-md space-y-4 bg-zinc-50 px-4 py-10 dark:bg-black">
        <Link href={`/kegiatan/${id}`} className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke kegiatan
        </Link>
        <p className="text-sm text-zinc-500">
          Formulir dukungan tidak tersedia untuk kegiatan ini.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div>
        <Link href={`/kegiatan/${id}`} className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke kegiatan
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          Formulir dukungan — {kegiatan.judul}
        </h1>
      </div>

      {!hasil && (
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Isi data dengan benar supaya admin bisa mencocokkannya dengan daftar donatur
            Saweria dan menindaklanjuti.
          </p>
          <div>
            <label
              htmlFor="namaDipakai"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nama yang dipakai saat mendukung
            </label>
            <input
              id="namaDipakai"
              type="text"
              required
              value={namaDipakaiEfektif}
              onChange={(event) => setNamaDipakai(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Bisa beda dari nama akun Anda — isi persis seperti nama yang tampil di Saweria.
            </p>
          </div>
          <div>
            <label
              htmlFor="nominal"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nominal (opsional)
            </label>
            <input
              id="nominal"
              type="number"
              min={0}
              value={nominal}
              onChange={(event) => setNominal(event.target.value)}
              className="mt-1 w-full max-w-[200px] rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          <div>
            <label
              htmlFor="catatan"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Catatan (opsional)
            </label>
            <textarea
              id="catatan"
              rows={2}
              value={catatan}
              onChange={(event) => setCatatan(event.target.value)}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mengirim}
            className="w-full rounded bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {mengirim ? "Mengirim..." : "Kirim formulir"}
          </button>
        </div>
      )}

      {hasil && (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          {hasil.sudahAda && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Anda sudah pernah mengisi formulir ini untuk kegiatan ini.
            </p>
          )}
          {hasil.pesan && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{hasil.pesan}</p>
          )}
          {hasil.urlSaweria && (
            <button
              type="button"
              onClick={handleBukaSaweria}
              className="inline-flex min-h-11 items-center rounded bg-black px-4 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Buka Saweria
            </button>
          )}

          {kodeStatus === "mengirim" && (
            <p className="text-sm text-zinc-500">Mengirim kode akses...</p>
          )}
          {kodeStatus === "terkirim" && (
            <p className="text-sm text-green-600">Kode akses sudah dikirim ke {user.email}.</p>
          )}
          {kodeStatus === "gagal" && (
            <p className="text-sm text-red-600">
              {kodeAlasanGagal ?? "Gagal mengirim kode akses."}
            </p>
          )}
          {kodeStatus === "idle" && hasil.status === "terkirim" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Kode akses sudah pernah dikirim ke {user.email}.
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={handleKirimUlang}
              disabled={mengirimUlang}
              className="text-xs font-medium text-zinc-700 underline disabled:opacity-50 dark:text-zinc-300"
            >
              {mengirimUlang ? "Mengirim ulang..." : "Kirim ulang kode ke email saya"}
            </button>
            <p className="mt-1 text-xs text-zinc-500">
              Gunakan ini kalau email pertama tidak sampai.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Link
            href={`/kegiatan/${id}`}
            className="block w-full rounded bg-black px-4 py-3 text-center text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Kembali ke kegiatan
          </Link>
        </div>
      )}
    </div>
  );
}
