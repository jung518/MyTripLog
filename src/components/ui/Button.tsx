import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "default" | "primary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
  /** 작업 중: 스피너를 보여주고 누를 수 없게 함 */
  loading?: boolean;
  /** 삭제 확인처럼 한 번 더 눌러야 하는 상태 */
  armed?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

/** 앱 공통 버튼 (.btn) */
export function Button({
  variant = "default",
  size = "md",
  loading = false,
  armed = false,
  icon,
  block,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: Props) {
  const cls = [
    "btn",
    variant !== "default" && variant,
    size === "sm" && "small",
    armed && "armed",
    loading && "is-loading",
    block && "block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}

/** 아이콘만 있는 작은 버튼 (줄 삭제 ✕ 등). label은 스크린리더·툴팁용 */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={"icon-btn" + (className ? " " + className : "")} title={label} aria-label={label} {...rest}>
      {children}
    </button>
  );
}
