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

/** "31 Agu 2026 00:00" — dibuat manual (bukan toLocaleTimeString) supaya pemisah jam:menit selalu ":", terlepas dari locale. */
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
  });
  const jam = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${tanggal} ${jam}`;
}

/** "12:05" — mm:ss, dipakai penghitung mundur attempt. Negatif dianggap 0. */
export function formatSisaWaktu(detik: number): string {
  const bulat = Math.max(0, Math.round(detik));
  const menit = Math.floor(bulat / 60);
  const sisaDetik = bulat % 60;
  return `${menit}:${String(sisaDetik).padStart(2, "0")}`;
}
