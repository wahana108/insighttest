const POLA_ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;

/**
 * Mengekstrak video ID YouTube dari tiga bentuk URL yang diterima:
 * youtu.be/{id}, youtube.com/watch?v={id}, dan youtube.com/embed/{id}.
 * Dipakai dua kali dengan sumber yang sama persis (tautan mentah): saat
 * validasi simpan (src/lib/services/modul.ts) dan saat render
 * (src/app/kegiatan/[id]/modul/[modulId]/page.tsx) — ID dihitung ulang di
 * kedua tempat dari sumber yang tersimpan, tidak pernah disimpan sendiri.
 */
export function ekstrakYoutubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return POLA_ID_VIDEO.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v") ?? "";
      return POLA_ID_VIDEO.test(id) ? id : null;
    }
    const embedMatch = parsed.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/);
    if (embedMatch) {
      return embedMatch[1];
    }
  }

  return null;
}
