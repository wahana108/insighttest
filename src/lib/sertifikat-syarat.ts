import type { Kegiatan } from "@/types/kegiatan";
import type { Pendaftaran } from "@/types/pendaftaran";
import type { ItemSertifikat } from "@/types/sertifikat";

export type StatusKelayakan = "layak" | "belum_layak" | "ditentukan_admin";

export interface HasilKelayakan {
  /**
   * Dipertahankan supaya pemanggil yang sudah ada (jalur penerbitan) tidak
   * berubah perilakunya — TETAP false untuk 'manual_admin', persis seperti
   * sebelum field `status` ada. Untuk tampilan, pakai `status`, bukan ini:
   * `layak: false` pada 'manual_admin' bukan berarti peserta gagal, hanya
   * berarti sistem tidak menilai kelayakan secara otomatis.
   */
  layak: boolean;
  status: StatusKelayakan;
  alasan: string;
  nilaiAkhir: number;
  items: ItemSertifikat[];
}

type PendaftaranUntukKelayakan = Pick<Pendaftaran, "modulSnapshot" | "hasilModul">;
type KegiatanUntukKelayakan = Pick<Kegiatan, "syaratSertifikat">;

/**
 * Fungsi murni — tidak menyentuh Firestore — dipakai BERSAMA oleh
 * penerbitan mandiri (POST /api/sertifikat/terbitkan) dan penerbitan
 * massal (menyusul). Satu sumber kebenaran untuk "siapa yang layak".
 *
 * jenis 'nilai_minimum': layak kalau SEMUA modul di modulSnapshot yang
 * wajib DAN berkategori evaluasi sudah hasilModul.lulus === true. Modul
 * yang belum pernah dicoba dianggap belum lulus, bukan diabaikan.
 *
 * jenis 'manual_admin': TIDAK PERNAH layak secara otomatis — hanya admin
 * yang boleh menerbitkan, lewat jalur `uid` di POST /api/sertifikat/terbitkan.
 */
export function evaluasiKelayakan(
  pendaftaran: PendaftaranUntukKelayakan,
  kegiatan: KegiatanUntukKelayakan
): HasilKelayakan {
  const modulWajibEvaluasi = pendaftaran.modulSnapshot.filter(
    (modul) => modul.wajib && modul.kategori === "evaluasi"
  );

  const items: ItemSertifikat[] = modulWajibEvaluasi.map((modul) => {
    const hasil = pendaftaran.hasilModul[modul.modulId];
    return {
      modulId: modul.modulId,
      judul: modul.judul,
      skor: hasil?.skorTertinggi ?? 0,
      lulus: hasil?.lulus ?? false,
    };
  });

  const nilaiAkhir =
    items.length > 0
      ? Math.round(items.reduce((total, item) => total + item.skor, 0) / items.length)
      : 0;

  if (kegiatan.syaratSertifikat.jenis === "manual_admin") {
    return {
      layak: false,
      status: "ditentukan_admin",
      alasan: "Syarat sertifikat kegiatan ini adalah penerbitan manual oleh admin.",
      nilaiAkhir,
      items,
    };
  }

  const belumLulus = items.filter((item) => !item.lulus);
  if (belumLulus.length > 0) {
    return {
      layak: false,
      status: "belum_layak",
      alasan: `Belum lulus modul: ${belumLulus.map((item) => item.judul).join(", ")}.`,
      nilaiAkhir,
      items,
    };
  }

  return {
    layak: true,
    status: "layak",
    alasan:
      items.length > 0
        ? "Semua modul evaluasi wajib sudah lulus."
        : "Tidak ada modul evaluasi wajib pada kegiatan ini.",
    nilaiAkhir,
    items,
  };
}
