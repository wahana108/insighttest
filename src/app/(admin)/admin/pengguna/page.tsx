"use client";

import { useState } from "react";
import { WajibAdmin } from "@/app/(admin)/_wajib-admin";
import { useAuth } from "@/lib/auth/auth-provider";
import { formatDate } from "@/lib/format-date";
import { useUserList } from "@/lib/hooks/use-user-list";
import {
  updateUserBolehBuatSoal,
  updateUserRole,
  updateUserStatus,
} from "@/lib/services/user-management";
import type { UserRole, UserStatus } from "@/types/user";

const STATUS_OPTIONS: UserStatus[] = ["aktif", "pending", "nonaktif"];
const ROLE_OPTIONS: UserRole[] = ["superadmin", "admin", "panitia", "peserta"];

export default function AdminPenggunaPage() {
  return (
    <WajibAdmin>
      <AdminPenggunaPageIsi />
    </WajibAdmin>
  );
}

function AdminPenggunaPageIsi() {
  const { user, profile } = useAuth();
  const { items, loading, error: listError } = useUserList();
  const [error, setError] = useState<string | null>(null);
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const canEditRole = profile?.role === "superadmin";

  async function handleStatusChange(uid: string, status: UserStatus) {
    setError(null);
    setSavingUid(uid);
    try {
      await updateUserStatus(uid, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status.");
    } finally {
      setSavingUid(null);
    }
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    setError(null);
    setSavingUid(uid);
    try {
      await updateUserRole(uid, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah role.");
    } finally {
      setSavingUid(null);
    }
  }

  async function handleBolehBuatSoalChange(uid: string, bolehBuatSoal: boolean) {
    setError(null);
    setSavingUid(uid);
    try {
      await updateUserBolehBuatSoal(uid, bolehBuatSoal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah kewenangan bank soal.");
    } finally {
      setSavingUid(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Pengguna</h1>
        <p className="text-sm text-zinc-500">
          {canEditRole
            ? "Anda bisa mengubah status dan role pengguna lain."
            : "Anda bisa mengubah status pengguna lain. Hanya superadmin yang bisa mengubah role."}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Nama</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Boleh buat soal</th>
              <th className="px-4 py-2 font-medium">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  Memuat...
                </td>
              </tr>
            )}
            {!loading && listError && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-red-600">
                  Gagal memuat pengguna: {listError}
                </td>
              </tr>
            )}
            {!loading && !listError && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  Belum ada pengguna.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const isSelf = item.uid === user?.uid;
              const busy = savingUid === item.uid;
              const lockTitle = isSelf
                ? "Tidak bisa mengubah status atau role akun sendiri di sini."
                : undefined;

              return (
                <tr
                  key={item.uid}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="px-4 py-2 text-black dark:text-zinc-50">
                    {item.displayName}
                    {isSelf && <span className="ml-2 text-xs text-zinc-400">(Anda)</span>}
                  </td>
                  <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{item.email}</td>
                  <td className="px-4 py-2">
                    {canEditRole ? (
                      <select
                        value={item.role}
                        disabled={isSelf || busy}
                        title={lockTitle}
                        onChange={(event) =>
                          handleRoleChange(item.uid, event.target.value as UserRole)
                        }
                        className="rounded border border-zinc-300 px-2 py-1 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-zinc-700 dark:text-zinc-300">{item.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={item.status}
                      disabled={isSelf || busy}
                      title={lockTitle}
                      onChange={(event) =>
                        handleStatusChange(item.uid, event.target.value as UserStatus)
                      }
                      className="rounded border border-zinc-300 px-2 py-1 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={item.bolehBuatSoal}
                      disabled={busy}
                      onChange={(event) =>
                        handleBolehBuatSoalChange(item.uid, event.target.checked)
                      }
                      aria-label={`Boleh buat soal untuk ${item.displayName}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{formatDate(item.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Baris akun Anda sendiri dikunci — tidak bisa menonaktifkan atau menurunkan peran
        sendiri di sini.
      </p>
    </div>
  );
}
