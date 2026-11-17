import {
  forwardRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
  type TextareaHTMLAttributes,
} from "react";

/**
 * 글자 수 한도를 코드에서도 지키게 하는 도우미.
 * 브라우저 maxLength는 한글을 조합하는 동안에는 한도를 넘는 글자를 그대로 두기 때문에
 * (500자 칸에 501번째 글자가 조합 중으로 보임), 넘는 순간 바로 잘라냄.
 * 넘친 글자는 끝이 아니라 방금 입력한 자리(커서 바로 앞)에서 지워서
 * 문장 중간에 써도 뒤쪽 글자가 지워지지 않게 함.
 */
function trimOverflow(el: HTMLInputElement | HTMLTextAreaElement, max: number) {
  const over = el.value.length - max;
  if (over <= 0) return;
  const caret = el.selectionStart ?? el.value.length;
  const cut = Math.max(0, caret - over);
  el.value = el.value.slice(0, cut) + el.value.slice(cut + over);
  el.setSelectionRange(cut, cut);
}

function useMaxLength<E extends HTMLInputElement | HTMLTextAreaElement>(
  max: number | undefined,
  onChange: ((e: ChangeEvent<E>) => void) | undefined,
) {
  const emit = (e: SyntheticEvent<E>) => {
    if (max) trimOverflow(e.currentTarget, max);
    onChange?.(e as ChangeEvent<E>);
  };
  return {
    onChange: (e: ChangeEvent<E>) => emit(e),
    // 조합이 끝날 때 한 번 더 확인 (브라우저마다 마지막 input 이벤트 순서가 달라서)
    onCompositionEnd: (e: SyntheticEvent<E>) => {
      if (max && e.currentTarget.value.length > max) emit(e);
    },
  };
}

/** 라벨 + 입력칸 묶음 (label.f). span=2면 두 칸 차지 */
export function Field({
  label,
  hint,
  span,
  style,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  span?: 2 | "full";
  style?: CSSProperties;
  children: ReactNode;
}) {
  const col = span === 2 ? "span 2" : span === "full" ? "1 / -1" : undefined;
  return (
    <label className="f" style={{ ...(col ? { gridColumn: col } : null), ...style }}>
      <span className="f-label">{label}</span>
      {children}
      {hint && <span className="f-hint">{hint}</span>}
    </label>
  );
}

/** 입력칸 그리드 한 줄 (.frow) */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="frow">{children}</div>;
}

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** 왼쪽 아이콘 */
  icon?: ReactNode;
  /** 오른쪽 단위 글자 (예: 원) */
  suffix?: ReactNode;
  /** 값이 있을 때 지우기(✕) 버튼 */
  onClear?: () => void;
  invalid?: boolean;
  /** 바깥 상자에 줄 스타일 (grid 배치 등) */
  boxStyle?: CSSProperties;
  boxClassName?: string;
}

/** 글자 수가 한도의 몇 %부터 늘 보이게 할지 */
const COUNT_SHOW_FROM = 0.8;

/**
 * 앱 공통 한 줄 입력칸. 테두리·포커스·아이콘·단위·지우기 버튼을 한 상자로 묶음.
 * maxLength가 있으면 칸을 누르고 있을 때나 한도의 80%를 넘었을 때 "12/50" 글자 수를 보여줌.
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { icon, suffix, onClear, invalid, boxStyle, boxClassName, className, onFocus, onBlur, onChange, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const limit = useMaxLength<HTMLInputElement>(rest.type === "number" ? undefined : rest.maxLength, onChange);
  const hasValue = rest.value != null && String(rest.value) !== "";
  const max = rest.type === "number" ? undefined : rest.maxLength;
  const len = String(rest.value ?? "").length;
  const level = max ? (len >= max ? "full" : len >= max * 0.9 ? "near" : "") : "";
  const showCount = !!max && (focused || len >= max * COUNT_SHOW_FROM);
  return (
    <span
      className={["input", invalid && "invalid", level === "full" && "at-limit", rest.disabled && "disabled", boxClassName]
        .filter(Boolean)
        .join(" ")}
      style={boxStyle}
    >
      {icon && (
        <span className="input-ico" aria-hidden="true">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={className}
        aria-invalid={invalid || undefined}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
        {...limit}
      />
      {showCount && (
        <span className={"input-count" + (level ? " " + level : "")} aria-hidden="true">
          {len}/{max}
        </span>
      )}
      {max && level === "full" && focused && (
        <span className="sr-only" role="status">
          최대 {max}자까지 쓸 수 있어요
        </span>
      )}
      {onClear && hasValue && (
        <button
          type="button"
          className="input-clear"
          aria-label="지우기"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {suffix && <span className="input-suffix">{suffix}</span>}
    </span>
  );
});

/** 숫자 입력칸: 빈 칸은 "" 그대로, 숫자는 number로 */
export function NumberInput({
  value,
  onValue,
  ...rest
}: Omit<TextInputProps, "value" | "onChange" | "type"> & {
  value: number | "" | null | undefined;
  onValue: (v: number | "") => void;
}) {
  return (
    <TextInput
      type="number"
      inputMode="decimal"
      step="any"
      value={value ?? ""}
      onChange={(e) => onValue(e.target.value === "" ? "" : +e.target.value)}
      {...rest}
    />
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 다이어리 한 페이지 모양 (빨간 여백선 + 줄 노트 + 글자 수) */
  diary?: boolean;
}

/** 여러 줄 입력칸. 기본은 줄이 그어진 종이, diary면 일기장 페이지 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, diary, onChange, ...rest },
  ref,
) {
  const limit = useMaxLength<HTMLTextAreaElement>(rest.maxLength, onChange);
  const cls = ["textarea", diary && "diary", className].filter(Boolean).join(" ");
  if (!diary) return <textarea ref={ref} className={cls} {...rest} {...limit} />;
  const len = String(rest.value ?? "").length;
  const max = rest.maxLength;
  // 한도의 90%부터 금색, 꽉 차면 빨간색
  const level = max ? (len >= max ? "full" : len >= max * 0.9 ? "near" : "") : "";
  return (
    <span className="diary-box">
      <textarea ref={ref} className={cls} {...rest} {...limit} />
      <span className={"diary-count" + (level ? " " + level : "")} aria-hidden="true">
        {len.toLocaleString("ko-KR")}
        {max ? ` / ${max.toLocaleString("ko-KR")}` : ""}자
      </span>
      {/* 화면 읽기 프로그램에는 한도에 가까워졌을 때만 알려줌 */}
      {max && level && (
        <span className="sr-only" role="status">
          {level === "full" ? `최대 ${max}자까지 쓸 수 있어요` : `${max - len}자 남았어요`}
        </span>
      )}
    </span>
  );
});

const SearchIcon = (
  <svg viewBox="0 0 16 16">
    <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** 검색칸: 돋보기 아이콘 + 지우기 버튼 + Esc로 지우기 */
export const SearchInput = forwardRef<
  HTMLInputElement,
  Omit<TextInputProps, "onChange" | "value" | "icon"> & { value: string; onValue: (v: string) => void }
>(function SearchInput({ value, onValue, onKeyDown, ...rest }, ref) {
  return (
    <TextInput
      ref={ref}
      type="search"
      icon={SearchIcon}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      onClear={() => onValue("")}
      onKeyDown={(e) => {
        if (e.key === "Escape" && value) {
          e.stopPropagation();
          onValue("");
        }
        onKeyDown?.(e);
      }}
      autoComplete="off"
      {...rest}
    />
  );
});
