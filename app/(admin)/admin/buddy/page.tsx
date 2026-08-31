"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface CohortOption {
  cohort_id: string;
  cohort_name: string;
  cohort_status: string;
  current_members: number;
}

interface PairUser {
  id: string;
  name: string | null;
}

interface BuddyPair {
  id: string;
  user_a: PairUser;
  user_b: PairUser;
  matched_by: string;
  created_at: string;
}

interface BuddyData {
  pairs: BuddyPair[];
  unpaired: PairUser[];
  total_members: number;
}

export default function AdminBuddyPage() {
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [selectedCohort, setSelectedCohort] = useState("");
  const [data, setData] = useState<BuddyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cohortsLoading, setCohortsLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [dissolving, setDissolving] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<string | null>(null);

  // Load cohorts
  useEffect(() => {
    fetch("/api/admin/analytics/cohorts")
      .then((r) => (r.ok ? r.json() : { cohorts: [] }))
      .then((d) => {
        setCohorts(d.cohorts ?? []);
      })
      .finally(() => setCohortsLoading(false));
  }, []);

  // Load buddy data for selected cohort
  const loadBuddyData = useCallback(async () => {
    if (!selectedCohort) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/buddy?cohort_id=${selectedCohort}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  useEffect(() => {
    loadBuddyData();
  }, [loadBuddyData]);

  const handleAutoMatch = async () => {
    if (!selectedCohort) return;
    setMatching(true);
    setMatchResult(null);
    try {
      const res = await fetch("/api/buddy/auto-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort_id: selectedCohort }),
      });
      const result = await res.json();
      if (res.ok) {
        setMatchResult(
          `Ghép ${result.matched} cặp. Zalo: ${result.zalo_sent} sent, ${result.zalo_errors} errors. Chưa ghép: ${result.unpaired}.`
        );
        await loadBuddyData();
      } else {
        setMatchResult(`Lỗi: ${result.error}`);
      }
    } finally {
      setMatching(false);
    }
  };

  const handleDissolve = async (pairId: string) => {
    setDissolving(pairId);
    try {
      const res = await fetch("/api/admin/buddy/dissolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair_id: pairId }),
      });
      if (res.ok) {
        await loadBuddyData();
      }
    } finally {
      setDissolving(null);
    }
  };

  const MATCHED_BY_LABEL: Record<string, string> = {
    auto: "Auto",
    manual: "User",
    admin: "Admin",
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/admin"
          className="text-sm text-primary hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 font-heading text-2xl font-bold text-primary">
          Buddy Management
        </h1>

        {/* Cohort selector */}
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="cohort-select"
              className="block text-sm font-medium text-neutral-700"
            >
              Chọn cohort
            </label>
            <select
              id="cohort-select"
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              disabled={cohortsLoading}
              className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">-- Chọn cohort --</option>
              {cohorts.map((c) => (
                <option key={c.cohort_id} value={c.cohort_id}>
                  {c.cohort_name} ({c.cohort_status}, {c.current_members}{" "}
                  members)
                </option>
              ))}
            </select>
          </div>

          {selectedCohort && (
            <button
              type="button"
              onClick={handleAutoMatch}
              disabled={matching}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {matching ? "Đang ghép..." : "Auto-match"}
            </button>
          )}
        </div>

        {matchResult && (
          <p className="mt-3 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
            {matchResult}
          </p>
        )}

        {loading && (
          <p className="mt-6 text-neutral-500">Đang tải...</p>
        )}

        {!loading && data && (
          <div className="mt-6 space-y-6">
            {/* Summary */}
            <div className="flex gap-6 text-sm text-neutral-600">
              <span>
                Tổng members: <strong>{data.total_members}</strong>
              </span>
              <span>
                Đã ghép: <strong>{data.pairs.length} cặp</strong>
              </span>
              <span>
                Chưa ghép: <strong>{data.unpaired.length}</strong>
              </span>
            </div>

            {/* Pairs table */}
            {data.pairs.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead>
                    <tr className="bg-neutral-50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        User A
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        User B
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Ghép bởi
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                        Ngày ghép
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-neutral-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {data.pairs.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {p.user_a.name ?? p.user_a.id.slice(0, 8)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {p.user_b.name ?? p.user_b.id.slice(0, 8)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.matched_by === "auto"
                                ? "bg-blue-100 text-blue-700"
                                : p.matched_by === "manual"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            {MATCHED_BY_LABEL[p.matched_by] ?? p.matched_by}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-500">
                          {new Date(p.created_at).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDissolve(p.id)}
                            disabled={dissolving === p.id}
                            className="text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                          >
                            {dissolving === p.id ? "..." : "Tách"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Unpaired users */}
            {data.unpaired.length > 0 && (
              <div>
                <h2 className="font-heading text-lg font-semibold text-neutral-800">
                  Chưa có buddy ({data.unpaired.length})
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.unpaired.map((u) => (
                    <span
                      key={u.id}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800"
                    >
                      {u.name ?? u.id.slice(0, 8)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.pairs.length === 0 && data.unpaired.length === 0 && (
              <p className="text-neutral-500">
                Chưa có members trong cohort này.
              </p>
            )}
          </div>
        )}

        {!loading && !data && selectedCohort && (
          <p className="mt-6 text-neutral-500">Không có dữ liệu.</p>
        )}
      </div>
    </div>
  );
}
