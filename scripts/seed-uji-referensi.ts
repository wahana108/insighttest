/**
 * Alat pengembangan — BUKAN bagian aplikasi, tidak diimpor dari src/app.
 * Membuat (atau membersihkan) tiga pendaftaran DUMMY pada satu kegiatan
 * nyata, untuk menguji gerbang wajibBukaReferensi (Slice 5.2) lewat UI
 * sungguhan — /admin/kegiatan/[id]/peserta — bukan cuma lewat fungsi murni
 * (lihat scripts/uji-kelayakan.ts untuk itu).
 *
 * modulSnapshot ketiganya dibangun dari modul SUNGGUHAN kegiatan yang
 * dirujuk (dibaca langsung dari kegiatan/{id}/modul), supaya perilakunya
 * konsisten dengan bagaimana POST /api/pendaftaran membangun snapshot.
 * Semua modul evaluasi wajib diberi skor lulus penuh — satu-satunya
 * variabel yang dibedakan antar tiga pendaftaran ini adalah referensiDibuka
 * (kosong / satu / lengkap, dihitung dari modul referensi WAJIB kegiatan).
 *
 * Dokumen yang dibuat/dihapus SELALU persis tiga ini (id deterministik) —
 * skrip ini tidak pernah menyentuh dokumen lain, termasuk kegiatan/{id}
 * sendiri (nomorUrut memakai nilai sentinel, bukan menaikkan
 * nomorUrutTerakhir kegiatan yang sungguhan dipakai pendaftaran asli).
 *
 * Jalankan:
 *   npx tsx scripts/seed-uji-referensi.ts <kegiatanId>
 *   npx tsx scripts/seed-uji-referensi.ts <kegiatanId> --bersihkan
 */
import { loadEnvConfig } from "@next/env";
import { getAdminDb } from "../src/lib/firebase/admin";
import type { AmbangKeterlibatan, KategoriModul, ModeAmbangKeterlibatan } from "../src/types/kegiatan";
import type { HasilModul, ModulSnapshotItem, Pendaftaran } from "../src/types/pendaftaran";

loadEnvConfig(process.cwd());

const PREFIX_UID = "uji-slice52";

const DUMMY: { sufiks: string; nama: string; cakupan: "kosong" | "satu" | "lengkap" }[] = [
  { sufiks: "kosong", nama: "[UJI] Referensi Kosong", cakupan: "kosong" },
  { sufiks: "satu", nama: "[UJI] Referensi Satu", cakupan: "satu" },
  { sufiks: "lengkap", nama: "[UJI] Referensi Lengkap", cakupan: "lengkap" },
];

function isKategoriModul(value: unknown): value is KategoriModul {
  return value === "referensi" || value === "atestasi" || value === "evaluasi";
}

function isModeAmbangKeterlibatan(value: unknown): value is ModeAmbangKeterlibatan {
  return value === "persen" || value === "menit";
}

function mapAmbangKeterlibatan(value: unknown): AmbangKeterlibatan | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const data = value as Record<string, unknown>;
  return isModeAmbangKeterlibatan(data.mode) && typeof data.nilai === "number"
    ? { mode: data.mode, nilai: data.nilai }
    : null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const bersihkan = args.includes("--bersihkan");
  const kegiatanId = args.find((a) => !a.startsWith("--"));

  if (!kegiatanId) {
    console.error("Penggunaan: npx tsx scripts/seed-uji-referensi.ts <kegiatanId> [--bersihkan]");
    process.exit(1);
  }

  const db = getAdminDb();
  const pendaftaranRefs = DUMMY.map((d) =>
    db.collection("pendaftaran").doc(`${kegiatanId}_${PREFIX_UID}-${d.sufiks}`)
  );

  if (bersihkan) {
    console.log(`Membersihkan ${pendaftaranRefs.length} dokumen uji pada kegiatan ${kegiatanId}...`);
    for (const ref of pendaftaranRefs) {
      const snap = await ref.get();
      if (!snap.exists) {
        console.log(`  - ${ref.id}: tidak ada, dilewati.`);
        continue;
      }
      await ref.delete();
      console.log(`  - ${ref.id}: dihapus.`);
    }
    console.log("Selesai membersihkan. Tidak ada dokumen lain yang disentuh.");
    return;
  }

  const kegiatanSnap = await db.collection("kegiatan").doc(kegiatanId).get();
  if (!kegiatanSnap.exists) {
    console.error(`Kegiatan ${kegiatanId} tidak ditemukan.`);
    process.exit(1);
  }

  const modulSnap = await db.collection("kegiatan").doc(kegiatanId).collection("modul").get();
  const modulSnapshot: ModulSnapshotItem[] = modulSnap.docs.map((doc) => {
    const data = doc.data();
    const evaluasi =
      typeof data.evaluasi === "object" && data.evaluasi !== null
        ? (data.evaluasi as Record<string, unknown>)
        : null;
    const atestasi =
      typeof data.atestasi === "object" && data.atestasi !== null
        ? (data.atestasi as Record<string, unknown>)
        : null;
    return {
      modulId: doc.id,
      judul: typeof data.judul === "string" ? data.judul : "",
      kategori: isKategoriModul(data.kategori) ? data.kategori : "evaluasi",
      wajib: typeof data.wajib === "boolean" ? data.wajib : true,
      nilaiMinimum:
        evaluasi && typeof evaluasi.nilaiMinimum === "number" ? evaluasi.nilaiMinimum : null,
      ambangKeterlibatan: atestasi ? mapAmbangKeterlibatan(atestasi.ambangKeterlibatan) : null,
      targetSkor: atestasi && typeof atestasi.targetSkor === "number" ? atestasi.targetSkor : null,
      durasiDetik:
        atestasi && typeof atestasi.durasiDetik === "number" ? atestasi.durasiDetik : null,
    };
  });

  const modulEvaluasiWajib = modulSnapshot.filter((m) => m.kategori === "evaluasi" && m.wajib);
  const modulReferensiWajib = modulSnapshot.filter((m) => m.kategori === "referensi" && m.wajib);

  if (modulReferensiWajib.length === 0) {
    console.warn(
      'PERINGATAN: kegiatan ini tidak punya modul referensi WAJIB — ketiga pendaftaran uji akan ' +
        'sama-sama "layak" apa pun isi referensiDibuka-nya, jadi tidak banyak berguna untuk menguji ' +
        "gerbang wajibBukaReferensi. Tambahkan dulu modul referensi wajib di /admin/kegiatan/[id]."
    );
  }

  // Semua modul evaluasi wajib diberi skor lulus penuh — supaya gerbang
  // "belum lulus evaluasi" tidak pernah tersandung, hanya gerbang referensi
  // yang dibedakan antar ketiga pendaftaran ini.
  const hasilModul: Record<string, HasilModul> = {};
  for (const modul of modulEvaluasiWajib) {
    hasilModul[modul.modulId] = { skorTertinggi: 100, lulus: true, percobaan: 1, kedaluwarsa: false };
  }

  const now = new Date().toISOString();

  for (const [index, d] of DUMMY.entries()) {
    const referensiDibuka =
      d.cakupan === "kosong"
        ? []
        : d.cakupan === "satu"
          ? modulReferensiWajib.slice(0, 1).map((m) => m.modulId)
          : modulReferensiWajib.map((m) => m.modulId);

    const uid = `${PREFIX_UID}-${d.sufiks}`;
    const record: Omit<Pendaftaran, "id"> = {
      kegiatanId,
      uid,
      email: `${uid}@example.invalid`,
      namaLengkap: d.nama,
      institusi: "Data uji Slice 5.2 — aman dihapus (lihat --bersihkan)",
      nomorIdentitas: "",
      noTelepon: "",
      sumber: "mandiri",
      diimporOleh: null,
      diimporPada: null,
      // Sentinel di luar rentang normal — TIDAK menaikkan
      // kegiatan/{id}.nomorUrutTerakhir yang sungguhan (itu akan menyentuh
      // dokumen lain, dilarang oleh skrip ini).
      nomorUrut: 900001 + index,
      modulSnapshot,
      status: "terdaftar",
      daftarPada: now,
      hasilModul,
      referensiDibuka,
      atestasi: {},
    };

    await db.collection("pendaftaran").doc(`${kegiatanId}_${uid}`).set(record);
    console.log(
      `Dibuat: ${kegiatanId}_${uid} — referensiDibuka: [${referensiDibuka.join(", ")}] ` +
        `(${referensiDibuka.length}/${modulReferensiWajib.length} referensi wajib)`
    );
  }

  console.log(
    `\nSelesai. Lihat /admin/kegiatan/${kegiatanId}/peserta untuk memeriksa kolom Kelayakan ` +
      "ketiga peserta [UJI] di atas. Jalankan lagi dengan --bersihkan untuk menghapusnya."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
