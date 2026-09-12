import { getAdminDb } from "@/lib/firebase/admin";
import { putuskanBatasHarian, tanggalJakarta } from "@/lib/kuota-peserta";

/**
 * GET /api/kuota-hari-ini — Slice "daftar-tanpa-sandi" (docs/kickoff.md §R,
 * SLICE 2). PUBLIK, tanpa autentikasi — /daftar butuh ini SEBELUM orang
 * punya akun untuk dipakai membuktikan siapa dirinya.
 *
 * Mengembalikan HANYA { penuh: boolean } — tanpa angka, tanpa nama siapa
 * pun. kuota_harian/{tanggal} sendiri tertutup total untuk klien
 * (firestore.rules: allow read, write: if false, Slice "kuota-peserta") —
 * ini SATU-SATUNYA cara klien tahu keadaannya, dan sengaja dibuat sesempit
 * mungkin.
 *
 * "penuh" dihitung dengan pertanyaan yang sama seperti transaksi pendaftaran
 * sesungguhnya (putuskanBatasHarian(), src/lib/kuota-peserta.ts): apakah SATU
 * pendaftaran lagi hari ini akan ditolak? Endpoint ini HANYA membaca — tidak
 * pernah menaikkan penghitung, itu hak transaksi pendaftaran saja.
 */
export async function GET() {
  const db = getAdminDb();
  const tanggal = tanggalJakarta(new Date());

  const [parameterSnap, kuotaHarianSnap] = await Promise.all([
    db.collection("parameter").doc("global").get(),
    db.collection("kuota_harian").doc(tanggal).get(),
  ]);

  const batasHarian =
    typeof parameterSnap.data()?.batasPendaftaranBaruPerHari === "number"
      ? (parameterSnap.data()?.batasPendaftaranBaruPerHari as number)
      : 0;
  const jumlahSaatIni =
    typeof kuotaHarianSnap.data()?.jumlah === "number"
      ? (kuotaHarianSnap.data()?.jumlah as number)
      : 0;

  const penuh = !putuskanBatasHarian(batasHarian, jumlahSaatIni + 1).ok;

  return Response.json({ penuh });
}
