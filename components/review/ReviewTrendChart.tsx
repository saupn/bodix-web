"use client";

// Tách riêng để /app/review/history import động (recharts ~97 KB gzip).
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface ReviewTrendPoint {
  week: string;
  Mệt_mỏi?: number | null;
  Tiến_bộ?: number | null;
  Độ_khó?: number | null;
}

export default function ReviewTrendChart({ data }: { data: ReviewTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} />
        <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="Mệt_mỏi"
          name="Mệt mỏi"
          stroke="#ef4444"
          strokeWidth={2}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="Tiến_bộ"
          name="Tiến bộ"
          stroke="#22c55e"
          strokeWidth={2}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="Độ_khó"
          name="Độ khó"
          stroke="#3b82f6"
          strokeWidth={2}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
