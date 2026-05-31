"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface SurvivalRow {
  program_day: number;
  total: number;
  did_checkin: number;
  checkin_pct: number;
  delta_vs_prev_day: number | null;
}
interface HighRiskRow {
  user_id: string;
  full_name: string;
  program_day: number | null;
  consecutive_missed: number;
  feeling: number | null;
  risk_score: number;
  on_rescue: boolean;
  recent_avg_feeling: number | null;
  recent_all_light: boolean;
}
interface CohortRow {
  cohort_id: string;
  name: string;
  slug: string | null;
  start_date: string | null;
  enrolled: number;
  completed: number;
  completion_pct: number;
}
interface GenomeData {
  genome_ready: boolean;
  today_vn: string;
  survival: SurvivalRow[];
  cliff: { program_day: number; checkin_pct: number; delta_vs_prev_day: number | null }[];
  high_risk_today: HighRiskRow[];
  cohort_completion: CohortRow[];
}

export default function GenomePage() {
  const [data, setData] = useState<GenomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/genome");
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Không tải được dữ liệu genome.");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Không thể kết nối.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="text-neutral-600">Đang tải...</p>;
  }
  if (error || !data) {
    return <p className="text-red-600">{error ?? "Không có dữ liệu."}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Dropout genome</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Đường cong sống sót, vách đá bỏ cuộc và rủi ro hôm nay – dữ liệu từ snapshot đêm (genome-daily). Ngày VN: {data.today_vn}.
        </p>
      </div>

      {!data.genome_ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Bảng enrollment_daily chưa tồn tại – migration 062 chưa được push. Phần đường cong, vách đá và danh sách rủi ro sẽ hiện khi job genome-daily chạy lần đầu. Completion theo cohort vẫn hiển thị bên dưới.
        </div>
      )}

      {/* a) Đường cong sống sót */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="font-heading font-semibold text-primary">Đường cong sống sót</h2>
        <p className="mt-1 text-sm text-neutral-600">
          % check-in theo ngày chương trình – tìm các ngày tụt mạnh.
        </p>
        {data.survival.length === 0 ? (
          <p className="mt-4 py-8 text-center text-neutral-500">Chưa có dữ liệu snapshot.</p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.survival}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="program_day" tick={{ fontSize: 11 }} label={{ value: "Ngày", position: "insideBottom", offset: -2, fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => (typeof v === "number" ? `${v}%` : v)} labelFormatter={(l) => `Ngày ${l}`} />
                <Line type="monotone" dataKey="checkin_pct" name="% check-in" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* b) Dropout cliff */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="font-heading font-semibold text-primary">Vách đá bỏ cuộc</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Chênh lệch % check-in so với ngày liền trước (âm = tụt). Cột âm sâu là ngày vách đá.
        </p>
        {data.cliff.length === 0 ? (
          <p className="mt-4 py-8 text-center text-neutral-500">Chưa có dữ liệu snapshot.</p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.cliff.filter((c) => c.delta_vs_prev_day !== null)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="program_day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => (typeof v === "number" ? `${v}%` : v)} labelFormatter={(l) => `Ngày ${l}`} />
                <ReferenceLine y={0} stroke="#9ca3af" />
                <Bar dataKey="delta_vs_prev_day" name="Δ vs ngày trước" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* c) High-risk hôm nay */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="font-heading font-semibold text-primary">
          Rủi ro cao hôm nay ({data.high_risk_today.length})
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          enrollment_daily risk_band = high, sắp theo risk_score giảm dần.
        </p>
        {data.high_risk_today.length === 0 ? (
          <p className="mt-4 py-8 text-center text-neutral-500">Không có ai ở mức rủi ro cao hôm nay.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="pb-2 font-medium">Người dùng</th>
                  <th className="pb-2 font-medium text-right">Ngày</th>
                  <th className="pb-2 font-medium text-right">Bỏ liên tiếp</th>
                  <th className="pb-2 font-medium text-right">Cảm nhận</th>
                  <th className="pb-2 font-medium text-right">Feeling TB 5 buổi</th>
                  <th className="pb-2 font-medium text-center">Toàn Light</th>
                  <th className="pb-2 font-medium text-right">Risk</th>
                  <th className="pb-2 font-medium text-center">Đang rescue</th>
                </tr>
              </thead>
              <tbody>
                {data.high_risk_today.map((r) => (
                  <tr key={r.user_id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2.5">{r.full_name}</td>
                    <td className="py-2.5 text-right">{r.program_day ?? "–"}</td>
                    <td className="py-2.5 text-right">{r.consecutive_missed}</td>
                    <td className="py-2.5 text-right">{r.feeling ?? "–"}</td>
                    <td className="py-2.5 text-right">{r.recent_avg_feeling ?? "–"}</td>
                    <td className="py-2.5 text-center">{r.recent_all_light ? "✓" : "–"}</td>
                    <td className="py-2.5 text-right font-semibold text-red-600">{r.risk_score}</td>
                    <td className="py-2.5 text-center">{r.on_rescue ? "✓" : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* d) Completion theo cohort */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="font-heading font-semibold text-primary">Completion theo cohort</h2>
        <p className="mt-1 text-sm text-neutral-600">KPI tham chiếu: BodiX 21 ≥ 55%.</p>
        {data.cohort_completion.length === 0 ? (
          <p className="mt-4 py-8 text-center text-neutral-500">Chưa có cohort.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="pb-2 font-medium">Cohort</th>
                  <th className="pb-2 font-medium">Chương trình</th>
                  <th className="pb-2 font-medium text-right">Đăng ký</th>
                  <th className="pb-2 font-medium text-right">Hoàn thành</th>
                  <th className="pb-2 font-medium text-right">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {data.cohort_completion.map((c) => (
                  <tr key={c.cohort_id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2.5">{c.name}</td>
                    <td className="py-2.5">{c.slug ?? "–"}</td>
                    <td className="py-2.5 text-right">{c.enrolled}</td>
                    <td className="py-2.5 text-right">{c.completed}</td>
                    <td className="py-2.5 text-right font-semibold text-primary">{c.completion_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
