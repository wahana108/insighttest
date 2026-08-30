import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface ProfilPesertaInput {
  namaLengkap: string;
  institusi: string;
  nomorIdentitas: string;
  noTelepon: string;
}

/**
 * Update administratif atas dokumen users/{uid} yang SUDAH ADA, dijalankan
 * oleh pemiliknya sendiri — firestore.rules membatasi field yang boleh
 * disentuh (displayName, photoURL, namaLengkap, institusi, nomorIdentitas,
 * noTelepon), tidak pernah role/status (KA-7).
 */
export async function updateProfilPeserta(
  uid: string,
  input: ProfilPesertaInput
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    namaLengkap: input.namaLengkap.trim(),
    institusi: input.institusi.trim(),
    nomorIdentitas: input.nomorIdentitas.trim(),
    noTelepon: input.noTelepon.trim(),
    updatedAt: new Date().toISOString(),
  });
}
