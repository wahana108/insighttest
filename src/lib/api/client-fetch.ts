import { auth } from "@/lib/firebase/client";

export class ClientFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientFetchError";
  }
}

/**
 * fetch() yang otomatis menyertakan header Authorization: Bearer <idToken>
 * dari pengguna yang sedang masuk. Route Handler di server memverifikasi
 * token itu lewat verifyRequest() (src/lib/api/auth-server.ts).
 */
export async function fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new ClientFetchError("Belum masuk — tidak ada pengguna aktif untuk diautentikasi.");
  }

  const idToken = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${idToken}`);

  return fetch(input, { ...init, headers });
}
