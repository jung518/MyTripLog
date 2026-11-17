import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Calendar, fmtDay, fmtDayShort, iso, parseDate } from "./Calendar";
import { usePopover, type PopoverPos } from "./usePopover";

/**
 * 날짜 선택 (단일 DatePicker / 기간 DateRangePicker).
 * 값은 기본 날짜 입력과 같은 "YYYY-MM-DD" 문자열 (비어 있으면 "").
 * - 데스크톱: 버튼 옆에 떠 있는 달력 (기간 선택은 두 달)
 * - 좁은 화면(휴대폰): 아래에서 올라오는 시트 (한 달)
 * 키보드: ←→ 하루, ↑↓ 일주일, PageUp/PageDown 한 달, Home/End 주의 처음/끝, Enter 선택, Esc 닫기
 */

const SHEET_BELOW = 560;
const TWO_MONTHS_FROM = 700;

interface Common {
  /** 고를 수 있는 가장 이른 날 */
  min?: string;
  /** 고를 수 있는 가장 늦은 날 */
  max?: string;
  /** 값이 없을 때 처음 보여줄 달의 기준 날짜 */
  defaultMonth?: string;
  /** 은은하게 표시할 기간 (예: 여행 기간) */
  highlight?: { start?: string; end?: string };
  ariaLabel?: string;
}

const inRange = (k: string, a?: string, b?: string) => !!a && !!b && k >= a && k <= b;
function rangeClass(k: string, a: string | undefined, b: string | undefined, prefix: string) {
  if (!inRange(k, a, b)) return "";
  return [prefix, k === a && prefix + "-s", k === b && prefix + "-e"].filter(Boolean).join(" ");
}
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function useLimits(min?: string, max?: string) {
  const minD = parseDate(min);
  const maxD = parseDate(max);
  const isOff = (d: Date) => !!((minD && d < minD) || (maxD && d > maxD));
  const clamp = (d: Date) => (minD && d < minD ? minD : maxD && d > maxD ? maxD : d);
  return { minD, isOff, clamp };
}

/* ---------- 공통 껍데기: 트리거 버튼 + 팝오버/시트 ---------- */
interface ShellProps {
  open: boolean;
  pos: PopoverPos | null;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  popRef: React.RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  onClose: (focus?: boolean) => void;
  titleId: string;
  months: 1 | 2;
  empty: boolean;
  ariaLabel?: string;
  trigger: ReactNode;
  hint?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

function PickerShell(s: ShellProps) {
  const p = s.pos;
  return (
    <>
      <button
        ref={s.anchorRef}
        type="button"
        className={cx("dp", s.open && "open", s.empty && "empty")}
        aria-haspopup="dialog"
        aria-expanded={s.open}
        aria-label={s.ariaLabel}
        onClick={() => (s.open ? s.onClose() : s.onOpen())}
        onKeyDown={(e) => {
          if (!s.open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            s.onOpen();
          }
        }}
      >
        <svg className="dp-ico" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.75" y="3" width="12.5" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M1.75 6.5h12.5M5 1.5v3M11 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {s.trigger}
      </button>
      {s.open &&
        p &&
        createPortal(
          <>
            {p.sheet && <div className="dp-backdrop" onMouseDown={() => s.onClose(false)} />}
            <div
              ref={s.popRef}
              role="dialog"
              aria-modal={p.sheet || undefined}
              aria-labelledby={s.titleId}
              className={cx("dp-pop", p.sheet && "sheet", p.up && "up", s.months === 2 && "dp-two")}
              style={p.sheet ? undefined : { left: p.left, top: p.top }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && !e.defaultPrevented) {
                  // 달력만 닫고 모달은 그대로
                  e.stopPropagation();
                  e.preventDefault();
                  s.onClose();
                }
              }}
            >
              {p.sheet && <div className="dp-grip" aria-hidden="true" />}
              {s.hint && (
                <div className="dp-hint" aria-live="polite">
                  {s.hint}
                </div>
              )}
              {s.children}
              <div className="dp-foot">
                {s.footer}
                {p.sheet && (
                  <button type="button" className="dp-link close" onClick={() => s.onClose()}>
                    닫기
                  </button>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/* ---------- 단일 날짜 ---------- */
interface DateProps extends Common {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder = "날짜 선택", min, max, defaultMonth, highlight, ariaLabel }: DateProps) {
  const pop = usePopover<HTMLButtonElement, HTMLDivElement>({ height: 380, width: 300, sheetBelow: SHEET_BELOW });
  const [cursor, setCursor] = useState(() => new Date());
  const titleId = useId();
  const { minD, isOff, clamp } = useLimits(min, max);

  function open() {
    setCursor(clamp(parseDate(value) || parseDate(defaultMonth) || minD || new Date()));
    pop.show();
  }
  function pick(d: Date) {
    if (isOff(d)) return;
    onChange(iso(d));
    pop.close();
  }

  return (
    <PickerShell
      open={pop.open}
      pos={pop.pos}
      anchorRef={pop.anchorRef}
      popRef={pop.popRef}
      onOpen={open}
      onClose={pop.close}
      titleId={titleId}
      months={1}
      empty={!value}
      ariaLabel={ariaLabel ? `${ariaLabel}: ${value ? fmtDay(value) : "선택 안 함"}` : undefined}
      trigger={<span className="dp-v">{value ? fmtDay(value) : placeholder}</span>}
      footer={
        <>
          <button type="button" className="dp-link" disabled={isOff(new Date())} onClick={() => pick(new Date())}>
            오늘
          </button>
          {value && (
            <button
              type="button"
              className="dp-link muted"
              onClick={() => {
                onChange("");
                pop.close();
              }}
            >
              지우기
            </button>
          )}
        </>
      }
    >
      <Calendar
        cursor={cursor}
        onCursor={setCursor}
        months={1}
        isOff={isOff}
        titleId={titleId}
        onPick={pick}
        classOf={(k) => cx(k === value && "on", rangeClass(k, highlight?.start, highlight?.end || highlight?.start, "hl"))}
      />
    </PickerShell>
  );
}

/* ---------- 기간 (시작일 ~ 종료일) ---------- */
interface RangeProps extends Common {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  /** 단계별 이름 (기본: 출발일 / 귀국일) */
  labels?: [string, string];
  /** 같은 날 시작·종료 버튼 문구 (기본: 당일치기) */
  sameDayLabel?: string;
  /** 박 수 배지 표시 */
  showNights?: boolean;
}

export function DateRangePicker({
  start,
  end,
  onChange,
  placeholder = "기간 선택",
  labels = ["출발일", "귀국일"],
  sameDayLabel = "당일치기",
  showNights = true,
  min,
  max,
  defaultMonth,
  highlight,
  ariaLabel,
}: RangeProps) {
  const months: 1 | 2 = typeof window !== "undefined" && window.innerWidth < TWO_MONTHS_FROM ? 1 : 2;
  // 고르는 중인 상태: 닫힐 때(바깥 클릭 포함) 바로 읽어야 해서 ref로도 보관
  const sel = useRef({ phase: "start" as "start" | "end", a: "" });
  const [, rerender] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const titleId = useId();
  const { minD, isOff, clamp } = useLimits(min, max);

  const setSel = (phase: "start" | "end", a: string) => {
    sel.current = { phase, a };
    rerender((n) => n + 1);
  };

  const pop = usePopover<HTMLButtonElement, HTMLDivElement>({
    height: 420,
    width: months === 2 ? 600 : 300,
    sheetBelow: SHEET_BELOW,
    onClose: () => {
      // 다 고르지 않고 닫았을 때(바깥 클릭·Esc):
      // - 원래 기간이 비어 있었다면 고른 시작일만이라도 저장
      // - 이미 기간이 있었다면 취소로 보고 그대로 둠 (실수로 기존 기간이 지워지지 않게)
      const { phase, a } = sel.current;
      if (phase === "end" && a && a !== start && !end) onChange(a, "");
      sel.current = { phase: "start", a: "" };
      setHover(null);
    },
  });

  function open() {
    // 시작일만 있으면 종료일부터, 아니면 새로 시작일부터 고르기
    if (start && !end) setSel("end", start);
    else setSel("start", "");
    setCursor(clamp(parseDate(start) || parseDate(defaultMonth) || minD || new Date()));
    pop.show();
  }

  function commit(a: string, b: string) {
    sel.current = { phase: "start", a: "" }; // onClose에서 다시 저장하지 않도록 먼저 비움
    onChange(a, b);
    pop.close();
  }

  function pick(d: Date) {
    if (isOff(d)) return;
    const k = iso(d);
    const { phase, a } = sel.current;
    if (phase === "start" || !a || k < a) setSel("end", k);
    else commit(a, k);
  }

  const { phase, a } = sel.current;
  const picking = pop.open && phase === "end";
  // 화면에 그릴 범위: 고르는 중이면 시작일~마우스 위치, 아니면 저장된 값
  const A = picking ? a : start;
  const B = picking ? (hover && hover >= a ? hover : "") : end;

  const nights = start && end ? Math.round((parseDate(end)!.getTime() - parseDate(start)!.getTime()) / 864e5) : null;
  const sameYear = !!start && !!end && start.slice(0, 4) === end.slice(0, 4);
  const triggerText = start
    ? `${fmtDay(start)} – ${end ? (sameYear ? fmtDayShort(end) : fmtDay(end)) : labels[1] + " 선택"}`
    : placeholder;

  return (
    <PickerShell
      open={pop.open}
      pos={pop.pos}
      anchorRef={pop.anchorRef}
      popRef={pop.popRef}
      onOpen={open}
      onClose={pop.close}
      titleId={titleId}
      months={months}
      empty={!start}
      ariaLabel={ariaLabel ? `${ariaLabel}: ${start ? triggerText : "선택 안 함"}` : undefined}
      hint={
        picking ? (
          <>
            <b>{labels[1]}</b>을 고르세요 <span className="dp-hint-sub">· {fmtDay(a)} {labels[0]}</span>
          </>
        ) : (
          <>
            <b>{labels[0]}</b>을 고르세요
          </>
        )
      }
      trigger={
        <>
          <span className="dp-v">{triggerText}</span>
          {showNights && nights != null && nights >= 0 && (
            <span className="dp-badge">{nights === 0 ? sameDayLabel : `${nights}박 ${nights + 1}일`}</span>
          )}
        </>
      }
      footer={
        <>
          {picking && (
            <button type="button" className="dp-link" onClick={() => commit(a, a)}>
              {sameDayLabel}
            </button>
          )}
          {(start || end || picking) && (
            <button type="button" className="dp-link muted" onClick={() => commit("", "")}>
              지우기
            </button>
          )}
        </>
      }
    >
      <Calendar
        cursor={cursor}
        onCursor={setCursor}
        months={months}
        isOff={isOff}
        titleId={titleId}
        onPick={pick}
        onHover={setHover}
        classOf={(k) =>
          cx(
            (k === A || k === B) && "on",
            rangeClass(k, A, B, "range"),
            !inRange(k, A, B) && rangeClass(k, highlight?.start, highlight?.end, "hl"),
          )
        }
      />
    </PickerShell>
  );
}
