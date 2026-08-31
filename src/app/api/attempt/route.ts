import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { acakUrutan, AttemptRouteError, muatSoalUntukAttempt } from "@/lib/api/attempt-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { MulaiAttemptResponse } from "@/types/attempt";

/**
 * Mulai (atau lanjutkan) attempt untuk satu modul evaluasi. Semua
 * pemeriksaan kelayakan dan pemilihan soal terjadi di sini, di server —
 * klien hanya mengirim kegiatanId + modulId. Berkas ini TIDAK PERNAH
 * menyentuh koleksi kunci_soal (KA-3) — hanya 'soal' lewat
 * muatSoalUntukAttempt().
 */
export async function POST(request: Request) {
  try {
    const user = await verifyRequest(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AttemptRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const kegiatanId = typeof parsed.kegiatanId === "string" ? parsed.kegiatanId : "";
    const modulId = typeof parsed.modulId === "string" ? parsed.modulId : "";
    if (!kegiatanId || !modulId) {
      throw new AttemptRouteError(400, "kegiatanId dan modulId wajib diisi.");
    }

    const db = getAdminDb();
    const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
    const modulRef = kegiatanRef.collection("modul").doc(modulId);
    const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${user.uid}`);

    const [kegiatanSnap, modulSnap, pendaftaranSnap] = await Promise.all([
      kegiatanRef.get(),
      modulRef.get(),
      pendaftaranRef.get(),
    ]);

    if (!kegiatanSnap.exists) {
      throw new AttemptRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const kegiatanData = kegiatanSnap.data() ?? {};
    if (kegiatanData.isPublished !== true || kegiatanData.isArchived === true) {
      throw new AttemptRouteError(400, "Kegiatan ini tidak tersedia.");
    }

    const now = new Date();
    const dibukaPada =
      typeof kegiatanData.dibukaPada === "string" ? new Date(kegiatanData.dibukaPada) : null;
    const ditutupPada =
      typeof kegiatanData.ditutupPada === "string" ? new Date(kegiatanData.ditutupPada) : null;
    if (dibukaPada && now < dibukaPada) {
      throw new AttemptRouteError(400, "Kegiatan ini belum dibuka.");
    }
    if (ditutupPada && now > ditutupPada) {
      throw new AttemptRouteError(400, "Kegiatan ini sudah ditutup.");
    }

    if (!pendaftaranSnap.exists) {
      throw new AttemptRouteError(403, "Anda belum terdaftar di kegiatan ini.");
    }

    if (!modulSnap.exists) {
      throw new AttemptRouteError(404, "Modul tidak ditemukan.");
    }
    const modulData = modulSnap.data() ?? {};
    if (modulData.kategori !== "evaluasi") {
      throw new AttemptRouteError(400, "Modul ini bukan modul evaluasi.");
    }
    const evaluasi =
      typeof modulData.evaluasi === "object" && modulData.evaluasi !== null
        ? (modulData.evaluasi as Record<string, unknown>)
        : null;
    if (!evaluasi) {
      throw new AttemptRouteError(400, "Modul ini belum punya konfigurasi evaluasi.");
    }
    const maksPercobaan =
      typeof evaluasi.maksPercobaan === "number" && evaluasi.maksPercobaan > 0
        ? evaluasi.maksPercobaan
        : 1;

    const attemptSnap = await db
      .collection("attempt")
      .where("uid", "==", user.uid)
      .where("kegiatanId", "==", kegiatanId)
      .where("modulId", "==", modulId)
      .get();

    let attemptBerlangsungAktif: QueryDocumentSnapshot | null = null;
    const penyelesaianOtomatis: Promise<unknown>[] = [];
    let jumlahTerpakai = 0;

    for (const doc of attemptSnap.docs) {
      const data = doc.data();
      if (data.status === "berlangsung") {
        const kadaluarsaAttempt =
          typeof data.kadaluarsaPada === "string" ? new Date(data.kadaluarsaPada) : null;
        if (kadaluarsaAttempt && now > kadaluarsaAttempt) {
          // Kadaluarsa tapi tidak pernah disubmit — selesaikan sekarang
          // dengan nilai apa adanya (tidak ada jawaban yang masuk), supaya
          // tidak menggantung selamanya berstatus 'berlangsung' dan supaya
          // ikut terhitung sebagai percobaan yang terpakai.
          const totalSoal = Array.isArray(data.soalIds) ? data.soalIds.length : 0;
          penyelesaianOtomatis.push(
            doc.ref.update({
              status: "kadaluarsa",
              selesaiPada: kadaluarsaAttempt.toISOString(),
              jawaban: [],
              benar: 0,
              total: totalSoal,
              skor: 0,
              lulus: false,
            })
          );
          jumlahTerpakai += 1;
        } else {
          attemptBerlangsungAktif = doc;
        }
      } else {
        jumlahTerpakai += 1;
      }
    }
    if (penyelesaianOtomatis.length > 0) {
      await Promise.all(penyelesaianOtomatis);
    }

    if (attemptBerlangsungAktif) {
      const data = attemptBerlangsungAktif.data();
      const soalIds: string[] = Array.isArray(data.soalIds) ? data.soalIds : [];
      const soal = await muatSoalUntukAttempt(db, soalIds);
      const response: MulaiAttemptResponse = {
        attemptId: attemptBerlangsungAktif.id,
        kadaluarsaPada: typeof data.kadaluarsaPada === "string" ? data.kadaluarsaPada : null,
        soal,
      };
      return Response.json(response);
    }

    if (jumlahTerpakai >= maksPercobaan) {
      throw new AttemptRouteError(
        400,
        `Anda sudah mencapai batas ${maksPercobaan} percobaan untuk modul ini.`
      );
    }

    const pemilihanSoal =
      typeof evaluasi.pemilihanSoal === "object" && evaluasi.pemilihanSoal !== null
        ? (evaluasi.pemilihanSoal as Record<string, unknown>)
        : null;
    if (!pemilihanSoal) {
      throw new AttemptRouteError(400, "Modul ini belum punya konfigurasi pemilihan soal.");
    }

    let soalIds: string[];
    if (pemilihanSoal.mode === "acak") {
      const topikKode = typeof pemilihanSoal.topikKode === "string" ? pemilihanSoal.topikKode : "";
      const jumlah = typeof pemilihanSoal.jumlah === "number" ? pemilihanSoal.jumlah : 0;
      if (!topikKode || jumlah < 1) {
        throw new AttemptRouteError(400, "Konfigurasi pemilihan soal acak tidak valid.");
      }
      const soalTopikSnap = await db
        .collection("soal")
        .where("topikKode", "==", topikKode)
        .where("isActive", "==", true)
        .get();
      const semuaId = soalTopikSnap.docs.map((item) => item.id);
      if (semuaId.length < jumlah) {
        throw new AttemptRouteError(
          400,
          "Soal aktif di topik ini tidak lagi mencukupi jumlah yang dikonfigurasi modul."
        );
      }
      soalIds = acakUrutan(semuaId).slice(0, jumlah);
    } else {
      soalIds = Array.isArray(pemilihanSoal.soalIds)
        ? pemilihanSoal.soalIds.filter((item): item is string => typeof item === "string")
        : [];
      if (soalIds.length === 0) {
        throw new AttemptRouteError(400, "Modul ini belum punya soal.");
      }
    }

    if (evaluasi.acakUrutanSoal === true) {
      soalIds = acakUrutan(soalIds);
    }

    const batasWaktuMenit =
      typeof evaluasi.batasWaktuMenit === "number" && evaluasi.batasWaktuMenit > 0
        ? evaluasi.batasWaktuMenit
        : null;
    const kadaluarsaPada = batasWaktuMenit
      ? new Date(now.getTime() + batasWaktuMenit * 60000).toISOString()
      : null;

    const attemptRef = db.collection("attempt").doc();
    await attemptRef.set({
      kegiatanId,
      modulId,
      uid: user.uid,
      attemptKe: jumlahTerpakai + 1,
      status: "berlangsung",
      mulaiPada: now.toISOString(),
      kadaluarsaPada,
      selesaiPada: null,
      soalIds,
      jawaban: [],
      skor: null,
      benar: null,
      total: null,
      lulus: null,
    });

    const soal = await muatSoalUntukAttempt(db, soalIds);
    const response: MulaiAttemptResponse = { attemptId: attemptRef.id, kadaluarsaPada, soal };
    return Response.json(response);
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof AttemptRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
