import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { PendaftaranRingkas, StatusPendaftaran } from "@/types/pendaftaran";

function isStatusPendaftaran(value: unknown): value is StatusPendaftaran {
  return value === "terdaftar";
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
