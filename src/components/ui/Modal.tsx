import type { CSSProperties, ReactNode } from "react";
import { IconButton } from "./Button";

interface Props {
  show: boolean;
  title: ReactNode;
  /** 없으면 닫기 버튼·배경 클릭·Esc로 닫을 수 없는 잠긴 모달 */
  onClose?: () => void;
  width?: number;
  style?: CSSProperties;
  footer?: ReactNode;
  children: ReactNode;
}

export function Modal({ show, title, onClose, width, style, footer, children }: Props) {
  return (
    <div
      className={"modal-bg" + (show ? " show" : "")}
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ ...(width ? { width: `min(${width}px, 100%)` } : null), ...style }}>
        <div className="modal-h">
          <h2>{title}</h2>
          {onClose && (
            <IconButton label="닫기" className="modal-close" onClick={onClose}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </IconButton>
          )}
        </div>
        {children}
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
