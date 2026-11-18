import type { CSSProperties, ReactNode } from "react";
import { Button, IconButton } from "./Button";

interface Props {
  show: boolean;
  title: ReactNode;
  /** 없으면 닫기 버튼·배경 클릭·Esc로 닫을 수 없는 잠긴 모달 */
  onClose?: () => void;
  width?: number;
  style?: CSSProperties;
  footer?: ReactNode;
  /** 작은 확인 창 (휴대폰에서도 전체 화면이 아니라 가운데에 뜸) */
  dialog?: boolean;
  children: ReactNode;
}

export function Modal({ show, title, onClose, width, style, footer, dialog, children }: Props) {
  return (
    <div
      className={"modal-bg" + (dialog ? " dialog" : "") + (show ? " show" : "")}
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role={dialog ? "alertdialog" : "dialog"}
        aria-modal="true"
        style={{ ...(width ? { width: `min(${width}px, 100%)` } : null), ...style }}
      >
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

/** 한 번 더 물어보는 확인 창 (삭제 등) */
export function ConfirmModal({
  show,
  title,
  message,
  confirmLabel = "확인",
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  show: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      show={show}
      dialog
      title={title}
      onClose={loading ? undefined : onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={loading}>
            취소
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="modal-b confirm-msg">{message}</div>
    </Modal>
  );
}
