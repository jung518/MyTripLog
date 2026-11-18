import { useEffect, useRef, useState } from "react";
import { downloadBackup } from "../lib/backup";
import { legalLink } from "../lib/router";
import { toast } from "../lib/ui";

interface Props {
  email: string;
  /** 없으면 "" (닉네임을 정하기 전의 예전 계정) → 이메일로 표시 */
  nickname: string;
  onNickname: () => void;
  onLogout: () => void;
  onDelete: () => void;
}

/**
 * 헤더 오른쪽 계정 메뉴 (클라우드 모드).
 * 닉네임(휴대폰은 사람 아이콘)을 누르면: 닉네임 바꾸기 / 내 기록 내려받기 / 로그아웃
 */
export function AccountMenu({ email, nickname, onNickname, onLogout, onDelete }: Props) {
  const name = nickname || email;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc를 누르면 닫힘
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function download() {
    setBusy(true);
    try {
      await downloadBackup();
      toast("내 기록을 파일로 저장했어요");
      setOpen(false);
    } catch {
      toast("파일을 만들지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account" ref={boxRef}>
      <button
        type="button"
        className="account-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        title={nickname ? `${nickname} (${email})` : email}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="account-ico" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="5.5" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.8 14c.6-2.7 2.7-4.3 5.2-4.3s4.6 1.6 5.2 4.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="account-email hide-sm">{name}</span>
        <svg className="account-caret hide-sm" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">계정 메뉴</span>
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-email" title={email}>
            {nickname && <b>{nickname}</b>}
            {email}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNickname();
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10.5 2.8 13.2 5.5 6 12.7 2.8 13.2l.5-3.2 7.2-7.2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {nickname ? "닉네임 바꾸기" : "닉네임 정하기"}
          </button>
          <button type="button" role="menuitem" disabled={busy} onClick={() => void download()}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {busy ? "만드는 중…" : "내 기록 내려받기"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11 13.5 8l-3-3M13.5 8H6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            로그아웃
          </button>
          <div className="account-menu-foot">
            <a {...legalLink("terms")} onClickCapture={() => setOpen(false)}>
              이용약관
            </a>
            <a {...legalLink("privacy")} onClickCapture={() => setOpen(false)}>
              개인정보 처리방침
            </a>
            <button
              type="button"
              className="account-delete"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              회원 탈퇴
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
