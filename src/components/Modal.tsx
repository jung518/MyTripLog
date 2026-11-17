import type { CSSProperties, ReactNode } from "react";

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
            <button className="btn ghost" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        {children}
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
