import type { ReactNode } from "react";

/** 숫자 카드 묶음. side = 사이드 패널(2열), page = 통계·상세(가로로 채움) */
export function KpiGrid({ variant = "page", children }: { variant?: "side" | "page"; children: ReactNode }) {
  return <div className={variant === "side" ? "kpis" : "stat-grid"}>{children}</div>;
}

/** 숫자 카드 하나: 큰 값 + 설명 */
export function Kpi({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="kpi">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
