"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CohortRow {
  cohort_id: string;
  cohort_name: string;
  program_name: string;
  program_slug: string;
  cohort_status: string;
  current_members: number;
  start_date: string;
  end_date: string;
  completion_rate: number;
  d7_adherence: number;
}

export default function AdminCohortsPage() {
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics/cohorts")
      .then((r) => r.ok ? r.json() : { cohorts: [] })
      .then((d) => {
        setCohorts(d.cohorts ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
        <h1 className="mt-4 font-heading text-2xl font-bold text-primary">Cohorts</h1>
        {loading ? (
          <p className="mt-4 text-neutral-500">Đang tải...</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead>
                <tr className="bg-neutral-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Cohort</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Members</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">Completion</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">D7</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-neutral-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {cohorts.map((c) => (
                  <tr key={c.cohort_id} className="hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{c.cohort_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{c.program_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{c.cohort_status}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{c.current_members}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{c.completion_rate ?? 0}%</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{c.d7_adherence ?? 0}%</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/admin/cohorts/${c.cohort_id}/analytics`}
                        className="text-primary hover:underline"
                      >
                        Analytics
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
