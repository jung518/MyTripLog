import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "./usePopover";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  /** 화면에 보이는 라벨이 없을 때 스크린리더용 이름 */
  ariaLabel?: string;
  /** 가나다순 정렬 (기본 켜짐). 값이 ""인 항목(전체·선택 안 함)은 맨 위, "기타"는 맨 아래 */
  sorted?: boolean;
}

const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

/** 가나다순(숫자는 크기순). 값이 ""인 항목(전체·선택 안 함)은 맨 위, "기타"는 맨 아래 */
/** 맨 아래에 둘 항목 이름 */
const LAST_LABELS = ["기타"];

function sortOptions<T extends string | number>(options: SelectOption<T>[]): SelectOption<T>[] {
  const pinned = options.filter((o) => o.value === "");
  const last = options.filter((o) => o.value !== "" && LAST_LABELS.includes(o.label));
  const rest = options
    .filter((o) => o.value !== "" && !LAST_LABELS.includes(o.label))
    .sort((a, b) => collator.compare(a.label, b.label));
  return [...pinned, ...rest, ...last];
}

/**
 * 브라우저 기본 <select> 대신 쓰는 드롭다운. 항목은 가나다순으로 보여줌.
 * 키보드: ↑↓ 이동, Enter/Space 선택, Esc 닫기, Home/End, 글자 입력으로 바로 찾기.
 */
export function Select<T extends string | number>({
  value,
  options: rawOptions,
  onChange,
  className,
  ariaLabel,
  sorted = true,
}: Props<T>) {
  const options = sorted ? sortOptions(rawOptions) : rawOptions;
  const pop = usePopover<HTMLButtonElement, HTMLUListElement>({ height: 280 });
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();

  const selIdx = options.findIndex((o) => String(o.value) === String(value));
  const current = options[selIdx];

  function openMenu() {
    setActive(selIdx >= 0 ? selIdx : 0);
    pop.show();
  }

  function choose(i: number) {
    const o = options[i];
    if (o && String(o.value) !== String(value)) onChange(o.value);
    pop.close();
  }

  // 선택된 항목이 보이도록 스크롤
  useLayoutEffect(() => {
    if (!pop.open) return;
    pop.popRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [pop.open, active, pop.popRef]);

  function onKey(e: KeyboardEvent) {
    const open = pop.open;
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => (open ? setActive((a) => Math.min(last, a + 1)) : openMenu()),
      ArrowUp: () => (open ? setActive((a) => Math.max(0, a - 1)) : openMenu()),
      Home: () => open && setActive(0),
      End: () => open && setActive(last),
      Enter: () => (open ? choose(active) : openMenu()),
      " ": () => (open ? choose(active) : openMenu()),
      Escape: () => open && pop.close(),
      Tab: () => open && pop.close(false),
    };
    const fn = keys[e.key];
    if (fn) {
      if (e.key !== "Tab") e.preventDefault();
      // 열려 있을 때 Esc가 모달까지 닫지 않도록
      if (e.key === "Escape" && open) e.stopPropagation();
      fn();
      return;
    }
    // 글자를 치면 그 글자로 시작하는 항목으로 이동
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current.text = (now - typed.current.at > 700 ? "" : typed.current.text) + e.key.toLowerCase();
      typed.current.at = now;
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) {
        if (!open) openMenu();
        setActive(i);
      }
    }
  }

  const p = pop.pos;
  return (
    <>
      <button
        ref={pop.anchorRef}
        type="button"
        className={"sel" + (pop.open ? " open" : "") + (className ? " " + className : "")}
        aria-haspopup="listbox"
        aria-expanded={pop.open}
        aria-controls={pop.open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (pop.open ? pop.close() : openMenu())}
        onKeyDown={onKey}
      >
        <span className="sel-v">{current ? current.label : "-"}</span>
        <svg className="sel-arrow" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {pop.open &&
        p &&
        createPortal(
          <ul
            ref={pop.popRef}
            id={listId}
            role="listbox"
            className={"sel-menu" + (p.up ? " up" : "")}
            style={{ left: p.left, top: p.top, minWidth: p.anchorWidth, maxHeight: p.maxHeight }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((o, i) => {
              const sel = i === selIdx;
              return (
                <li
                  key={String(o.value)}
                  data-i={i}
                  role="option"
                  aria-selected={sel}
                  className={(sel ? "sel-on" : "") + (i === active ? " sel-active" : "")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span>{o.label}</span>
                  {sel && (
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2.5 6.2 5 8.6 9.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
