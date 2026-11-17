import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

/* ---------- 날짜 도우미 (값은 항상 "YYYY-MM-DD" 문자열) ---------- */
export const WD = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseDate(s?: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export function addMonths(d: Date, n: number) {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
}
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthDiff = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/** 2026.11.10 (화) */
export function fmtDay(s: string): string {
  const d = parseDate(s);
  return d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WD[d.getDay()]})` : "";
}
/** 11.10 (화) — 같은 해 안에서 짧게 */
export function fmtDayShort(s: string): string {
  const d = parseDate(s);
  return d ? `${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WD[d.getDay()]})` : "";
}

/* ---------- 달력 본체 ---------- */
interface Props {
  /** 키보드로 움직이는 현재 위치 */
  cursor: Date;
  onCursor: (d: Date) => void;
  /** 한 번에 보여줄 달 수 (기간 선택 데스크톱은 2) */
  months: 1 | 2;
  isOff: (d: Date) => boolean;
  /** 날짜별로 덧붙일 클래스 (on, range, range-s, range-e …) */
  classOf: (k: string) => string;
  onPick: (d: Date) => void;
  onHover?: (k: string | null) => void;
  titleId: string;
}

export function Calendar({ cursor, onCursor, months, isOff, classOf, onPick, onHover, titleId }: Props) {
  const [view, setView] = useState(() => monthStart(cursor));
  const [mode, setMode] = useState<"days" | "months">("days");
  const ref = useRef<HTMLDivElement>(null);

  // 커서가 보이는 달 밖으로 나가면 그 달로 넘기기
  useEffect(() => {
    const diff = monthDiff(view, cursor);
    if (diff < 0) setView(monthStart(cursor));
    else if (diff > months - 1) setView(monthStart(addMonths(cursor, -(months - 1))));
  }, [cursor, months, view]);

  // 커서 날짜에 포커스
  useLayoutEffect(() => {
    if (mode !== "days") return;
    ref.current?.querySelector<HTMLButtonElement>(`[data-d="${iso(cursor)}"]`)?.focus({ preventScroll: true });
  }, [cursor, mode, view]);

  function onKey(e: KeyboardEvent) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -cursor.getDay()),
      End: () => addDays(cursor, 6 - cursor.getDay()),
    };
    if (moves[e.key]) {
      e.preventDefault();
      onCursor(moves[e.key]());
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(cursor);
    } else if (e.key === "Escape" && mode === "months") {
      e.stopPropagation();
      setMode("days");
    }
  }

  const shift = (n: number) => {
    const v = addMonths(view, n);
    setView(v);
    onCursor(new Date(v.getFullYear(), v.getMonth(), Math.min(cursor.getDate(), 28)));
  };
  const today = iso(new Date());
  const shown = Array.from({ length: months }, (_, i) => addMonths(view, i));

  return (
    <div className="cal" ref={ref} onKeyDown={onKey}>
      <button
        type="button"
        className="dp-nav prev"
        aria-label={mode === "days" ? "이전 달" : "이전 해"}
        onClick={() => shift(mode === "days" ? -1 : -12)}
      >
        <Chevron dir="left" />
      </button>
      <button
        type="button"
        className="dp-nav next"
        aria-label={mode === "days" ? "다음 달" : "다음 해"}
        onClick={() => shift(mode === "days" ? 1 : 12)}
      >
        <Chevron dir="right" />
      </button>

      {mode === "months" ? (
        <div className="cal-month">
          <div className="cal-title">
            <button type="button" id={titleId} className="dp-title" onClick={() => setMode("days")}>
              <b>{view.getFullYear()}년</b>
            </button>
          </div>
          <div className="dp-months">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                type="button"
                className={"dp-month" + (i === view.getMonth() ? " cursor" : "")}
                onClick={() => {
                  const v = new Date(view.getFullYear(), i, 1);
                  setView(v);
                  onCursor(new Date(v.getFullYear(), i, Math.min(cursor.getDate(), 28)));
                  setMode("days");
                }}
              >
                {i + 1}월
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={"cal-months" + (months === 2 ? " cal-two" : "")} onMouseLeave={() => onHover?.(null)}>
          {shown.map((mDate, mi) => {
            const y = mDate.getFullYear();
            const m = mDate.getMonth();
            const first = new Date(y, m, 1);
            const start = addDays(first, -first.getDay());
            const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
            return (
              <div className="cal-month" key={y * 12 + m}>
                <div className="cal-title">
                  {mi === 0 ? (
                    <button
                      type="button"
                      id={titleId}
                      className="dp-title"
                      aria-label={`${y}년 ${m + 1}월, 눌러서 달 고르기`}
                      onClick={() => setMode("months")}
                    >
                      {y}년 <b>{m + 1}월</b>
                    </button>
                  ) : (
                    <span className="dp-title static">
                      {y}년 <b>{m + 1}월</b>
                    </span>
                  )}
                </div>
                <div className="dp-week" aria-hidden="true">
                  {WD.map((w, i) => (
                    <span key={w} className={i === 0 ? "sun" : i === 6 ? "sat" : undefined}>
                      {w}
                    </span>
                  ))}
                </div>
                <div className="dp-grid" role="grid">
                  {cells.map((d) => {
                    const k = iso(d);
                    const out = d.getMonth() !== m;
                    // 두 달을 보여줄 때 다른 달 칸은 비워 둠 (같은 날짜가 두 번 나오지 않게)
                    if (out && months === 2) return <span key={k} className="dp-day blank" aria-hidden="true" />;
                    const off = isOff(d);
                    const cls = [
                      "dp-day",
                      out && "out",
                      d.getDay() === 0 && "sun",
                      d.getDay() === 6 && "sat",
                      k === today && "today",
                      classOf(k),
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button
                        key={k}
                        type="button"
                        data-d={k}
                        className={cls}
                        disabled={off}
                        tabIndex={k === iso(cursor) ? 0 : -1}
                        aria-label={fmtDay(k) + (k === today ? ", 오늘" : "")}
                        aria-pressed={/\bon\b/.test(cls)}
                        onMouseEnter={() => onHover?.(k)}
                        onClick={() => onPick(d)}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path
        d={dir === "left" ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6 4.5 9.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
