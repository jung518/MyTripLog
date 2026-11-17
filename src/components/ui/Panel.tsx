import type { ReactNode } from "react";

/** 카드 상자 + 제목 (통계, 상세 화면) */
export function Panel({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** 사이드 패널의 구역 제목 + 오른쪽 링크/버튼 */
export function SectionHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="sec-h">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

/** 좁으면 옆으로 밀어 보는 표 상자 */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="table-scroll">{children}</div>;
}
