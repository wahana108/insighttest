import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { bacaLookupImporHadir } from "@/lib/api/impor-hadir-server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { mapFormulirPeserta } from "@/lib/formulir-peserta";
import {
  kolomTambahanUntukFormulir,
  sepertiPemisahSpasi,
  tandaiBarisImpor,
  uraiDaftarHadir,
  MAKS_BARIS_IMPOR_HADIR,
} from "@/lib/services/impor-hadir";

class ImporPratinjauRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ImporPratinjauRouteError";
    this.status = status;
  }
}

/**
 * POST /api/admin/kegiatan/[kegiatanId]/impor-hadir/pratinjau — Slice 6.2.
 * HANYA admin/superadmin — panitia TIDAK BOLEH, sekalipun punya
 * suntingKegiatan untuk kegiatan ini. Membuat akun atas nama orang lain
 * adalah kuasa yang lebih besar daripada menyunting kegiatan, dan tidak
 * pernah diberikan ke panitia. Ditegakkan DI SINI (403), bukan cuma
 * disembunyikan di menu — sama untuk POST .../impor-hadir (eksekusi).
 *
 * Tidak menulis apa pun — murni membaca (Auth + Firestore) lalu memanggil
 * tandaiBarisImpor(). Eksekusi (route sebilah, tanpa /pratinjau) memanggil
 * ULANG bacaLookupImporHadir()+tandaiBarisImpor() dengan data LIVE saat
 * itu — tidak pernah memercayai hasil pratinjau ini sebagai kebenaran
 * yang masih berlaku saat eksekusi terjadi (bisa basi).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kegiatanId: string }> }
) {
  try {
    const user = await verifyRequest(request);
    if (user.role !== "admin" && user.role !== "superadmin") {
      throw new ImporPratinjauRouteError(
        403,
        "Hanya admin/superadmin yang boleh mengimpor daftar hadir."
      );
    }

    const { kegiatanId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ImporPratinjauRouteError(400, "Body permintaan harus JSON.");
    }
    const teks =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>).teks : undefined;
    if (typeof teks !== "string") {
      throw new ImporPratinjauRouteError(400, "teks (tempelan) wajib diisi.");
    }

    const db = getAdminDb();
    const kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();
    if (!kegiatanSnap.exists) {
      throw new ImporPratinjauRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const formulirPeserta = mapFormulirPeserta(kegiatanSnap.data()?.formulirPeserta);
    const kolomTambahan = kolomTambahanUntukFormulir(formulirPeserta);

    const barisMentah = uraiDaftarHadir(teks, kolomTambahan);
    if (barisMentah.length === 0) {
      throw new ImporPratinjauRouteError(400, "Tempelan tidak berisi satu baris data pun.");
    }
    if (barisMentah.length > MAKS_BARIS_IMPOR_HADIR) {
      throw new ImporPratinjauRouteError(
        400,
        `Tempelan berisi ${barisMentah.length} baris, melebihi batas ${MAKS_BARIS_IMPOR_HADIR} per impor. Pecah tempelan jadi beberapa bagian.`
      );
    }

    const emailUnik = Array.from(
      new Set(barisMentah.map((baris) => baris.email.trim().toLowerCase()).filter(Boolean))
    );
    const { profilByEmail, uidSudahTerdaftar } = await bacaLookupImporHadir(
      getAdminAuth(),
      db,
      kegiatanId,
      emailUnik
    );

    const hasil = tandaiBarisImpor(barisMentah, formulirPeserta, profilByEmail, uidSudahTerdaftar);

    return Response.json({
      ok: true,
      kolomTambahan,
      baris: hasil,
      batasBaris: MAKS_BARIS_IMPOR_HADIR,
      // Slice 6.2a (CACAT 2c) — peringatan, bukan penolakan.
      pemisahMungkinSalah: sepertiPemisahSpasi(barisMentah),
    });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof ImporPratinjauRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
