import { nilaiAtestasi } from "@/lib/atestasi-pernyataan";
import type { HasilUntukNilaiAtestasi, TingkatAtestasi } from "@/lib/atestasi-pernyataan";
import type { JenisSyaratSertifikat, Kegiatan } from "@/types/kegiatan";
import type { Pendaftaran } from "@/types/pendaftaran";
import type { ItemSertifikat, JenisSertifikat } from "@/types/sertifikat";

export type StatusKelayakan = "layak" | "belum_layak" | "ditentukan_admin";

/**
 * Slice 7.4 §3: HANYA hasil mode syaratSertifikat.jenis (nilai minimum,
 * manual admin, dan sejenisnya) — TIDAK LAGI memuat gerbang referensi/
 * atestasi (itu sekarang PrasyaratMateri, terpisah). Bentuk dan isinya
 * TIDAK BERUBAH dari sebelum pemisahan ini — pemanggil lama yang cuma
 * peduli nilai tetap dapat jawaban yang sama persis.
 */
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

/** Tingkat nilaiAtestasi() satu modul atestasi tertentu di modulSnapshot. */
export interface StatusAtestasiModul {
  modulId: string;
  judul: string;
  wajib: boolean;
  tingkat: TingkatAtestasi;
}

/** Status "sudah dibuka atau belum" satu modul referensi tertentu di modulSnapshot. */
export interface StatusReferensiModul {
  modulId: string;
  judul: string;
  wajib: boolean;
  dibuka: boolean;
}

/**
 * Keadaan materi wajib (referensi + atestasi) — SELALU dihitung, apa pun
 * syaratSertifikat.jenis-nya (beda dari HasilKelayakan, yang untuk
 * 'manual_admin' cuma balik "ditentukan_admin" tanpa pernah menyentuh
 * materi). Ini yang membuat admin bisa melihat keadaan materi peserta
 * WALAU kegiatannya bersyarat manual — lihat komentar di
 * terbitkanSertifikatUntuk() untuk bagaimana ini dipakai menggerbang
 * penerbitan.
 *
 * referensiWajibTotal/atestasiWajibTotal dan hitungan "belum"-nya SELALU
 * angka sungguhan dari modulSnapshot, TERLEPAS dari apakah
 * wajibBukaReferensi/atestasiJadiSyarat aktif — supaya laporan (Slice 7.4
 * scripts/periksa-kelayakan.ts) dan tabel admin tetap bisa menunjukkan
 * keadaan materi apa adanya. `tuntas` SATU-SATUNYA field yang
 * memperhitungkan kedua centang itu (KA-4): kalau centangnya mati, materi
 * kategori itu tidak pernah menghalangi `tuntas`, berapa pun sisanya.
 */
export interface PrasyaratMateri {
  wajibBukaReferensi: boolean;
  referensiWajibTotal: number;
  referensiBelumDibuka: number;
  /** SEMUA modul referensi di modulSnapshot (wajib maupun opsional) — dipakai menyebut nama modul yang belum dibuka (Slice 7.6). */
  referensiPerModul: StatusReferensiModul[];
  atestasiJadiSyarat: boolean;
  atestasiWajibTotal: number;
  atestasiBelumTuntas: number;
  /** SEMUA modul atestasi di modulSnapshot (wajib maupun opsional) — dipakai juga oleh kalimat pernyataan sertifikat. */
  atestasiPerModul: StatusAtestasiModul[];
  tuntas: boolean;
}

/**
 * Slice 7.6: tiga keadaan, bukan dua — "tuntas" tidak cukup untuk
 * menggambarkan prasyaratMateri, karena tuntas=true bisa berarti DUA hal
 * yang berbeda maknanya bagi peserta/admin: benar-benar tuntas, ATAU
 * materi nyatanya belum tuntas tapi gerbangnya sedang tidak aktif
 * (sehingga tidak menghalangi). Lihat statusPrasyaratMateri() di bawah.
 */
export type StatusPrasyaratMateri =
  | "tuntas"
  | "belum_tuntas_menghalangi"
  | "belum_tuntas_tidak_menghalangi";

/**
 * Fungsi murni. p.tuntas hanya pernah false kalau ADA kategori dengan
 * gerbang AKTIF yang belum tuntas — jadi false di sana selalu berarti
 * "menghalangi". p.tuntas true bisa jadi genuinely tuntas, ATAU salah
 * satu kategori nyatanya belum tuntas tapi gerbangnya mati (raw
 * belum/total dihitung TERLEPAS dari status gerbang — lihat komentar
 * PrasyaratMateri) — kasus ini SENGAJA dibedakan supaya pemanggil (laporan,
 * tabel admin) tidak pernah salah bilang "tuntas" untuk keadaan ini.
 */
export function statusPrasyaratMateri(p: PrasyaratMateri): StatusPrasyaratMateri {
  if (!p.tuntas) {
    return "belum_tuntas_menghalangi";
  }
  const referensiSebenarnyaBelum = p.referensiWajibTotal > 0 && p.referensiBelumDibuka > 0;
  const atestasiSebenarnyaBelum = p.atestasiWajibTotal > 0 && p.atestasiBelumTuntas > 0;
  return referensiSebenarnyaBelum || atestasiSebenarnyaBelum
    ? "belum_tuntas_tidak_menghalangi"
    : "tuntas";
}

export interface HasilEvaluasi {
  kelayakan: HasilKelayakan;
  prasyaratMateri: PrasyaratMateri;
}

// atestasi override-nya SENGAJA lebih sempit dari Pendaftaran.atestasi
// (Record<string, HasilAtestasi> penuh) — evaluasiKelayakan() hanya pernah
// membaca score dan detikTersaksikan (lewat nilaiAtestasi()), jadi
// pemanggil tidak perlu merakit HasilAtestasi lengkap (gameId/hp/dst)
// hanya untuk memeriksa kelayakan.
type PendaftaranUntukKelayakan = Pick<
  Pendaftaran,
  "modulSnapshot" | "hasilModul" | "referensiDibuka"
> & {
  atestasi: Record<string, HasilUntukNilaiAtestasi>;
};
type KegiatanUntukKelayakan = Pick<Kegiatan, "syaratSertifikat">;

/**
 * Fungsi murni — tidak menyentuh Firestore — dipakai BERSAMA oleh
 * penerbitan mandiri (POST /api/sertifikat/terbitkan), penerbitan massal,
 * dan pratinjau admin. Satu sumber kebenaran, sekarang mengembalikan DUA
 * hal terpisah (Slice 7.4 §3):
 *
 * `kelayakan` — HANYA mode syarat (nilai minimum / manual admin).
 * jenis 'nilai_minimum': layak kalau SEMUA modul di modulSnapshot yang
 * wajib DAN berkategori evaluasi sudah hasilModul.lulus === true. Modul
 * yang belum pernah dicoba dianggap belum lulus, bukan diabaikan.
 * jenis 'manual_admin': TIDAK PERNAH layak secara otomatis — hanya admin
 * yang boleh menerbitkan, lewat jalur `uid` di POST /api/sertifikat/terbitkan.
 *
 * `prasyaratMateri` — keadaan modul referensi/atestasi WAJIB di
 * modulSnapshot, SELALU dihitung terlepas dari jenis. `tuntas`
 * memperhitungkan wajibBukaReferensi/atestasiJadiSyarat (KA-4): kalau
 * salah satu mati, kategori itu tidak pernah menahan `tuntas`.
 *
 * Lihat terbitkanSertifikatUntuk() (src/lib/api/sertifikat-server.ts)
 * untuk aturan penerbitan yang menggabungkan keduanya — TIDAK sama untuk
 * kedua bagian ini: mode otomatis menggerbang pada prasyaratMateri.tuntas
 * juga (bukan cuma kelayakan.layak), mode manual admin tidak pernah
 * digerbang prasyaratMateri sama sekali.
 */
export function evaluasiKelayakan(
  pendaftaran: PendaftaranUntukKelayakan,
  kegiatan: KegiatanUntukKelayakan
): HasilEvaluasi {
  const modulWajibEvaluasi = pendaftaran.modulSnapshot.filter(
    (modul) => modul.wajib && modul.kategori === "evaluasi"
  );

  const items: ItemSertifikat[] = modulWajibEvaluasi.map((modul) => {
    const hasil = pendaftaran.hasilModul[modul.modulId];
    return {
      modulId: modul.modulId,
      judul: modul.judul,
      skor: hasil?.skorTertinggi ?? 0,
      // Slice "ujian-berwaktu": hasil kedaluwarsa (dikirim setelah
      // ditutupPada kegiatan) TIDAK PERNAH melayakkan otomatis — dipaksa
      // false di sini walau field lulus yang tersimpan true, persis
      // semangat mode manual_admin (keputusan berpindah ke admin). Skor di
      // atas TIDAK disentuh — tetap tercatat dan tetap tampil.
      lulus: (hasil?.lulus ?? false) && !(hasil?.kedaluwarsa ?? false),
    };
  });

  const nilaiAkhir =
    items.length > 0
      ? Math.round(items.reduce((total, item) => total + item.skor, 0) / items.length)
      : 0;

  let kelayakan: HasilKelayakan;
  if (kegiatan.syaratSertifikat.jenis === "manual_admin") {
    kelayakan = {
      layak: false,
      status: "ditentukan_admin",
      alasan: "Syarat sertifikat kegiatan ini adalah penerbitan manual oleh admin.",
      nilaiAkhir,
      items,
    };
  } else {
    const belumLulus = items.filter((item) => !item.lulus);
    if (belumLulus.length > 0) {
      kelayakan = {
        layak: false,
        status: "belum_layak",
        alasan: `Belum lulus modul: ${belumLulus.map((item) => item.judul).join(", ")}.`,
        nilaiAkhir,
        items,
      };
    } else {
      kelayakan = {
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
  }

  // KA-4: wajibBukaReferensi/atestasiJadiSyarat adalah data (bagian
  // syaratSertifikat), bukan hardcode. KA-5: modul WAJIB dan ambang/
  // target/durasinya diambil dari modulSnapshot milik PENDAFTARAN ini
  // (dibekukan saat mendaftar), bukan modul/kegiatan saat ini — supaya
  // admin mengubah materi/ambang setelah peserta terdaftar tidak membuat
  // peserta lama mendadak berubah prasyaratnya.
  const referensiWajib = pendaftaran.modulSnapshot.filter(
    (modul) => modul.wajib && modul.kategori === "referensi"
  );
  // KA-1 di semangat yang sama: referensiDibuka/atestasi bisa tidak ada
  // sama sekali pada dokumen pendaftaran lama (dari sebelum field-field
  // ini ada) — diperlakukan sebagai kosong, bukan dilempar sebagai error,
  // walau tipe TypeScript-nya sudah mengklaim selalu ada.
  const referensiDibuka = Array.isArray(pendaftaran.referensiDibuka)
    ? pendaftaran.referensiDibuka
    : [];
  const referensiBelumDibuka = referensiWajib.filter(
    (modul) => !referensiDibuka.includes(modul.modulId)
  ).length;
  const referensiPerModul: StatusReferensiModul[] = pendaftaran.modulSnapshot
    .filter((modul) => modul.kategori === "referensi")
    .map((modul) => ({
      modulId: modul.modulId,
      judul: modul.judul,
      wajib: modul.wajib,
      dibuka: referensiDibuka.includes(modul.modulId),
    }));

  const atestasiMap =
    pendaftaran.atestasi && typeof pendaftaran.atestasi === "object" ? pendaftaran.atestasi : {};
  const atestasiPerModul: StatusAtestasiModul[] = pendaftaran.modulSnapshot
    .filter((modul) => modul.kategori === "atestasi")
    .map((modul) => ({
      modulId: modul.modulId,
      judul: modul.judul,
      wajib: modul.wajib,
      tingkat: nilaiAtestasi(
        {
          ambangKeterlibatan: modul.ambangKeterlibatan ?? { mode: "persen", nilai: 90 },
          targetSkor: modul.targetSkor,
          durasiDetik: modul.durasiDetik,
        },
        atestasiMap[modul.modulId]
      ).tingkat,
    }));
  const atestasiWajibPerModul = atestasiPerModul.filter((modul) => modul.wajib);
  const atestasiBelumTuntas = atestasiWajibPerModul.filter(
    (modul) => modul.tingkat === "belum"
  ).length;

  const prasyaratMateri: PrasyaratMateri = {
    wajibBukaReferensi: kegiatan.syaratSertifikat.wajibBukaReferensi,
    referensiWajibTotal: referensiWajib.length,
    referensiBelumDibuka,
    referensiPerModul,
    atestasiJadiSyarat: kegiatan.syaratSertifikat.atestasiJadiSyarat,
    atestasiWajibTotal: atestasiWajibPerModul.length,
    atestasiBelumTuntas,
    atestasiPerModul,
    tuntas:
      (!kegiatan.syaratSertifikat.wajibBukaReferensi || referensiBelumDibuka === 0) &&
      (!kegiatan.syaratSertifikat.atestasiJadiSyarat || atestasiBelumTuntas === 0),
  };

  return { kelayakan, prasyaratMateri };
}

/**
 * Satu kategori (referensi ATAU atestasi) dari deskripsiPrasyaratMateri()
 * di bawah — null kalau tidak ada apa pun perlu disebut (tidak ada modul
 * wajib kategori ini, atau semuanya sudah tuntas).
 */
function deskripsiKategoriMateri(
  aktif: boolean,
  belum: number,
  total: number,
  namaKategori: string,
  kataKerja: string
): string | null {
  if (total === 0 || belum === 0) {
    return null;
  }
  if (aktif) {
    return `${belum} dari ${total} modul ${namaKategori} wajib belum ${kataKerja}`;
  }
  // Slice 7.6: gerbang mati TIDAK BOLEH membuat keadaan ini menghilang dari
  // deskripsi — cuma boleh membuatnya tidak menghalangi penerbitan.
  // "Jangan pernah mengklaim tuntas ketika gerbangnya mati."
  return `Gerbang ${namaKategori} tidak aktif — ${belum} dari ${total} modul ${namaKategori} wajib belum ${kataKerja}, tapi tidak menghalangi penerbitan`;
}

/**
 * Kalimat siap-pakai dari PrasyaratMateri — dipakai pesan penolakan server
 * (terbitkanSertifikatUntuk(), yang hanya pernah memanggil ini saat
 * !prasyaratMateri.tuntas — jadi hanya cabang "menghalangi" di atas yang
 * mungkin muncul di sana) dan laporan baca-saja (scripts/periksa-kelayakan.ts),
 * yang memanggilnya TERLEPAS dari nilai tuntas sehingga butuh ketiga
 * keadaan (lihat StatusPrasyaratMateri).
 */
export function deskripsiPrasyaratMateri(p: PrasyaratMateri): string {
  const bagian = [
    deskripsiKategoriMateri(
      p.wajibBukaReferensi,
      p.referensiBelumDibuka,
      p.referensiWajibTotal,
      "referensi",
      "dibuka"
    ),
    deskripsiKategoriMateri(
      p.atestasiJadiSyarat,
      p.atestasiBelumTuntas,
      p.atestasiWajibTotal,
      "atestasi",
      "dituntaskan"
    ),
  ].filter((s): s is string => s !== null);
  return bagian.length > 0 ? `${bagian.join("; ")}.` : "Semua materi wajib sudah tuntas.";
}

export interface KeputusanPenerbitan {
  bisaTerbit: boolean;
  alasan: string;
}

/**
 * Aturan penerbitan yang menggabungkan kelayakan (nilai) dan prasyaratMateri
 * (referensi/atestasi wajib) — SATU sumber kebenaran dipakai oleh gerbang
 * sungguhan (terbitkanSertifikatUntuk(), src/lib/api/sertifikat-server.ts),
 * laporan baca-saja (scripts/periksa-kelayakan.ts), dan uji
 * (scripts/uji-atestasi.ts). Mengubah aturan ini di satu tempat mengubahnya
 * di ketiganya sekaligus — tidak ada jalur yang bisa diam-diam berbeda.
 *
 * Mode 'nilai_minimum': prasyaratMateri.tuntas MENGGERBANG penerbitan sama
 * seperti kelayakan.layak — keduanya harus terpenuhi (Slice 7.4 §3).
 * Mode 'manual_admin': prasyaratMateri TIDAK PERNAH menggerbang di sini —
 * admin tetap bisa menerbitkan; prasyaratMateri hanya informasi bagi admin
 * (ditampilkan di tabel peserta), bukan penghalang.
 */
export function putuskanPenerbitan(
  jenisSyarat: JenisSyaratSertifikat,
  hasilEvaluasi: HasilEvaluasi
): KeputusanPenerbitan {
  const { kelayakan, prasyaratMateri } = hasilEvaluasi;

  if (jenisSyarat === "manual_admin") {
    return {
      bisaTerbit: true,
      alasan: "Mode manual admin — admin dapat menerbitkan kapan saja, prasyaratMateri hanya informasi.",
    };
  }

  if (!prasyaratMateri.tuntas) {
    return {
      bisaTerbit: false,
      alasan: `Materi wajib belum tuntas: ${deskripsiPrasyaratMateri(prasyaratMateri)}`,
    };
  }

  if (!kelayakan.layak) {
    return { bisaTerbit: false, alasan: kelayakan.alasan };
  }

  // Sampai sini prasyaratMateri.tuntas sudah pasti true — tapi itu bisa
  // berarti genuinely tuntas, ATAU sebagian materi nyatanya belum tuntas
  // sementara gerbangnya mati (statusPrasyaratMateri() membedakan
  // keduanya). Slice 7.6: jangan pernah bilang "semua materi wajib sudah
  // tuntas" untuk keadaan kedua itu.
  return {
    bisaTerbit: true,
    alasan:
      statusPrasyaratMateri(prasyaratMateri) === "tuntas"
        ? "Nilai memenuhi syarat dan semua materi wajib sudah tuntas."
        : `Nilai memenuhi syarat. ${deskripsiPrasyaratMateri(prasyaratMateri)}`,
  };
}

export interface HasilTentukanJenis {
  bolehTerbit: boolean;
  /** null kalau bolehTerbit false — tidak ada jenis untuk sesuatu yang tidak boleh terbit. */
  jenis: JenisSertifikat | null;
  alasan: string;
}

/**
 * Slice 6.3 — fungsi murni SATU-SATUNYA yang memutuskan jenis sertifikat.
 * TIDAK tersebar di UI: rekap peserta, konfirmasi "Terbitkan terpilih", DAN
 * terbitkanSertifikatUntuk() (src/lib/api/sertifikat-server.ts) memanggil
 * fungsi yang SAMA ini, supaya proyeksi yang admin lihat SEBELUM menekan
 * tombol tidak bisa diam-diam berbeda dari yang sungguhan terjadi saat
 * tombol ditekan.
 *
 * `bisaTerbitKelulusan` HARUS berasal dari putuskanPenerbitan(...).bisaTerbit
 * — bukan dari kelayakan.layak saja. Itu satu-satunya cara "memenuhi syarat
 * kelayakan" berarti benar untuk KEDUA mode syaratSertifikat:
 *   - 'nilai_minimum': bisaTerbit true HANYA kalau nilai memenuhi syarat
 *     DAN prasyaratMateri.tuntas — persis kondisi yang sudah dipakai
 *     self-issue sekarang, sekarang diperluas berlaku juga untuk admin.
 *   - 'manual_admin': bisaTerbit SELALU true (sistem tidak pernah menilai
 *     otomatis) — jadi jenis SELALU 'kelulusan' di mode ini, sama seperti
 *     perilaku satu-satunya yang pernah ada sebelum slice ini.
 * terbitkanKeikutsertaan karena itu TIDAK PERNAH relevan untuk
 * 'manual_admin' — bisaTerbit di sana tidak pernah false untuk memicunya.
 *
 * Admin TIDAK bisa menurunkan orang yang layak jadi keikutsertaan (jenis
 * 'kelulusan' dikembalikan tanpa syarat begitu bisaTerbitKelulusan true,
 * tidak peduli terbitkanKeikutsertaan), dan TIDAK bisa menaikkan yang
 * tidak layak jadi kelulusan (satu-satunya jalan ke 'kelulusan' adalah
 * bisaTerbitKelulusan true — tidak ada parameter lain yang bisa memaksanya).
 */
export function tentukanJenisSertifikat(
  terdaftar: boolean,
  bisaTerbitKelulusan: boolean,
  terbitkanKeikutsertaan: boolean
): HasilTentukanJenis {
  if (!terdaftar) {
    return { bolehTerbit: false, jenis: null, alasan: "Tidak terdaftar di kegiatan ini." };
  }
  if (bisaTerbitKelulusan) {
    return { bolehTerbit: true, jenis: "kelulusan", alasan: "Memenuhi syarat kelayakan." };
  }
  if (terbitkanKeikutsertaan) {
    return {
      bolehTerbit: true,
      jenis: "keikutsertaan",
      alasan: "Belum memenuhi syarat kelayakan — kegiatan ini mengizinkan sertifikat keikutsertaan.",
    };
  }
  return {
    bolehTerbit: false,
    jenis: null,
    alasan: "Belum memenuhi syarat kelayakan, dan kegiatan ini tidak mengizinkan sertifikat keikutsertaan.",
  };
}
