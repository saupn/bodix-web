"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  program: string;
  cohort: string;
  streak: number;
  risk: number;
  joined: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");

  const fetchUsers = useCallback(
    async (p = 0) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(p) });
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (programFilter) params.set("program", programFilter);
        const r = await fetch(`/api/admin/users?${params}`);
        if (r.ok) {
          const d = await r.json();
          setUsers(d.users ?? []);
          setHasMore(d.has_more ?? false);
          setPage(d.page ?? 0);
        }
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, programFilter]
  );

  useEffect(() => {
    fetchUsers(0);
  }, [fetchUsers]);

  const riskColor = (risk: number) => {
    if (risk >= 70) return "bg-red-500 text-white";
    if (risk >= 50) return "bg-orange-500 text-white";
    if (risk >= 30) return "bg-amber-500 text-white";
    return "bg-green-500 text-white";
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-primary">Users</h1>

        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4">
          <input
            type="text"
            placeholder="Tìm theo tên, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="">Tất cả status</option>
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="dropped">dropped</option>
            <option value="paused">paused</option>
            <option value="trial">trial</option>
          </select>
          <input
            type="text"
            placeholder="Lọc theo program..."
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => fetchUsers(0)}
            className="rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Tìm kiếm
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-neutral-500">Đang tải...</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Tên</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Cohort</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Streak</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer hover:bg-neutral-50"
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{u.full_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">{u.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">{u.phone}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{u.status}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{u.program}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{u.cohort}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{u.streak}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {u.risk > 0 ? (
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${riskColor(u.risk)}`}>
                          {u.risk}
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                      {u.joined ? new Date(u.joined).toLocaleDateString("vi-VN") : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2">
              <p className="text-sm text-neutral-500">{users.length} users</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fetchUsers(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Trước
                </button>
                <button
                  type="button"
                  onClick={() => fetchUsers(page + 1)}
                  disabled={!hasMore}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
