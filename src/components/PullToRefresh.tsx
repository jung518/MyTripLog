import { useEffect, useRef, useState } from "react";

/** 이만큼(px) 당기면 놓았을 때 새로고침 */
const THRESHOLD = 64;
/** 표시가 내려오는 최대 거리 */
const MAX_PULL = 96;
/** 손가락이 움직인 거리 대비 표시가 내려오는 비율 (당기는 느낌) */
const RESIST = 0.5;
/** 새로고침이 금방 끝나도 스피너가 이 시간만큼은 돌게 함 (깜빡임 방지) */
const MIN_SPIN_MS = 600;

/** 여기서 시작한 터치는 당겨서 새로고침으로 보지 않음 (지도 끌기, 열린 창, 달력·드롭다운 등) */
const IGNORE = ".map-wrap, .modal-bg.show, .dp-pop, .sel-menu, .suggest, .loading-screen, input, textarea";

interface Props {
  onRefresh: () => Promise<void>;
  /** 로딩 중·잠금 화면 등에서는 끔 */
  disabled?: boolean;
}

/**
 * 휴대폰(터치 화면)에서 맨 위에서 아래로 당기면 스피너가 내려오고,
 * 충분히 당겼다 놓으면 스피너가 돌면서 기록을 다시 불러옴.
 * 브라우저 자체의 당겨서 새로고침(페이지 전체 다시 읽기)은 CSS overscroll-behavior로 끔.
 */
export function PullToRefresh({ onRefresh, disabled }: Props) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const live = useRef({ onRefresh, disabled, busy });
  live.current = { onRefresh, disabled, busy };

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    let startX = 0;
    let startY: number | null = null;
    let active = false;
    let dist = 0;

    const reset = () => {
      startY = null;
      active = false;
      dist = 0;
      setDragging(false);
    };

    const onStart = (e: TouchEvent) => {
      const l = live.current;
      if (l.busy || l.disabled || e.touches.length !== 1 || window.scrollY > 0) return;
      if ((e.target as Element | null)?.closest?.(IGNORE)) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      active = false;
    };

    const onMove = (e: TouchEvent) => {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (!active) {
        // 위로 밀거나 옆으로 미는 건 일반 스크롤 → 이번 터치는 포기
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dx) > 8 || dy < -8) startY = null;
          return;
        }
        if (dy < 8) return;
        active = true;
        setDragging(true);
      }
      if (window.scrollY > 0) {
        reset();
        setPull(0);
        return;
      }
      if (e.cancelable) e.preventDefault();
      dist = Math.min(MAX_PULL, (dy - 8) * RESIST);
      setPull(dist);
    };

    const onEnd = async () => {
      if (startY == null) return;
      const ok = active && dist >= THRESHOLD;
      reset();
      if (!ok) {
        setPull(0);
        return;
      }
      setBusy(true);
      setPull(THRESHOLD);
      try {
        await Promise.all([live.current.onRefresh(), new Promise((r) => setTimeout(r, MIN_SPIN_MS))]);
      } catch {
        /* 저장소가 이미 알림을 띄움 */
      } finally {
        setBusy(false);
        setPull(0);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const ready = pull >= THRESHOLD;
  return (
    <div
      className={"ptr" + (dragging ? " dragging" : "") + (busy ? " busy" : "") + (ready ? " ready" : "")}
      style={{ transform: `translate(-50%, ${pull - 52}px)`, opacity: busy ? 1 : Math.min(1, pull / THRESHOLD) }}
      role="status"
      aria-live="polite"
    >
      <span className="ptr-ico" style={busy ? undefined : { transform: `rotate(${pull * 4}deg)` }} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".22" />
          <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="sr-only">{busy ? "새로 불러오는 중" : ""}</span>
    </div>
  );
}
