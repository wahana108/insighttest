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

type PendaftaranUntukKelayakan = Pick<
  Pendaftaran,
  "modulSnapshot" | "hasilModul" | "referensiDibuka"
>;
type KegiatanUntukKelayakan = Pick<Kegiatan, "syaratSertifikat">;

/**
 * Fungsi murni — tidak menyentuh Firestore — dipakai BERSAMA oleh
 * penerbitan mandiri (POST /api/sertifikat/terbitkan) dan penerbitan
 * massal (menyusul). Satu sumber kebenaran untuk "siapa yang layak".
 *
 * jenis 'nilai_minimum': layak kalau SEMUA modul di modulSnapshot yang
 * wajib DAN berkategori evaluasi sudah hasilModul.lulus === true, DAN
 * (kalau syaratSertifikat.wajibBukaReferensi true) semua modul referensi
 * WAJIB di modulSnapshot sudah tercatat di referensiDibuka. Modul yang
 * belum pernah dicoba/dibuka dianggap belum lulus/belum dibuka, bukan
 * diabaikan.
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

  // KA-4: wajibBukaReferensi adalah data (bagian syaratSertifikat), bukan
  // hardcode. KA-5: modul referensi WAJIB yang dihitung diambil dari
  // modulSnapshot milik PENDAFTARAN ini, bukan daftar modul referensi
  // kegiatan saat ini — supaya admin menambah materi referensi baru
  // setelah peserta terdaftar tidak membuat peserta lama mendadak jadi
  // belum layak.
  if (kegiatan.syaratSertifikat.wajibBukaReferensi) {
    const referensiWajib = pendaftaran.modulSnapshot.filter(
      (modul) => modul.wajib && modul.kategori === "referensi"
    );
    // KA-1 di semangat yang sama: referensiDibuka bisa tidak ada sama
    // sekali pada dokumen pendaftaran lama (dari sebelum field ini ada) —
    // diperlakukan sebagai daftar kosong, bukan dilempar sebagai error,
    // walau tipe TypeScript-nya sudah mengklaim selalu array.
    const referensiDibuka = Array.isArray(pendaftaran.referensiDibuka)
      ? pendaftaran.referensiDibuka
      : [];
    const belumDibuka = referensiWajib.filter(
      (modul) => !referensiDibuka.includes(modul.modulId)
    );
    if (belumDibuka.length > 0) {
      return {
        layak: false,
        status: "belum_layak",
        alasan: `${belumDibuka.length} dari ${referensiWajib.length} materi referensi wajib belum dibuka.`,
        nilaiAkhir,
        items,
      };
    }
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
