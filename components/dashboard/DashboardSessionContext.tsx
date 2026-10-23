"use client";

import { createContext, useContext } from "react";

/**
 * Định danh phiên do (dashboard)/layout.tsx đã lấy sẵn ở server.
 * Tab client dùng để có ngay enrollment_id / cohort_id, không phải gọi
 * /api/program/active trước rồi mới gọi các API khác (bỏ một đợt nối tiếp).
 *
 * Có thể null (shell tối giản của magic-link workout) → tab tự fetch như cũ.
 * Layout không render lại khi chuyển tab; enrollment chỉ đổi qua thanh toán /
 * kích hoạt đợt, các luồng đó đều router.refresh() hoặc tải lại trang.
 */
export interface DashboardSession {
  userId: string;
  activeEnrollment: {
    id: string;
    cohortId: string | null;
    programId: string;
  } | null;
}

const DashboardSessionContext = createContext<DashboardSession | null>(null);

export function DashboardSessionProvider({
  value,
  children,
}: {
  value: DashboardSession;
  children: React.ReactNode;
}) {
  return (
    <DashboardSessionContext.Provider value={value}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession(): DashboardSession | null {
  return useContext(DashboardSessionContext);
}
