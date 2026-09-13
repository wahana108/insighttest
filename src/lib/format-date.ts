export function formatDate(iso: string): string {
  if (!iso) {
    return "-";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Jam dalam Asia/Jakarta, HH:MM, TERLEPAS dari timeZone lokal peramban —
 * en-GB + hourCycle 'h23' dipakai murni sebagai cara stabil mengekstrak
 * jam/menit lewat formatToParts() (locale id-ID menulis "13.05" dengan
 * titik, bukan titik dua, untuk hour/minute numerik).
 */
function jakartaHourMinute(date: Date): { hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return {
    hour: parts.find((p) => p.type === "hour")?.value ?? "00",
    minute: parts.find((p) => p.type === "minute")?.value ?? "00",
  };
}

/**
 * "31 Agu 2026 00:00 WIB" — Slice "akses-kegiatan" §5b: SELALU Asia/Jakarta
 * dan SELALU berlabel "WIB" secara eksplisit, terlepas dari zona waktu
 * peramban peserta — sebelumnya jam diambil dari getHours()/getMinutes()
 * (zona LOKAL peramban) tanpa label sama sekali, jadi peserta di zona lain
 * bisa membaca jam yang salah tanpa tahu itu salah. Kegiatan/{id}.dibukaPada
 * dan ditutupPada SELALU dimaksudkan sebagai WIB (platform Indonesia),
 * jadi ini bukan pilihan tampilan — ini mengoreksi salah baca yang sudah
 * ada sebelumnya.
 */
export function formatDateTime(iso: string): string {
  if (!iso) {
    return "-";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  const tanggal = date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const { hour, minute } = jakartaHourMinute(date);
  return `${tanggal} ${hour}:${minute} WIB`;
}

/** "12:05" — mm:ss, dipakai penghitung mundur attempt. Negatif dianggap 0. */
export function formatSisaWaktu(detik: number): string {
  const bulat = Math.max(0, Math.round(detik));
  const menit = Math.floor(bulat / 60);
  const sisaDetik = bulat % 60;
  return `${menit}:${String(sisaDetik).padStart(2, "0")}`;
}
