import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { AttemptRouteError } from "@/lib/api/attempt-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { JawabanAttempt, SubmitAttemptResponse } from "@/types/attempt";

function isJawabanArray(value: unknown): value is JawabanAttempt[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).soalId === "string" &&
        typeof (item as Record<string, unknown>).opsiId === "string"
    )
  );
}

/**
 * Menilai attempt dan mengunci hasilnya. PERIKSA WAKTU DI SERVER — penghitung
 * mundur di browser cuma tampilan, bukan sumber kebenaran. Kunci jawaban
 * hanya pernah dibaca di sini (Admin SDK, tidak lewat firestore.rules) dan
 * tidak pernah dikirim balik ke klien (KA-3).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyRequest(request);
    const { id: attemptId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AttemptRouteError(400, "Body permintaan harus JSON.");
    }
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const jawabanMasuk = isJawabanArray(parsed.jawaban) ? parsed.jawaban : null;
    if (!jawabanMasuk) {
      throw new AttemptRouteError(400, "jawaban wajib berupa array {soalId, opsiId}.");
    }

    const db = getAdminDb();
    const attemptRef = db.collection("attempt").doc(attemptId);

    const hasil = await db.runTransaction(async (tx) => {
      const attemptSnap = await tx.get(attemptRef);
      if (!attemptSnap.exists) {
        throw new AttemptRouteError(404, "Attempt tidak ditemukan.");
      }
      const attemptData = attemptSnap.data() ?? {};
      if (attemptData.uid !== user.uid) {
        throw new AttemptRouteError(403, "Bukan attempt Anda.");
      }
      if (attemptData.status !== "berlangsung") {
        throw new AttemptRouteError(409, "Attempt ini sudah tidak berlangsung.");
      }

      const soalIds: string[] = Array.isArray(attemptData.soalIds) ? attemptData.soalIds : [];
      const soalIdSet = new Set(soalIds);

      const kunciRefs = soalIds.map((soalId) => db.collection("kunci_soal").doc(soalId));
      const kunciSnaps = kunciRefs.length > 0 ? await tx.getAll(...kunciRefs) : [];
      const kunciMap = new Map<string, string>();
      kunciSnaps.forEach((snap, index) => {
        const data = snap.exists ? snap.data() : undefined;
        const opsiBenarId = data && typeof data.opsiBenarId === "string" ? data.opsiBenarId : null;
        if (opsiBenarId) {
          kunciMap.set(soalIds[index], opsiBenarId);
        }
      });

      const kegiatanId = typeof attemptData.kegiatanId === "string" ? attemptData.kegiatanId : "";
      const modulId = typeof attemptData.modulId === "string" ? attemptData.modulId : "";
      const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${user.uid}`);
      const pendaftaranSnap = await tx.get(pendaftaranRef);
      if (!pendaftaranSnap.exists) {
        throw new AttemptRouteError(404, "Pendaftaran tidak ditemukan.");
      }
      const pendaftaranData = pendaftaranSnap.data() ?? {};

      // Ambang lulus dari snapshot modul di pendaftaran (KA-5) — bukan dari
      // modul yang bisa berubah setelah pendaftaran. Kalau entah kenapa
      // tidak ketemu, jangan longgar: anggap ambangnya 100 (nyaris mustahil
      // lulus) alih-alih meloloskan begitu saja.
      const modulSnapshot = Array.isArray(pendaftaranData.modulSnapshot)
        ? pendaftaranData.modulSnapshot
        : [];
      const modulEntry = modulSnapshot.find(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && (item as Record<string, unknown>).modulId === modulId
      );
      const ambangLulus =
        modulEntry && typeof modulEntry.nilaiMinimum === "number" ? modulEntry.nilaiMinimum : 100;

      // Hanya jawaban yang soalId-nya memang bagian dari attempt ini yang
      // dihitung, dan hanya satu jawaban terakhir per soal yang dipakai.
      const jawabanPerSoal = new Map<string, string>();
      for (const item of jawabanMasuk) {
        if (soalIdSet.has(item.soalId)) {
          jawabanPerSoal.set(item.soalId, item.opsiId);
        }
      }
      const jawabanBersih: JawabanAttempt[] = Array.from(jawabanPerSoal.entries()).map(
        ([soalId, opsiId]) => ({ soalId, opsiId })
      );

      let benar = 0;
      for (const [soalId, opsiId] of jawabanPerSoal) {
        if (kunciMap.get(soalId) === opsiId) {
          benar += 1;
        }
      }
      const total = soalIds.length;
      const skor = total > 0 ? Math.round((benar / total) * 100) : 0;
      const lulus = skor >= ambangLulus;

      const now = new Date();
      const kadaluarsaPada =
        typeof attemptData.kadaluarsaPada === "string" ? new Date(attemptData.kadaluarsaPada) : null;
      const sudahKadaluarsa = kadaluarsaPada !== null && now > kadaluarsaPada;

      tx.update(attemptRef, {
        status: sudahKadaluarsa ? "kadaluarsa" : "selesai",
        selesaiPada: now.toISOString(),
        jawaban: jawabanBersih,
        benar,
        total,
        skor,
        lulus,
      });

      const hasilModul =
        typeof pendaftaranData.hasilModul === "object" && pendaftaranData.hasilModul !== null
          ? (pendaftaranData.hasilModul as Record<string, unknown>)
          : {};
      const hasilSebelumnya =
        typeof hasilModul[modulId] === "object" && hasilModul[modulId] !== null
          ? (hasilModul[modulId] as Record<string, unknown>)
          : null;
      const skorTertinggiSebelumnya =
        hasilSebelumnya && typeof hasilSebelumnya.skorTertinggi === "number"
          ? hasilSebelumnya.skorTertinggi
          : 0;
      const skorTertinggi = Math.max(skorTertinggiSebelumnya, skor);
      const percobaan = typeof attemptData.attemptKe === "number" ? attemptData.attemptKe : 1;

      tx.set(
        pendaftaranRef,
        {
          hasilModul: {
            [modulId]: {
              skorTertinggi,
              lulus: skorTertinggi >= ambangLulus,
              percobaan,
            },
          },
        },
        { merge: true }
      );

      const response: SubmitAttemptResponse = { skor, benar, total, lulus };
      return response;
    });

    return Response.json(hasil);
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof AttemptRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
