import type { ReactNode } from "react";

type Kind = "search" | "empty";

/**
 * 비어 있을 때 보여주는 안내.
 * - compact: 사이드 패널·표처럼 좁은 곳에서 한 줄 문구로
 * - 기본: 가운데 정렬 + 도장 모양 아이콘 + 제목/설명/버튼
 */
export function EmptyState({
  kind = "empty",
  title,
  description,
  action,
  compact,
}: {
  kind?: Kind;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="empty" role={kind === "search" ? "status" : undefined}>
        {title}
        {description && <> {description}</>}
      </div>
    );
  }
  return (
    <div className="empty-state" role={kind === "search" ? "status" : undefined}>
      <span className="empty-ico" aria-hidden="true">
        {kind === "search" ? (
          <svg viewBox="0 0 32 32">
            <circle cx="14" cy="14" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M19.5 19.5 25 25" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M11 14h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 32 32">
            <rect x="8" y="5" width="16" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="16" cy="14" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 14h8M16 10v8" stroke="currentColor" strokeWidth="1.2" />
            <path d="M12 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <p className="empty-title">{title}</p>
      {description && <p className="empty-desc">{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
