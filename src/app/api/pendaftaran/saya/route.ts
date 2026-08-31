import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { HasilModul, PendaftaranRingkas, StatusPendaftaran } from "@/types/pendaftaran";

function isStatusPendaftaran(value: unknown): value is StatusPendaftaran {
  return value === "terdaftar";
}

function mapHasilModul(value: unknown): Record<string, HasilModul> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const hasil: Record<string, HasilModul> = {};
  for (const [modulId, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const data = entry as Record<string, unknown>;
    hasil[modulId] = {
      skorTertinggi: typeof data.skorTertinggi === "number" ? data.skorTertinggi : 0,
      lulus: typeof data.lulus === "boolean" ? data.lulus : false,
      percobaan: typeof data.percobaan === "number" ? data.percobaan : 0,
    };
  }
  return hasil;
}

export async function GET(request: Request) {
  try {
    const user = await verifyRequest(request);

    const snapshot = await getAdminDb()
      .collection("pendaftaran")
      .where("uid", "==", user.uid)
      .get();

    const items: PendaftaranRingkas[] = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        kegiatanId: typeof data.kegiatanId === "string" ? data.kegiatanId : "",
        nomorUrut: typeof data.nomorUrut === "number" ? data.nomorUrut : 0,
        status: isStatusPendaftaran(data.status) ? data.status : "terdaftar",
        daftarPada: typeof data.daftarPada === "string" ? data.daftarPada : "",
        hasilModul: mapHasilModul(data.hasilModul),
      };
    });

    return Response.json({ items });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
