import { ApiAuthError, verifyRequest } from "@/lib/api/auth-server";
import { bacaLookupImporHadir, buatAkunDanProfilImpor } from "@/lib/api/impor-hadir-server";
import { buatModulSnapshot } from "@/lib/api/pendaftaran-server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { mapFormulirPeserta } from "@/lib/formulir-peserta";
import {
  gabungkanIdentitas,
  tandaiBarisImpor,
  type BarisMentahImpor,
} from "@/lib/services/impor-hadir";

class ImporEksekusiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ImporEksekusiRouteError";
    this.status = status;
  }
}

type HasilBarisRow =
  | { baris: number; email: string; hasil: "berhasil"; akunBaru: boolean; uid: string; nomorUrut: number }
  | { baris: number; email: string; hasil: "dilewati"; pesan: string }
  | { baris: number; email: string; hasil: "gagal"; pesan: string };

function isBarisMentahArray(value: unknown): value is BarisMentahImpor[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).email === "string" &&
        typeof (item as Record<string, unknown>).namaLengkap === "string"
    )
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pesanGalat(err: unknown): string {
  return err instanceof Error ? err.message : "Galat tidak diketahui.";
}

/**
 * POST /api/admin/kegiatan/[kegiatanId]/impor-hadir — Slice 6.2, EKSEKUSI
 * (bukan pratinjau). Menerima SATU POTONGAN baris (klien memecah sendiri,
 * lihat halaman /admin/kegiatan/[id]/peserta/impor — pola yang sama dengan
 * handleTerbitkanTerpilih() di halaman peserta) supaya tidak melampaui
 * batas laju pembuatan akun Firebase Auth maupun batas writeBatch.
 *
 * TIDAK PERNAH memercayai status dari pratinjau sebelumnya — bacaLookupImporHadir()
 * dan tandaiBarisImpor() dipanggil ULANG di sini dengan data LIVE, supaya
 * baris yang sudah terdaftar (mis. dari potongan sebelumnya dalam impor
 * yang sama, atau proses lain) tidak diproses dua kali (BAGIAN d: IDEMPOTEN).
 *
 * Hanya admin/superadmin — sama seperti .../pratinjau.
 *
 * Kegiatan TIDAK digerbangi isPublished/isArchived/jendela waktu di sini —
 * beda dari POST /api/pendaftaran (mandiri). Admin yang mengimpor sering
 * melakukannya SETELAH webinar selesai (jendela pendaftaran mandiri sudah
 * lewat, atau kegiatan sudah diarsipkan) — menggerbangi impor dengan
 * aturan yang dirancang untuk pendaftaran MANDIRI akan salah arah.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kegiatanId: string }> }
) {
  try {
    const user = await verifyRequest(request);
    if (user.role !== "admin" && user.role !== "superadmin") {
      throw new ImporEksekusiRouteError(
        403,
        "Hanya admin/superadmin yang boleh mengimpor daftar hadir."
      );
    }

    const { kegiatanId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ImporEksekusiRouteError(400, "Body permintaan harus JSON.");
    }
    const barisInput =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>).baris : undefined;
    if (!isBarisMentahArray(barisInput) || barisInput.length === 0) {
      throw new ImporEksekusiRouteError(400, "baris (daftar baris untuk dieksekusi) wajib diisi.");
    }

    const db = getAdminDb();
    const auth = getAdminAuth();
    const kegiatanRef = db.collection("kegiatan").doc(kegiatanId);
    const kegiatanSnap = await kegiatanRef.get();
    if (!kegiatanSnap.exists) {
      throw new ImporEksekusiRouteError(404, "Kegiatan tidak ditemukan.");
    }
    const formulirPeserta = mapFormulirPeserta(kegiatanSnap.data()?.formulirPeserta);

    const emailUnik = Array.from(
      new Set(barisInput.map((baris) => baris.email.trim().toLowerCase()).filter(Boolean))
    );
    const { profilByEmail, uidSudahTerdaftar } = await bacaLookupImporHadir(
      auth,
      db,
      kegiatanId,
      emailUnik
    );
    const hasilTanda = tandaiBarisImpor(barisInput, formulirPeserta, profilByEmail, uidSudahTerdaftar);

    const hasilAkhir: HasilBarisRow[] = [];

    for (const baris of hasilTanda) {
      if (!baris.akanDieksekusi) {
        hasilAkhir.push({
          baris: baris.baris,
          email: baris.email,
          hasil: "dilewati",
          pesan: baris.pesan.join(" ") || "Baris ini tidak memenuhi syarat untuk dieksekusi.",
        });
        continue;
      }

      try {
        const emailNormal = baris.email.trim().toLowerCase();
        let uid: string;
        let akunBaru: boolean;
        const profilLama = baris.uidSudahAda ? profilByEmail.get(emailNormal) ?? null : null;

        if (baris.uidSudahAda) {
          uid = baris.uidSudahAda;
          akunBaru = false;
        } else {
          const identitasBaru = gabungkanIdentitas(baris, null);
          const hasilAkun = await buatAkunDanProfilImpor(auth, db, {
            email: emailNormal,
            namaLengkap: baris.namaLengkap.trim(),
            ...identitasBaru,
          });
          uid = hasilAkun.userRecord.uid;
          // akunBaru bisa false di sini kalau ternyata ada race (lihat
          // komentar buatAkunDanProfilImpor) — jangan berasumsi selalu true.
          akunBaru = hasilAkun.akunBaru;
          // Batas laju pembuatan akun Firebase Auth (BAGIAN f) — jeda kecil
          // hanya setelah benar-benar membuat akun baru, tidak untuk akun
          // yang sudah ada (tidak ada panggilan createUser di jalur itu).
          if (akunBaru) {
            await sleep(150);
          }
        }

        const identitas = gabungkanIdentitas(baris, profilLama);
        const pendaftaranRef = db.collection("pendaftaran").doc(`${kegiatanId}_${uid}`);

        const hasilTransaksi = await db.runTransaction(
          async (tx): Promise<{ dibuat: false } | { dibuat: true; nomorUrut: number }> => {
            const [kegiatanSnapTx, pendaftaranSnapTx] = await Promise.all([
              tx.get(kegiatanRef),
              tx.get(pendaftaranRef),
            ]);
            if (!kegiatanSnapTx.exists) {
              throw new Error("Kegiatan tidak ditemukan.");
            }
            // BAGIAN d — IDEMPOTEN: diperiksa ULANG di dalam transaksi
            // (bukan hanya lewat uidSudahTerdaftar di atas, yang dibaca
            // SEBELUM transaksi ini dan bisa basi kalau baris lain di
            // potongan yang sama mendaftarkan uid yang sama, atau proses
            // impor lain berjalan bersamaan) — menjalankan impor yang sama
            // dua kali TIDAK BOLEH membuat pendaftaran ganda.
            if (pendaftaranSnapTx.exists) {
              return { dibuat: false };
            }

            const modulSnapshot = await buatModulSnapshot(kegiatanRef, tx);
            const kegiatanDataTx = kegiatanSnapTx.data() ?? {};
            const nomorUrutTerakhir =
              typeof kegiatanDataTx.nomorUrutTerakhir === "number"
                ? kegiatanDataTx.nomorUrutTerakhir
                : 0;
            const nomorUrut = nomorUrutTerakhir + 1;
            const now = new Date().toISOString();

            tx.update(kegiatanRef, { nomorUrutTerakhir: nomorUrut });
            tx.set(pendaftaranRef, {
              kegiatanId,
              uid,
              email: emailNormal,
              namaLengkap: baris.namaLengkap.trim(),
              institusi: identitas.institusi,
              nomorIdentitas: identitas.nomorIdentitas,
              noTelepon: identitas.noTelepon,
              nomorUrut,
              modulSnapshot,
              status: "terdaftar",
              daftarPada: now,
              hasilModul: {},
              referensiDibuka: [],
              atestasi: {},
              // Slice 6.2 — jejak asal (BAGIAN e).
              sumber: "impor",
              diimporOleh: user.uid,
              diimporPada: now,
            });
            return { dibuat: true, nomorUrut };
          }
        );

        if (!hasilTransaksi.dibuat) {
          hasilAkhir.push({
            baris: baris.baris,
            email: baris.email,
            hasil: "dilewati",
            pesan: "Sudah terdaftar di kegiatan ini — dilewati.",
          });
        } else {
          hasilAkhir.push({
            baris: baris.baris,
            email: baris.email,
            hasil: "berhasil",
            akunBaru,
            uid,
            nomorUrut: hasilTransaksi.nomorUrut,
          });
        }
      } catch (err) {
        hasilAkhir.push({
          baris: baris.baris,
          email: baris.email,
          hasil: "gagal",
          pesan: pesanGalat(err),
        });
      }
    }

    // TIDAK PERNAH melaporkan "berhasil" secara global kalau ada yang
    // gagal (BAGIAN g) — respons hanya daftar per baris; klien yang
    // merangkumnya dan menampilkan apa adanya, tidak menyembunyikan galat
    // di balik ringkasan optimis.
    return Response.json({ hasil: hasilAkhir });
  } catch (err) {
    if (err instanceof ApiAuthError || err instanceof ImporEksekusiRouteError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Galat internal." }, { status: 500 });
  }
}
