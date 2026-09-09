import type { Metadata } from "next";
import { DEFAULT_SYSTEM_PARAMETER } from "@/lib/services/system-parameter";
import { LandingAtauBeranda } from "./_landing";

// Judul/deskripsi statis (bukan namaPlatform dinamis dari Firestore) —
// metadata Next dievaluasi sekali saat build/request server, bukan lewat
// listener klien seperti H1 di halaman ini sendiri. DEFAULT_SYSTEM_PARAMETER
// dipakai supaya nama platform tidak diketik ulang di dua tempat.
export const metadata: Metadata = {
  title: `${DEFAULT_SYSTEM_PARAMETER.namaPlatform} — Platform Evaluasi & Sertifikasi`,
  description:
    "Platform evaluasi berbasis soal, materi referensi, dan atestasi interaktif yang menerbitkan sertifikat bisa diverifikasi publik.",
};

export default function Home() {
  return <LandingAtauBeranda />;
}
