import { getAdminDb } from "@/lib/firebase/admin";
import { formatDate } from "@/lib/format-date";
import { normalisasiKodeVerifikasi } from "@/lib/kode-verifikasi";
import type { ItemSertifikat, SertifikatPublik, StatusSertifikat } from "@/types/sertifikat";

function isStatusSertifikat(value: unknown): value is StatusSertifikat {
  return value === "berlaku" || value === "dicabut";
}

function mapItems(value: unknown): ItemSertifikat[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      modulId: typeof item.modulId === "string" ? item.modulId : "",
      judul: typeof item.judul === "string" ? item.judul : "",
      skor: typeof item.skor === "number" ? item.skor : 0,
      lulus: typeof item.lulus === "boolean" ? item.lulus : false,
    }));
}

// Kalimat saja ("Telah menuntaskan ... materi interaktif: X.") — tidak
// pernah membawa skor mentah maupun nickname CCL, jadi aman apa adanya di
// halaman publik ini (lihat komentar di types/sertifikat.ts).
function mapPernyataanAtestasi(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * firestore.rules menolak baca publik untuk sertifikat/{id} — halaman ini
 * WAJIB lewat Admin SDK di server, bukan Firestore client SDK. TIDAK PERNAH
 * mengembalikan email, uid, nomor identitas, nomor telepon, atau institusi:
 * dipilih field-per-field secara eksplisit, bukan menyebarluaskan seluruh
 * dokumen.
 *
 * Kode tidak dikenal, salah format, atau apa pun selain "ketemu" harus
 * menghasilkan null yang sama — tidak ada percabangan yang membocorkan
 * kenapa pencarian gagal.
 */
async function ambilSertifikatPublik(kode: string): Promise<SertifikatPublik | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection("sertifikat")
    .where("kodeVerifikasi", "==", normalisasiKodeVerifikasi(kode))
    .limit(1)
    .get();
  if (snapshot.empty) {
    return null;
  }
  const data = snapshot.docs[0].data();
  return {
    namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
    judulKegiatan: typeof data.judulKegiatan === "string" ? data.judulKegiatan : "",
    serial: typeof data.serial === "string" ? data.serial : "",
    nilaiAkhir: typeof data.nilaiAkhir === "number" ? data.nilaiAkhir : 0,
    items: mapItems(data.items),
    pernyataanAtestasi: mapPernyataanAtestasi(data.pernyataanAtestasi),
    status: isStatusSertifikat(data.status) ? data.status : "berlaku",
    terbitPada: typeof data.terbitPada === "string" ? data.terbitPada : "",
  };
}

export default async function VerifikasiSertifikatPage({
  params,
}: {
  params: Promise<{ kode: string }>;
}) {
  const { kode } = await params;
  const sertifikat = await ambilSertifikatPublik(kode);

  if (!sertifikat) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 bg-zinc-50 px-4 text-center dark:bg-black">
        <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
          Sertifikat tidak ditemukan
        </h1>
        <p className="text-sm text-zinc-500">
          Periksa kembali kode verifikasi yang Anda masukkan.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl space-y-4 bg-zinc-50 px-4 py-10 dark:bg-black">
      {sertifikat.status === "dicabut" && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-center text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          Sertifikat ini TIDAK BERLAKU — telah dicabut.
        </p>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Verifikasi sertifikat</p>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          {sertifikat.namaLengkap}
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{sertifikat.judulKegiatan}</p>

        <div className="mt-4 grid grid-cols-2 gap-4 border-y border-zinc-200 py-4 text-left text-sm dark:border-zinc-800 sm:grid-cols-3">
          <div>
            <p className="text-zinc-500">Serial</p>
            <p className="font-mono text-black dark:text-zinc-50">{sertifikat.serial}</p>
          </div>
          <div>
            <p className="text-zinc-500">Tanggal terbit</p>
            <p className="text-black dark:text-zinc-50">{formatDate(sertifikat.terbitPada)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Nilai akhir</p>
            <p className="text-black dark:text-zinc-50">{sertifikat.nilaiAkhir}</p>
          </div>
        </div>

        {sertifikat.items.length > 0 && (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th className="py-1 font-medium">Modul</th>
                <th className="py-1 font-medium">Skor</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sertifikat.items.map((item) => (
                <tr
                  key={item.modulId}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-1 text-black dark:text-zinc-50">{item.judul}</td>
                  <td className="py-1 text-black dark:text-zinc-50">{item.skor}</td>
                  <td className="py-1 text-black dark:text-zinc-50">
                    {item.lulus ? "Lulus" : "Belum lulus"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sertifikat.pernyataanAtestasi.length > 0 && (
          <ul className="mt-4 space-y-1 text-left text-sm text-black dark:text-zinc-50">
            {sertifikat.pernyataanAtestasi.map((kalimat) => (
              <li key={kalimat}>{kalimat}</li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-sm font-medium">
          Status:{" "}
          <span className={sertifikat.status === "berlaku" ? "text-green-600" : "text-red-600"}>
            {sertifikat.status === "berlaku" ? "Berlaku" : "Dicabut"}
          </span>
        </p>
      </div>
    </div>
  );
}
