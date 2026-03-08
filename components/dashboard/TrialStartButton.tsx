"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TrialStartButtonProps {
  programId: string;
  programName: string;
  children: React.ReactNode;
  className?: string;
}

export function TrialStartButton({
  programId,
  programName,
  children,
  className = "",
}: TrialStartButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trial/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: programId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Có lỗi xảy ra. Vui lòng thử lại.");
        return;
      }

      router.push("/app/trial");
      router.refresh();
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleStart}
        disabled={loading}
        className={className}
        aria-label={`Dùng thử miễn phí ${programName}`}
      >
        {loading ? "Đang xử lý..." : children}
      </button>
      {error && (
        <p className="mt-2 text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
