import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { UserRole, UserStatus } from "@/types/user";

export class ApiAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}

export interface VerifiedUser {
  uid: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  namaLengkap: string;
  institusi: string;
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "superadmin" || value === "admin" || value === "panitia" || value === "peserta"
  );
}

function isUserStatus(value: unknown): value is UserStatus {
  return value === "pending" || value === "aktif" || value === "nonaktif";
}

/**
 * Baca header Authorization: Bearer <idToken>, verifikasi lewat Admin SDK,
 * lalu ambil profil dari users/{uid}. 401 kalau token tidak ada/tidak sah,
 * 403 kalau profil tidak ditemukan atau statusnya bukan 'aktif'.
 */
export async function verifyRequest(req: Request): Promise<VerifiedUser> {
  const header = req.headers.get("authorization");
  const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    throw new ApiAuthError(401, "Header Authorization: Bearer <idToken> wajib disertakan.");
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token);
  } catch {
    throw new ApiAuthError(401, "Token tidak sah atau kedaluwarsa.");
  }

  const snapshot = await getAdminDb().collection("users").doc(decoded.uid).get();
  if (!snapshot.exists) {
    throw new ApiAuthError(403, "Profil pengguna tidak ditemukan.");
  }

  const data = snapshot.data() ?? {};
  const status = isUserStatus(data.status) ? data.status : "nonaktif";
  if (status !== "aktif") {
    throw new ApiAuthError(403, "Akun tidak aktif.");
  }

  return {
    uid: decoded.uid,
    email: typeof data.email === "string" ? data.email : (decoded.email ?? ""),
    role: isUserRole(data.role) ? data.role : "peserta",
    status,
    namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
    institusi: typeof data.institusi === "string" ? data.institusi : "",
  };
}
