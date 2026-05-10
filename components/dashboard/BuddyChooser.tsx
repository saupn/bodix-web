"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  id: string;
  name: string | null;
  age: number | null;
}

export function BuddyChooser() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/buddy/candidates");
        if (!res.ok) return;
        const data = (await res.json()) as { candidates: Candidate[] };
        if (!cancelled) setCandidates(data.candidates ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChoose(id: string) {
    setChoosing(id);
    setError(null);
    try {
      const res = await fetch("/api/buddy/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buddy_user_id: id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Không thể chọn buddy. Vui lòng thử lại.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setChoosing(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-3">🤝 Chọn Buddy đồng hành</h3>
      <p className="text-sm text-gray-600 mb-4">
        Chọn 1 người trong đợt làm buddy. Cả hai sẽ chat 1-1 trong app, động
        viên nhau hoàn thành đợt tập.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Đang tải danh sách...</p>
      ) : candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleChoose(c.id)}
              disabled={!!choosing}
              className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">👤</span>
                <div className="text-left">
                  <div className="font-medium text-gray-900">
                    {c.name ?? "Người tập cùng đợt"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {c.age != null ? `${c.age} tuổi` : "Cùng đợt tập"}
                  </div>
                </div>
              </div>
              <span className="text-primary font-medium text-sm">
                {choosing === c.id ? "Đang chọn..." : "Chọn"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <p className="text-gray-700 mb-2">⏳ Đang chờ ghép cặp</p>
          <p className="text-sm text-gray-500">
            Chưa có người phù hợp. BodiX sẽ tự động ghép buddy cho bạn khi đợt
            tập bắt đầu.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
        💌 <strong>Trước ngày bắt đầu</strong>, BodiX sẽ gửi tin nhắn hướng dẫn
        qua Zalo để bạn chuẩn bị tinh thần và không gian tập.
      </div>
    </div>
  );
}
