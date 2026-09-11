/**
 * Slice "kuota-peserta" (docs/kickoff.md §R, SLICE 1) — dua lapis kuota
 * yang menutup pintu pendaftaran SENDIRI tanpa mode undangan:
 *
 * LAPIS 1 (kuotaPeserta, per kegiatan): berlaku untuk SEMUA jalur masuk
 * (mandiri maupun impor admin) — dipanggil kedua route dengan cara yang
 * sama.
 *
 * LAPIS 2 (batasPendaftaranBaruPerHari, global): berlaku HANYA jalur
 * mandiri — impor admin sengaja dikecualikan (lihat komentar pemanggil).
 *
 * Fungsi murni saja di sini — tidak ada akses Firestore. Nilai dibaca oleh
 * pemanggil (KA-1: 0/kosong berarti tak terbatas, BUKAN galat) lalu dioper
 * ke sini sebagai angka biasa. Diuji lewat scripts/uji-kuota-peserta.ts.
 */

export interface HasilKeputusanKuota {
  ok: boolean;
  pesan: string | null;
}

const OK: HasilKeputusanKuota = { ok: true, pesan: null };

/**
 * LAPIS 1 — kuotaKegiatan 0 berarti tak terbatas (BAWAAN, KA-4: batas
 * adalah parameter). nomorUrutBaru adalah posisi yang AKAN diduduki
 * pendaftar ini kalau diterima (nomorUrutTerakhir + 1, dihitung pemanggil
 * dari penghitung yang sudah ada — lihat komentar nomorUrutTerakhir di
 * src/types/kegiatan.ts) — BUKAN hasil query, supaya berlaku sama persis
 * untuk jalur mandiri maupun impor tanpa menghitung ulang siapa saja yang
 * sudah terdaftar.
 */
export function putuskanKuotaKegiatan(
  kuotaKegiatan: number,
  nomorUrutBaru: number
): HasilKeputusanKuota {
  if (kuotaKegiatan <= 0) {
    return OK;
  }
  if (nomorUrutBaru > kuotaKegiatan) {
    return { ok: false, pesan: "Kuota peserta kegiatan ini sudah penuh." };
  }
  return OK;
}

/**
 * LAPIS 2 — batasHarian 0 berarti tak terbatas (BAWAAN). jumlahBaruHariIni
 * adalah jumlah pendaftaran mandiri BARU yang AKAN tercatat hari ini kalau
 * pendaftaran ini diterima (jumlah yang sudah tercatat + 1, dibaca
 * pemanggil dari kuota_harian/{tanggal} DALAM transaksi yang sama — lihat
 * komentar jebakan 5.0c di src/app/api/pendaftaran/route.ts). Pesannya
 * SENGAJA menyebut "coba lagi besok" — ini keadaan yang pulih sendiri,
 * bukan kegagalan permanen.
 */
export function putuskanBatasHarian(
  batasHarian: number,
  jumlahBaruHariIni: number
): HasilKeputusanKuota {
  if (batasHarian <= 0) {
    return OK;
  }
  if (jumlahBaruHariIni > batasHarian) {
    return {
      ok: false,
      pesan: "Kuota pendaftaran hari ini sudah penuh. Coba lagi besok.",
    };
  }
  return OK;
}

/**
 * Kunci tanggal untuk kuota_harian/{tanggal} — SENGAJA memakai zona waktu
 * Asia/Jakarta, BUKAN UTC. Kalau memakai UTC, kuota harian pengguna
 * Indonesia akan mereset pukul 07.00 pagi (UTC+7), bukan tengah malam —
 * dan tidak ada yang akan mengerti kenapa jumlahnya "meloncat" di tengah
 * jam kerja. en-CA menghasilkan YYYY-MM-DD langsung tanpa perlu menyusun
 * ulang bagian tanggal secara manual.
 */
export function tanggalJakarta(waktu: Date): string {
  return waktu.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}
