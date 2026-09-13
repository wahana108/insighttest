"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { bolehTampilDiKatalog } from "@/lib/akses-kegiatan";
import { useAuth } from "@/lib/auth/auth-provider";
import { formatDateTime } from "@/lib/format-date";
import { useKegiatanList } from "@/lib/hooks/use-kegiatan-list";

export default function KegiatanKatalogPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  // Peserta hanya boleh membaca kegiatan dengan isPublished true —
  // firestore.rules BUKAN penyaring: query TANPA where('isPublished','==',true)
  // ditolak seluruhnya untuk non-admin, bukan disaring diam-diam.
  const {
    items,
    loading: loadingKegiatan,
    error: kegiatanError,
  } = useKegiatanList({ hanyaTerbit: true });
  // Slice "akses-kegiatan" §3 — JADWAL PUBLIKASI: kegiatan yang jendelanya
  // belum dibuka, sudah lewat, atau caraMasuk 'hanya_admin' TIDAK LAGI
  // muncul di katalog (beda dari sebelumnya, yang menampilkan dengan
  // keterangan) — supaya admin bisa menyiapkan beberapa edisi sekaligus dan
  // masing-masing muncul sendiri pada waktunya. Kegiatan begini TETAP
  // terlihat peserta yang sudah terdaftar lewat /beranda ("Kegiatan saya"),
  // yang memakai useKegiatanList() TANPA filter ini — lihat komentar
  // bolehTampilDiKatalog() di src/lib/akses-kegiatan.ts.
  const kegiatanTersedia = useMemo(
    () => items.filter((item) => !item.isArchived && bolehTampilDiKatalog(item)),
    [items]
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/masuk");
    }
  }, [loading, user, router]);

  if (loading || !user) {
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

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div>
        <Link href="/beranda" className="text-sm text-zinc-500 hover:underline">
          ← Kembali ke Beranda
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">Kegiatan</h1>
        <p className="text-sm text-zinc-500">Kegiatan yang sudah diterbitkan.</p>
      </div>

      <div className="space-y-3">
        {loadingKegiatan && <p className="text-sm text-zinc-500">Memuat...</p>}
        {!loadingKegiatan && kegiatanError && (
          <p className="text-sm text-red-600">Gagal memuat kegiatan: {kegiatanError}</p>
        )}
        {!loadingKegiatan && !kegiatanError && kegiatanTersedia.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
            <p className="text-sm font-medium text-black dark:text-zinc-50">
              Belum ada kegiatan yang diterbitkan.
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Admin belum menerbitkan kegiatan apa pun untuk saat ini — coba periksa lagi
              nanti.
            </p>
          </div>
        )}
        {kegiatanTersedia.map((kegiatan) => (
          <Link
            key={kegiatan.id}
            href={`/kegiatan/${kegiatan.id}`}
            className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            <p className="font-medium text-black dark:text-zinc-50">{kegiatan.judul}</p>
            {kegiatan.deskripsi && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {kegiatan.deskripsi}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              {kegiatan.dibukaPada || kegiatan.ditutupPada
                ? `${kegiatan.dibukaPada ? formatDateTime(kegiatan.dibukaPada) : "-"} – ${
                    kegiatan.ditutupPada ? formatDateTime(kegiatan.ditutupPada) : "-"
                  }`
                : "Tanpa batas waktu"}
            </p>
            {kegiatan.caraMasuk === "kode" && (
              <p className="mt-1 text-xs font-medium text-amber-600">Butuh kode akses</p>
            )}
            {kegiatan.kuotaPeserta > 0 && (
              <p
                className={`mt-1 text-xs font-medium ${
                  kegiatan.nomorUrutTerakhir >= kegiatan.kuotaPeserta
                    ? "text-red-600"
                    : "text-zinc-500"
                }`}
              >
                Kuota: {kegiatan.nomorUrutTerakhir} dari {kegiatan.kuotaPeserta} terisi
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
