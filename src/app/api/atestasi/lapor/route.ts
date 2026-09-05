import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";

class AtestasiLaporRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AtestasiLaporRouteError";
    this.status = status;
  }
}

function angka(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Simpan laporan telemetri CCL TERAKHIR seorang peserta untuk satu modul
 * atestasi. Dipanggil paling banyak beberapa kali per sesi (ambang
 * tercapai, tab disembunyikan, komponen dilepas) — TIDAK PERNAH per pesan
 * postMessage (~1/detik); itu tanggung jawab klien
 * (src/app/kegiatan/[id]/modul/[modulId]/page.tsx), lihat ARSITEKTUR §5.
 *
 * Slice 7.2a: 400 HANYA untuk kesalahan struktural (tidak terdaftar, modul
 * bukan atestasi, field wajib hilang). Pemeriksaan kewajaran TIDAK PERNAH
 * menolak lagi — desain awal (bandingkan watchCreditSec mentah terhadap
 * selisih waktu absolut sejak dimulaiPada) terbukti menolak tontonan yang
 * sah, karena CCL menyimpan kreditnya sendiri sehingga sesi baru bisa
 * mulai dengan angka yang sudah tinggi. Sekarang berbasis PERTAMBAHAN
 * detikTersaksikan (dihitung klien dari perubahan telemetri nyata, lihat
 * ModulAtestasi) sejak laporan TERAKHIR — kelebihan dipangkas dan ditandai,
 * bukan ditolak.
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AtestasiLaporRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    const modulId = typeof parsed.modulId === "string" ? parsed.modulId : "";
    const gameId = typeof parsed.gameId === "string" ? parsed.gameId : "";
    if (!kegiatanId || !modulId || !gameId) {
      throw new AtestasiLaporRouteError(400, "kegiatanId, modulId, dan gameId wajib diisi.");
    }
    const hp = angka(parsed.hp);
    const score = angka(parsed.score);
    const watchCreditSec = angka(parsed.watchCreditSec);
    const currentTimeSec = angka(parsed.currentTimeSec);
    const durationSec = typeof parsed.durationSec === "number" ? parsed.durationSec : null;
    const chapterIndex = angka(parsed.chapterIndex);
    const detikTersaksikanMasuk = angka(parsed.detikTersaksikan);
    const nickname = typeof parsed.nickname === "string" ? parsed.nickname.trim() : "";

    const db = getAdminDb();
    const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${user.uid}`);
    const pendaftaranSnap = await pendaftaranRef.get();
    if (!pendaftaranSnap.exists) {
      throw new AtestasiLaporRouteError(403, "Anda belum terdaftar di kegiatan ini.");
    }

    const data = pendaftaranSnap.data() ?? {};
    const modulSnapshot = Array.isArray(data.modulSnapshot) ? data.modulSnapshot : [];
    const modul = modulSnapshot.find(
      (item): item is Record<string, unknown> =>
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).modulId === modulId
    );
    if (!modul || modul.kategori !== "atestasi") {
      throw new AtestasiLaporRouteError(
        400,
        "Modul ini bukan modul atestasi pada pendaftaran Anda."
      );
    }

    const atestasiData =
      typeof data.atestasi === "object" && data.atestasi !== null
        ? (data.atestasi as Record<string, unknown>)
        : {};
    const lamaRaw = atestasiData[modulId];
    const lama =
      typeof lamaRaw === "object" && lamaRaw !== null
        ? (lamaRaw as Record<string, unknown>)
        : null;

    const dimulaiPada = lama && typeof lama.dimulaiPada === "string" ? lama.dimulaiPada : "";
    if (!dimulaiPada) {
      throw new AtestasiLaporRouteError(
        400,
        "Belum ada catatan mulai untuk modul ini — panggil POST /api/atestasi/mulai dulu."
      );
    }

    // Identitas game dibekukan saat admin memverifikasi modul (Slice 7.1,
    // kegiatan/{id}/modul/{mid}.atestasi.gameId). Beda berarti isi di URL
    // yang sama sudah diganti sejak itu — dicatat, bukan ditolak; admin
    // yang perlu tahu.
    const modulKegiatanSnap = await db
      .collection("kegiatan")
      .doc(kegiatanId)
      .collection("modul")
      .doc(modulId)
      .get();
    const modulKegiatanData = modulKegiatanSnap.exists ? (modulKegiatanSnap.data() ?? {}) : {};
    const atestasiBeku =
      typeof modulKegiatanData.atestasi === "object" && modulKegiatanData.atestasi !== null
        ? (modulKegiatanData.atestasi as Record<string, unknown>)
        : {};
    const gameIdBeku = typeof atestasiBeku.gameId === "string" ? atestasiBeku.gameId : "";
    const gameBerubah = Boolean(gameIdBeku) && gameIdBeku !== gameId;

    // Simpan yang TERBAIK (mentah, untuk ditampilkan ke peserta) —
    // watchCreditSec/score/hp tertinggi antar sesi (ARSITEKTUR §11,
    // semangat yang sama dengan HasilModul.skorTertinggi). currentTimeSec/
    // durationSec/chapterIndex adalah posisi dalam game, bukan capaian —
    // diambil dari laporan TERAKHIR, bukan "tertinggi".
    const watchCreditSecTersimpan =
      lama && typeof lama.watchCreditSec === "number" ? lama.watchCreditSec : 0;
    const scoreTersimpan = lama && typeof lama.score === "number" ? lama.score : 0;
    const hpTersimpan = lama && typeof lama.hp === "number" ? lama.hp : 0;
    const nicknameTersimpan =
      lama && typeof lama.nicknameCcl === "string" ? lama.nicknameCcl : "";

    // detikTersaksikan — apa yang portal SENDIRI saksikan sebagai
    // keterlibatan nyata (klien sudah memfilter laporan yang identik,
    // lihat ModulAtestasi). acuan waktu = laporan terakhir tersimpan,
    // atau dimulaiPada kalau ini laporan pertama.
    const laporTerakhirPadaLama =
      lama && typeof lama.laporTerakhirPada === "string" ? lama.laporTerakhirPada : null;
    const acuanWaktu = laporTerakhirPadaLama ?? dimulaiPada;
    const berlaluSec = Math.max(0, (Date.now() - new Date(acuanWaktu).getTime()) / 1000);

    const detikTersaksikanSesiTerakhirLama =
      lama && typeof lama.detikTersaksikanSesiTerakhir === "number"
        ? lama.detikTersaksikanSesiTerakhir
        : 0;
    // detikTersaksikanMasuk adalah kumulatif SESI KLIEN SAAT INI (selalu
    // mulai dari 0 tiap kali halaman dibuka). Lebih kecil dari nilai sesi
    // yang tersimpan terakhir berarti sesi klien baru saja mulai ulang —
    // seluruh nilainya adalah pertambahan baru, bukan dikurangi (kalau
    // dikurangi hasilnya negatif dan salah).
    const sesiBaruDimulai = detikTersaksikanMasuk < detikTersaksikanSesiTerakhirLama;
    const pertambahanMentah = sesiBaruDimulai
      ? detikTersaksikanMasuk
      : detikTersaksikanMasuk - detikTersaksikanSesiTerakhirLama;

    const batasPertambahan = berlaluSec * 1.1;
    let pertambahan = Math.max(0, pertambahanMentah);
    let adaPemangkasan = false;
    let detikDipangkasKaliIni = 0;
    if (pertambahan > batasPertambahan) {
      detikDipangkasKaliIni = pertambahan - batasPertambahan;
      pertambahan = batasPertambahan;
      adaPemangkasan = true;
    }

    const detikTersaksikanLama =
      lama && typeof lama.detikTersaksikan === "number" ? lama.detikTersaksikan : 0;
    const detikTersaksikanBaru = detikTersaksikanLama + pertambahan;
    const detikDipangkasLama =
      lama && typeof lama.detikDipangkas === "number" ? lama.detikDipangkas : 0;
    const detikDipangkasBaru = detikDipangkasLama + detikDipangkasKaliIni;

    const now = new Date().toISOString();
    await pendaftaranRef.update({
      [`atestasi.${modulId}.gameId`]: gameId,
      [`atestasi.${modulId}.hp`]: Math.max(hpTersimpan, hp),
      [`atestasi.${modulId}.score`]: Math.max(scoreTersimpan, score),
      [`atestasi.${modulId}.watchCreditSec`]: Math.max(watchCreditSecTersimpan, watchCreditSec),
      [`atestasi.${modulId}.currentTimeSec`]: currentTimeSec,
      [`atestasi.${modulId}.durationSec`]: durationSec,
      [`atestasi.${modulId}.chapterIndex`]: chapterIndex,
      [`atestasi.${modulId}.nicknameCcl`]: nickname || nicknameTersimpan,
      [`atestasi.${modulId}.laporTerakhirPada`]: now,
      [`atestasi.${modulId}.gameBerubah`]: gameBerubah,
      [`atestasi.${modulId}.detikTersaksikan`]: detikTersaksikanBaru,
      [`atestasi.${modulId}.detikTersaksikanSesiTerakhir`]: detikTersaksikanMasuk,
      [`atestasi.${modulId}.adaPemangkasan`]: adaPemangkasan,
      [`atestasi.${modulId}.detikDipangkas`]: detikDipangkasBaru,
    });

    // Angka-angkanya disertakan di respons (bukan cuma ok:true) supaya
    // diagnosis berikutnya — kenapa detikTersaksikan segini, kenapa
    // dipangkas — tidak perlu menebak-nebak dari log server.
    return Response.json({
      ok: true,
      gameBerubah,
      detikTersaksikan: detikTersaksikanBaru,
      pertambahan,
      berlaluSec,
      adaPemangkasan,
      detikDipangkasKaliIni,
    });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof AtestasiLaporRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
