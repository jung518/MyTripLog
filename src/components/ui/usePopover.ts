import { useEffect, useRef, useState } from "react";

/**
 * 버튼(anchor) 옆에 띄우는 팝오버의 공통 동작.
 * Select(드롭다운), DatePicker/DateRangePicker(달력)가 함께 씀.
 * - 위치 계산: 버튼 아래, 공간이 모자라면 위. 화면 밖으로 나가지 않게 좌우 보정
 * - sheetBelow 보다 좁은 화면이면 아래에서 올라오는 시트(sheet)로 표시
 * - 바깥 클릭·바깥 스크롤·창 크기 변경 시 닫힘
 */
export interface PopoverPos {
  sheet: boolean;
  up: boolean;
  left: number;
  top: number;
  /** 버튼 너비 (드롭다운 메뉴 최소 너비용) */
  anchorWidth: number;
  /** 화면 안에 들어가는 최대 높이 */
  maxHeight: number;
}

interface Options {
  /** 팝오버 예상 높이: 아래 공간이 이보다 적으면 위로 띄움 */
  height: number;
  /** 팝오버 너비 (좌우 보정용). 없으면 버튼 너비 기준 */
  width?: number;
  /** 이 너비보다 좁은 화면에서는 시트로 표시 */
  sheetBelow?: number;
  /** 어떤 이유로든(바깥 클릭, Esc, 선택) 닫힐 때 */
  onClose?: () => void;
}

export function usePopover<A extends HTMLElement = HTMLButtonElement, P extends HTMLElement = HTMLDivElement>(
  opts: Options,
) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const anchorRef = useRef<A>(null);
  const popRef = useRef<P>(null);

  function place() {
    const b = anchorRef.current?.getBoundingClientRect();
    if (!b) return;
    if (opts.sheetBelow && window.innerWidth < opts.sheetBelow) {
      setPos({ sheet: true, up: false, left: 0, top: 0, anchorWidth: b.width, maxHeight: window.innerHeight * 0.85 });
      return;
    }
    const below = window.innerHeight - b.bottom - 8;
    const above = b.top - 8;
    const up = below < Math.min(opts.height, 200) && above > below;
    const w = opts.width ?? Math.max(b.width, 140);
    setPos({
      sheet: false,
      up,
      left: Math.max(8, Math.min(b.left, window.innerWidth - w - 8)),
      top: up ? b.top - 6 : b.bottom + 6,
      anchorWidth: b.width,
      maxHeight: Math.min(opts.height, up ? above : below),
    });
  }

  function show() {
    place();
    setOpen(true);
  }

  function close(focusAnchor = true) {
    opts.onClose?.();
    setOpen(false);
    if (focusAnchor) anchorRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) =>
      !!t && (popRef.current?.contains(t as Node) || anchorRef.current?.contains(t as Node));
    const onDown = (e: MouseEvent) => {
      if (!inside(e.target)) close(false);
    };
    const onScroll = (e: Event) => {
      if (pos?.sheet) return; // 시트는 화면에 고정이라 스크롤과 무관
      if (!popRef.current?.contains(e.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos?.sheet]);

  return { open, pos, anchorRef, popRef, show, close };
}
