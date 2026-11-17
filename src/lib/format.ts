import type { Trip, TripDraft } from "../types";

type TripLike = Trip | TripDraft;

export const won = (n: number) => Math.round(n || 0).toLocaleString("ko-KR") + "원";

export function wonShort(n: number): string {
  n = Math.round(n || 0);
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, "") + "억원";
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString("ko-KR") + "만원";
  return n.toLocaleString("ko-KR") + "원";
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);


export function daysBetween(a?: string, b?: string): number {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5);
}

export function tripDays(t: TripLike): number {
  return t.start && t.end ? daysBetween(t.start, t.end) + 1 : 0;
}

export function tripLen(t: TripLike): string {
  if (!t.start || !t.end) return "";
  const n = daysBetween(t.start, t.end);
  return n <= 0 ? "당일" : `${n}박 ${n + 1}일`;
}

export function fmtDate(d?: string): string {
  if (!d) return "";
  const [y, m, dd] = d.split("-");
  return `${y}.${m}.${dd}`;
}

export const tripYear = (t: TripLike) => (t.start ? t.start.slice(0, 4) : "");

/** 금액 칸 값을 숫자로 (빈 칸은 0). 모든 금액은 원(₩) */
export const amt = (v: number | string | undefined): number => Number(v) || 0;

export function tripCost(t: TripLike): { total: number; byCat: Record<string, number> } {
  let total = 0;
  const byCat: Record<string, number> = {};
  (t.hotels || []).forEach((h) => {
    const v = amt(h.price);
    total += v;
    byCat["숙박"] = (byCat["숙박"] || 0) + v;
  });
  (t.expenses || []).forEach((e) => {
    const v = amt(e.amount);
    total += v;
    const c = e.category || "기타";
    byCat[c] = (byCat[c] || 0) + v;
  });
  return { total, byCat };
}

export function tripCountries(t: TripLike): string[] {
  return [...new Set((t.cities || []).map((c) => c.cid).filter(Boolean))];
}

export const byStartDesc = (a: TripLike, b: TripLike) => (b.start || "").localeCompare(a.start || "");
export const byStartAsc = (a: TripLike, b: TripLike) => (a.start || "").localeCompare(b.start || "");

/* ---------- 여권 디자인 장식용 ---------- */

/** 도장에 찍을 짧은 날짜 (예: 25.03.14). 날짜가 없으면 --.--.-- */
export function stampDate(d?: string): string {
  if (!d) return "--.--.--";
  const [y, m, dd] = d.split("-");
  return `${y.slice(2)}.${m}.${dd}`;
}

/**
 * 여권 아래쪽 판독줄(MRZ)처럼 보이는 장식 문자열.
 * 예: P<392<<250314<<04D<<<<<<<<<<<<<<<<<<<<<<<<
 * 첫 나라 코드, 출발일(YYMMDD), 여행 일수로 만듦. 실제 의미는 없는 장식.
 */
export function mrzLine(t: TripLike): string {
  const ctry = tripCountries(t)[0] || "000";
  const start = t.start ? t.start.replace(/-/g, "").slice(2) : "<<<<<<";
  const days = String(tripDays(t) || 0).padStart(2, "0");
  return `P<${ctry}<<${start}<<${days}D`.padEnd(44, "<");
}
