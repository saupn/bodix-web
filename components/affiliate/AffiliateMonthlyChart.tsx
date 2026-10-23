"use client";

// Tách riêng để /app/affiliate import động (recharts ~97 KB gzip).
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function AffiliateMonthlyChart({
  data,
}: {
  data: { month: string; conversions: number; commission: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString("vi-VN") : v} />
        <Legend />
        <Bar dataKey="conversions" name="Đơn" fill="#3b82f6" />
        <Bar dataKey="commission" name="Hoa hồng (đ)" fill="#22c55e" />
      </BarChart>
    </ResponsiveContainer>
  );
}
