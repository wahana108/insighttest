import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";

/**
 * Alat uji fondasi Route Handler — bukan endpoint fungsional. Membuktikan
 * bahwa server bisa memverifikasi ID token klien dan membaca profil lewat
 * Admin SDK.
 */
export async function GET(request: Request) {
  try {
    const user = await verifyRequest(request);
    return Response.json(user);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
