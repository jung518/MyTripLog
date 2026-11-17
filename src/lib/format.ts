import { RATE_HINT } from "./data";
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

export const stars = (n: number) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");

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

export function toKRW(t: TripLike, amount: number | string | undefined, cur?: string): number {
  const a = Number(amount) || 0;
  if (!cur || cur === "KRW") return a;
  if (cur === t.currency) return a * (Number(t.rate) || RATE_HINT[cur] || 0);
  return a * (RATE_HINT[cur] || 0);
}

export function tripCost(t: TripLike): { total: number; byCat: Record<string, number> } {
  let total = 0;
  const byCat: Record<string, number> = {};
  (t.hotels || []).forEach((h) => {
    const v = toKRW(t, h.price, h.currency);
    total += v;
    byCat["숙박"] = (byCat["숙박"] || 0) + v;
  });
  (t.expenses || []).forEach((e) => {
    const v = toKRW(t, e.amount, e.currency);
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

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** 사진을 최대 1800px JPEG로 줄임 (실패하면 원본) */
export async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1800;
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * s);
    cv.height = Math.round(bmp.height * s);
    cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise<Blob>((r) => cv.toBlob((b) => r(b || file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}
