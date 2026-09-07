/**
 * Autosave jawaban attempt ke localStorage — bukan ke server (ARSITEKTUR
 * §5: jawaban baru ditulis ke Firestore sekali saat submit, supaya tidak
 * menghabiskan kuota tulis harian). Ini murni jaring pengaman di sisi
 * klien: memuat ulang halaman tidak lagi menghapus jawaban yang sudah
 * dipilih. Isinya CUMA peta { soalId: opsiId } — tidak pernah teks soal,
 * opsi, atau apa pun selain pilihan peserta sendiri.
 *
 * Yang dipulihkan dari sini TIDAK PERNAH dipercaya sebagai kebenaran — ia
 * cuma mengisi ulang tampilan. Yang dinilai tetap apa yang dikirim ke
 * POST /api/attempt/[id]/submit saat itu juga.
 */

const PREFIX = "insighttest:jawaban-attempt:";

function kunci(attemptId: string): string {
  return `${PREFIX}${attemptId}`;
}

/**
 * Fungsi murni — tidak menyentuh localStorage sendiri, cuma memvalidasi
 * string mentah (hasil localStorage.getItem, boleh null) terhadap daftar
 * soalId attempt ini. Buang JSON yang rusak, buang bentuk yang salah,
 * buang jawaban untuk soal yang bukan bagian dari attempt ini.
 */
export function pulihkanJawaban(
  mentah: string | null,
  soalIds: string[]
): Record<string, string> {
  if (!mentah) {
    return {};
  }

  let terurai: unknown;
  try {
    terurai = JSON.parse(mentah);
  } catch {
    return {};
  }

  if (typeof terurai !== "object" || terurai === null || Array.isArray(terurai)) {
    return {};
  }

  const soalIdSet = new Set(soalIds);
  const bersih: Record<string, string> = {};
  for (const [soalId, opsiId] of Object.entries(terurai as Record<string, unknown>)) {
    if (soalIdSet.has(soalId) && typeof opsiId === "string") {
      bersih[soalId] = opsiId;
    }
  }
  return bersih;
}

/**
 * Baca string mentah untuk satu attemptId. null kalau belum pernah
 * tersimpan ATAU kalau localStorage tidak bisa diakses (mode penyamaran,
 * situs diblokir menyimpan) — pemanggil memperlakukan keduanya sama:
 * tidak ada yang dipulihkan, halaman tetap jalan seperti biasa.
 */
export function bacaJawabanTersimpan(attemptId: string): string | null {
  try {
    return window.localStorage.getItem(kunci(attemptId));
  } catch {
    return null;
  }
}

/** Diam-diam gagal kalau localStorage tidak bisa ditulis — bukan penghalang untuk mengerjakan. */
export function simpanJawabanTersimpan(
  attemptId: string,
  jawaban: Record<string, string>
): void {
  try {
    window.localStorage.setItem(kunci(attemptId), JSON.stringify(jawaban));
  } catch {
    // diam-diam gagal, lihat komentar di atas
  }
}

export function hapusJawabanTersimpan(attemptId: string): void {
  try {
    window.localStorage.removeItem(kunci(attemptId));
  } catch {
    // diam-diam gagal, lihat komentar di bacaJawabanTersimpan
  }
}

/**
 * Dipanggil setelah submit berhasil — hapus draft attempt ini, DAN sekalian
 * buang draft attempt lain yang menumpuk (modul lain, percobaan lama yang
 * tidak pernah tersubmit rapi). localStorage sudah terikat per
 * perangkat/profil browser, jadi "peserta yang sama" di sini berarti
 * "penyimpanan browser yang sama".
 */
export function bersihkanJawabanAttemptLain(attemptIdAktif: string): void {
  try {
    const kunciAktif = kunci(attemptIdAktif);
    const kunciDihapus: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== kunciAktif) {
        kunciDihapus.push(k);
      }
    }
    kunciDihapus.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // diam-diam gagal, lihat komentar di bacaJawabanTersimpan
  }
}
