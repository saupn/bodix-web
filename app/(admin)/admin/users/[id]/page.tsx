"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface UserDetail {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  enrollments: { status: string; program: string; cohort: string; day: number; streak: number; risk: number }[];
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/users/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-neutral-500">Đang tải...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-red-500">Không tìm thấy user.</p>
        <Link href="/admin/users" className="text-primary hover:underline">← Quay lại</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin/users" className="text-sm text-primary hover:underline">← Users</Link>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="font-heading text-xl font-bold text-primary">{data.full_name}</h1>
          <p className="mt-1 text-sm text-neutral-600">{data.email}</p>
          <p className="text-sm text-neutral-600">{data.phone}</p>
        </div>
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-primary">Enrollments</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Program</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Cohort</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Day</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Streak</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Risk</th>
                </tr>
              </thead>
              <tbody>
                {(data.enrollments ?? []).map((e, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="px-4 py-2 text-sm">{e.status}</td>
                    <td className="px-4 py-2 text-sm">{e.program}</td>
                    <td className="px-4 py-2 text-sm">{e.cohort}</td>
                    <td className="px-4 py-2 text-sm">{e.day}</td>
                    <td className="px-4 py-2 text-sm">{e.streak}</td>
                    <td className="px-4 py-2 text-sm">{e.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
