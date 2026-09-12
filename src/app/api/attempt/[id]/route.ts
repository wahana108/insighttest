import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { AttemptRouteError, muatSoalUntukAttempt } from "@/lib/api/attempt-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AttemptDetailResponse, JawabanAttempt, StatusAttempt } from "@/types/attempt";

function isStatusAttempt(value: unknown): value is StatusAttempt {
  return value === "berlangsung" || value === "selesai" || value === "kadaluarsa";
}

/**
 * Untuk halaman pengerjaan yang dimuat ulang — mengembalikan attempt milik
 * pengguna beserta soalnya, tanpa kunci jawaban (KA-3).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyRequest(request);
    const { id: attemptId } = await params;

    const db = getAdminDb();
    const attemptSnap = await db.collection("attempt").doc(attemptId).get();
    if (!attemptSnap.exists) {
      throw new AttemptRouteError(404, "Attempt tidak ditemukan.");
    }
    const data = attemptSnap.data() ?? {};
    if (data.uid !== user.uid) {
      throw new AttemptRouteError(403, "Bukan attempt Anda.");
    }

    const soalIds: string[] = Array.isArray(data.soalIds) ? data.soalIds : [];
    const soal = await muatSoalUntukAttempt(db, soalIds);
    const jawaban: JawabanAttempt[] = Array.isArray(data.jawaban)
      ? data.jawaban.filter(
          (item): item is JawabanAttempt =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as Record<string, unknown>).soalId === "string" &&
            typeof (item as Record<string, unknown>).opsiId === "string"
        )
      : [];

    const response: AttemptDetailResponse = {
      attemptId: attemptSnap.id,
      status: isStatusAttempt(data.status) ? data.status : "berlangsung",
      kadaluarsaPada: typeof data.kadaluarsaPada === "string" ? data.kadaluarsaPada : null,
      soal,
      jawaban,
      skor: typeof data.skor === "number" ? data.skor : null,
      benar: typeof data.benar === "number" ? data.benar : null,
      total: typeof data.total === "number" ? data.total : null,
      lulus: typeof data.lulus === "boolean" ? data.lulus : null,
      kedaluwarsa: typeof data.kedaluwarsa === "boolean" ? data.kedaluwarsa : false,
    };
    return Response.json(response);
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof AttemptRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
