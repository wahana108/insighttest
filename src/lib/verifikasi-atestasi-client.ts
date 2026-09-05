/**
 * HANYA klien — memuat iframe tersembunyi dan window.addEventListener,
 * tidak ada di Node/server. Ini "gerbang pendaftaran" Slice 7.1: satu-
 * satunya cara KonfigurasiAtestasi.gameId/gameName/versi/durasiDetik
 * terisi. Admin tidak pernah mengetik gameId sendiri (lihat komentar di
 * ModulKegiatan, src/types/kegiatan.ts).
 *
 * Protokol CCL (diukur LANGSUNG dari enam game CCL produksi, 3 Sep 2026):
 * semua pesan lewat postMessage window.top dengan data.source === 'CCL_GAME'.
 * CCL_READY punya field type: 'CCL_READY' (berisi game_id/game_name/
 * version). Laporan keadaan TIDAK PUNYA field type sama sekali — sepuluh
 * field-nya (chapter_index, current_time_sec, duration_sec, game_id, hp,
 * running, score, source, watch_credit_sec, wave) tidak termasuk "type".
 * Keduanya dibedakan lewat BENTUK pesannya (data.type === 'CCL_READY' vs
 * typeof data.duration_sec === 'number' / type tidak ada), BUKAN urutan
 * kedatangan — gerbang di bawah tahan terhadap urutan apa pun, termasuk
 * laporan keadaan yang (secara tak terduga) tiba sebelum CCL_READY, dan
 * terhadap CCL_READY yang dikirim ulang (diabaikan, tidak pernah
 * diperlakukan sebagai laporan keadaan).
 *
 * Hanya game_id dan version yang terbukti terisi dari pengukuran; game_name
 * belum terverifikasi langsung — ketiganya tetap dibaca defensif (?? "").
 *
 * Dua game aksi (space-commander, ccl-runner) diam total setelah
 * CCL_READY sampai benar-benar dimainkan — tidak mengirim laporan keadaan
 * sama sekali selama menunggu. Itu SEHAT, bukan gagal; lihat penanganan
 * timeoutStateMs di bawah.
 */

export type HasilVerifikasiAtestasi =
  | {
      ok: true;
      gameId: string;
      gameName: string;
      versi: string;
      durasiDetik: number | null;
      originDiizinkan: string;
    }
  | { ok: false; alasan: string };

const TIMEOUT_READY_MS_DEFAULT = 10_000;
const TIMEOUT_STATE_MS_DEFAULT = 5_000;

export function verifikasiGameCcl(
  sumberUrl: string,
  opts: { timeoutReadyMs?: number; timeoutStateMs?: number } = {}
): Promise<HasilVerifikasiAtestasi> {
  const timeoutReadyMs = opts.timeoutReadyMs ?? TIMEOUT_READY_MS_DEFAULT;
  const timeoutStateMs = opts.timeoutStateMs ?? TIMEOUT_STATE_MS_DEFAULT;

  let originDiizinkan: string;
  try {
    originDiizinkan = new URL(sumberUrl).origin;
  } catch {
    return Promise.resolve({ ok: false, alasan: "URL sumber tidak valid." });
  }

  return new Promise<HasilVerifikasiAtestasi>((resolve) => {
    const iframe = document.createElement("iframe");
    // Tersembunyi dari layar, TAPI tetap punya dimensi nyata dan tidak
    // display:none — beberapa browser menunda/membekukan skrip di iframe
    // display:none, dan kita justru butuh skrip game itu jalan supaya
    // postMessage terkirim.
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");

    let selesai = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;
    let stateTimer: ReturnType<typeof setTimeout> | null = null;
    let dataReady: { gameId: string; gameName: string; versi: string } | null = null;
    let durasiTertangkap = false;
    let durasiDetik: number | null = null;

    function bersihkan() {
      window.removeEventListener("message", onMessage);
      if (readyTimer) {
        clearTimeout(readyTimer);
      }
      if (stateTimer) {
        clearTimeout(stateTimer);
      }
      iframe.remove();
    }

    // Bongkar iframe di SEMUA jalur keluar (berhasil, gagal, atau waktu
    // habis) — tidak ada jalur yang meninggalkannya menempel di halaman.
    function selesaikan(hasil: HasilVerifikasiAtestasi) {
      if (selesai) {
        return;
      }
      selesai = true;
      bersihkan();
      resolve(hasil);
    }

    // Lolos begitu KEDUA syarat terpenuhi — tidak peduli urutan mana yang
    // terpenuhi lebih dulu (CCL_READY dulu lalu laporan keadaan adalah
    // urutan biasa, tapi kebalikannya tetap ditangani benar).
    function cobaSelesaikan() {
      if (!dataReady || !durasiTertangkap) {
        return;
      }
      selesaikan({
        ok: true,
        gameId: dataReady.gameId,
        gameName: dataReady.gameName,
        versi: dataReady.versi,
        durasiDetik,
        originDiizinkan,
      });
    }

    function tangkapReady(rec: Record<string, unknown>) {
      if (dataReady) {
        // CCL_READY dikirim ulang — abaikan sepenuhnya, JANGAN diperlakukan
        // sebagai laporan keadaan (pesan ini tidak punya duration_sec, jadi
        // tanpa pagar ini ia akan salah lolos lewat cabang "type tidak ada"
        // di bawah kalau logikanya sampai tembus ke sana).
        return;
      }
      const gameId = typeof rec.game_id === "string" ? rec.game_id.trim() : "";
      if (!gameId) {
        // CCL_READY tapi tidak membawa game_id yang valid — bukan yang
        // bisa dipercaya. Biarkan gerbang menunggu pesan lain sampai
        // timeoutReadyMs habis.
        return;
      }
      dataReady = {
        gameId,
        gameName: typeof rec.game_name === "string" ? rec.game_name : "",
        versi: typeof rec.version === "string" ? rec.version : "",
      };
      if (readyTimer) {
        clearTimeout(readyTimer);
        readyTimer = null;
      }
      if (durasiTertangkap) {
        // Laporan keadaan sudah lebih dulu tiba (urutan tak terduga) —
        // langsung selesai, tidak perlu menunggu timeoutStateMs lagi.
        cobaSelesaikan();
        return;
      }
      stateTimer = setTimeout(() => {
        durasiTertangkap = true;
        durasiDetik = null;
        cobaSelesaikan();
      }, timeoutStateMs);
    }

    function tangkapLaporanKeadaan(rec: Record<string, unknown>) {
      if (durasiTertangkap) {
        // Sudah dapat laporan pertama — laporan-laporan berikutnya (game
        // video melapor ~1/detik) diabaikan, kita cuma butuh yang pertama.
        return;
      }
      durasiTertangkap = true;
      durasiDetik = typeof rec.duration_sec === "number" ? rec.duration_sec : null;
      if (stateTimer) {
        clearTimeout(stateTimer);
        stateTimer = null;
      }
      cobaSelesaikan();
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== originDiizinkan) {
        return;
      }
      const data = event.data;
      if (typeof data !== "object" || data === null) {
        return;
      }
      const rec = data as Record<string, unknown>;
      if (rec.source !== "CCL_GAME") {
        return;
      }

      if (rec.type === "CCL_READY") {
        tangkapReady(rec);
        return;
      }

      // Bukan CCL_READY — anggap laporan keadaan kalau punya duration_sec
      // berupa angka, atau tidak punya field type sama sekali (laporan
      // keadaan sungguhan memang tidak pernah punya field type).
      const terlihatSepertiLaporanKeadaan =
        typeof rec.duration_sec === "number" || rec.type === undefined;
      if (terlihatSepertiLaporanKeadaan) {
        tangkapLaporanKeadaan(rec);
      }
    }

    window.addEventListener("message", onMessage);

    readyTimer = setTimeout(() => {
      selesaikan({
        ok: false,
        alasan:
          "Game tidak mengirim CCL_READY dalam 10 detik. Kemungkinan penyebab: URL salah, " +
          "halaman tidak memuat, atau ini bukan game CCL.",
      });
    }, timeoutReadyMs);

    iframe.src = sumberUrl;
    document.body.appendChild(iframe);
  });
}
