/**
 * Konversi antara ISO string (disimpan) dan format value input
 * datetime-local (waktu lokal, "YYYY-MM-DDTHH:mm") — dipakai di form
 * kegiatan untuk dibukaPada/ditutupPada.
 */
export function isoToDatetimeLocalValue(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function datetimeLocalValueToIso(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

/**
 * Tanggal dan jam dipisah jadi dua input di form (bukan satu
 * datetime-local) — browser menolak datetime-local yang cuma terisi
 * tanggal dengan galat yang membingungkan, dan itu menyembunyikan jam
 * default 00:00/23:59 yang sebenarnya kita isikan otomatis.
 */
export function isoToDateValue(iso: string | null): string {
  const full = isoToDatetimeLocalValue(iso);
  return full ? full.slice(0, 10) : "";
}

export function isoToTimeValue(iso: string | null): string {
  const full = isoToDatetimeLocalValue(iso);
  return full ? full.slice(11, 16) : "";
}

export function dateAndTimeValuesToIso(dateValue: string, timeValue: string): string | null {
  if (!dateValue) {
    return null;
  }
  return datetimeLocalValueToIso(`${dateValue}T${timeValue || "00:00"}`);
}
