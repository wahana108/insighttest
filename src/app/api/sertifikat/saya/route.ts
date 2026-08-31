import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { SertifikatRingkas, StatusSertifikat } from "@/types/sertifikat";

function isStatusSertifikat(value: unknown): value is StatusSertifikat {
  return value === "berlaku" || value === "dicabut";
}

export async function GET(request: Request) {
  try {
    const user = await verifyRequest(request);

    const snapshot = await getAdminDb()
      .collection("sertifikat")
      .where("uid", "==", user.uid)
      .get();

    const items: SertifikatRingkas[] = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        kegiatanId: typeof data.kegiatanId === "string" ? data.kegiatanId : "",
        serial: typeof data.serial === "string" ? data.serial : "",
        kodeVerifikasi: typeof data.kodeVerifikasi === "string" ? data.kodeVerifikasi : "",
        judulKegiatan: typeof data.judulKegiatan === "string" ? data.judulKegiatan : "",
        nilaiAkhir: typeof data.nilaiAkhir === "number" ? data.nilaiAkhir : 0,
        status: isStatusSertifikat(data.status) ? data.status : "berlaku",
        terbitPada: typeof data.terbitPada === "string" ? data.terbitPada : "",
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
