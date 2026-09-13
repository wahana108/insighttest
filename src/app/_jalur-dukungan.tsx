import type { SystemParameter } from "@/types/parameter";

/**
 * Slice "akses-kegiatan" (docs/kickoff.md §R, SLICE 4) — TAHAP B butir 4.
 * Dipakai /daftar (kuota harian penuh) dan /kegiatan/[id] (batas harian
 * penuh saat mendaftar, DAN layar hasil setelah sertifikat terbit — "saat
 * orang sedang merasa mendapat sesuatu, bukan saat ia ditolak"). Kosong
 * kalau urlDukungan kosong — SATU-SATUNYA saklar fitur ini, bukan
 * pesanDukungan/kontakAdmin (keduanya boleh kosong tanpa mematikan blok
 * ini kalau urlDukungan sudah diisi).
 */
export function JalurDukungan({
  parameter,
  konteks,
}: {
  parameter: Pick<SystemParameter, "urlDukungan" | "pesanDukungan" | "kontakAdmin">;
  /** Mengubah kalimat pembuka supaya sesuai tempatnya muncul. */
  konteks: "kuota_penuh" | "sertifikat_terbit";
}) {
  if (!parameter.urlDukungan) {
    return null;
  }
  return (
    <div className="space-y-2 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      {konteks === "kuota_penuh" && (
        <p className="font-medium text-black dark:text-zinc-50">
          Ada jalur lain yang tidak menunggu besok.
        </p>
      )}
      {parameter.pesanDukungan && (
        <p className="text-zinc-700 dark:text-zinc-300">{parameter.pesanDukungan}</p>
      )}
      <a
        href={parameter.urlDukungan}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block font-medium text-black underline dark:text-zinc-50"
      >
        Buka tautan dukungan
      </a>
      <p className="text-xs text-zinc-500">
        Setelah menyumbang, kode akses ada di pesan terima kasihnya — dipakai untuk mendaftar
        hari itu juga, tidak perlu menunggu besok.
      </p>
      {parameter.kontakAdmin && (
        <p className="text-xs text-zinc-500">
          Kehilangan kode akses?{" "}
          <a href={parameter.kontakAdmin} className="underline">
            Hubungi admin
          </a>
          .
        </p>
      )}
    </div>
  );
}
