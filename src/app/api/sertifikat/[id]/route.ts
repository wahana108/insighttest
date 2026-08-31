import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { SertifikatRouteError } from "@/lib/api/sertifikat-server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { ItemSertifikat, SertifikatDetail, StatusSertifikat } from "@/types/sertifikat";

function isStatusSertifikat(value: unknown): value is StatusSertifikat {
  return value === "berlaku" || value === "dicabut";
}

function mapItems(value: unknown): ItemSertifikat[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      modulId: typeof item.modulId === "string" ? item.modulId : "",
      judul: typeof item.judul === "string" ? item.judul : "",
      skor: typeof item.skor === "number" ? item.skor : 0,
      lulus: typeof item.lulus === "boolean" ? item.lulus : false,
    }));
}

/**
 * Untuk halaman /sertifikat/[id] (berlogin) — hanya pemilik atau admin.
 * Menggabungkan snapshot sertifikat (KA-6, dibekukan) dengan template
 * sertifikat LIVE dari dokumen kegiatan saat ini.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyRequest(request);
    const { id } = await params;

    const db = getAdminDb();
    const snap = await db.collection("sertifikat").doc(id).get();
    if (!snap.exists) {
      throw new SertifikatRouteError(404, "Sertifikat tidak ditemukan.");
    }
    const data = snap.data() ?? {};

    const isOwner = data.uid === user.uid;
    const isAdminRole = user.role === "admin" || user.role === "superadmin";
    if (!isOwner && !isAdminRole) {
      throw new SertifikatRouteError(403, "Anda tidak berhak membuka sertifikat ini.");
    }

    const kegiatanId = typeof data.kegiatanId === "string" ? data.kegiatanId : "";
    const kegiatanSnap = kegiatanId ? await db.collection("kegiatan").doc(kegiatanId).get() : null;
    const kegiatanData = kegiatanSnap?.exists ? (kegiatanSnap.data() ?? {}) : {};
    const templateRaw =
      typeof kegiatanData.templateSertifikat === "object" && kegiatanData.templateSertifikat !== null
        ? (kegiatanData.templateSertifikat as Record<string, unknown>)
        : {};

    const response: SertifikatDetail = {
      id: snap.id,
      kegiatanId,
      serial: typeof data.serial === "string" ? data.serial : "",
      kodeVerifikasi: typeof data.kodeVerifikasi === "string" ? data.kodeVerifikasi : "",
      namaLengkap: typeof data.namaLengkap === "string" ? data.namaLengkap : "",
      judulKegiatan: typeof data.judulKegiatan === "string" ? data.judulKegiatan : "",
      nilaiAkhir: typeof data.nilaiAkhir === "number" ? data.nilaiAkhir : 0,
      items: mapItems(data.items),
      status: isStatusSertifikat(data.status) ? data.status : "berlaku",
      terbitPada: typeof data.terbitPada === "string" ? data.terbitPada : "",
      template: {
        logoUrl: typeof templateRaw.logoUrl === "string" ? templateRaw.logoUrl : "",
        kopUrl: typeof templateRaw.kopUrl === "string" ? templateRaw.kopUrl : "",
        penandatanganNama:
          typeof templateRaw.penandatanganNama === "string" ? templateRaw.penandatanganNama : "",
        penandatanganJabatan:
          typeof templateRaw.penandatanganJabatan === "string"
            ? templateRaw.penandatanganJabatan
            : "",
        tandaTanganUrl:
          typeof templateRaw.tandaTanganUrl === "string" ? templateRaw.tandaTanganUrl : "",
        teksTambahan: typeof templateRaw.teksTambahan === "string" ? templateRaw.teksTambahan : "",
      },
    };

    return Response.json(response);
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof SertifikatRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
