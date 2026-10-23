"use client";

// Tách riêng để ProgramPageContent import động (recharts ~97 KB gzip chỉ tải
// khi thật sự có dữ liệu xu hướng để vẽ).
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ProgressTrendChart({
  data,
}: {
  data: { week: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
        <YAxis domain={[1, 5]} hide />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          name="Cảm nhận tiến bộ"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
