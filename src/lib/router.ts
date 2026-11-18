/* =========================================================
 * 화면 주소: / (지도), /trips (여행 기록), /stats (통계)
 * - 주소 끝의 # 없이 실제 경로로 화면을 바꿉니다 (History API).
 * - 예전 주소(#map, #trips, #stats)로 들어오면 새 주소로 바꿔 줍니다.
 * - 배포(Vercel)에서는 vercel.json 의 rewrites 가 모든 경로를 index.html 로 보내야
 *   /trips 로 바로 들어오거나 새로고침해도 404가 나지 않습니다.
 * ========================================================= */
import { useEffect, useState, type MouseEvent } from "react";

export type View = "map" | "trips" | "stats";

const PATHS: Record<View, string> = { map: "/", trips: "/trips", stats: "/stats" };
const VIEWS = Object.keys(PATHS) as View[];

export const pathOf = (v: View) => PATHS[v];

/** 지금 주소의 화면. 모르는 주소는 지도 */
function readView(): View {
  const p = location.pathname.replace(/\/+$/, "") || "/";
  if (p === "/map") return "map";
  return VIEWS.find((v) => PATHS[v] === p) ?? "map";
}

/** 예전 # 주소(#trips 등)를 새 주소(/trips)로 바꿈 */
function migrateHashUrl() {
  const h = location.hash.slice(1) as View;
  if (VIEWS.includes(h)) history.replaceState(null, "", PATHS[h]);
}

/** 화면 이동 (페이지 새로고침 없이 주소만 바꿈) */
export function navigate(v: View) {
  if (location.pathname === PATHS[v]) return;
  history.pushState(null, "", PATHS[v]);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** 지금 화면을 상태로 돌려줌. 뒤로/앞으로 가기에도 반응 */
export function useView(): View {
  const [view, setView] = useState<View>(() => {
    migrateHashUrl();
    return readView();
  });
  useEffect(() => {
    const sync = () => setView(readView());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return view;
}

/**
 * 화면 이동 링크용 속성. <a {...linkTo("trips")}> 처럼 씀.
 * 그냥 누르면 새로고침 없이 이동하고, Ctrl/⌘·가운데 클릭은 새 탭으로 열림.
 */
export function linkTo(v: View) {
  return {
    href: PATHS[v],
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(v);
    },
  };
}

/* ---------- 약관 페이지: /terms (이용약관), /privacy (개인정보 처리방침) ----------
 * 로그인 여부와 상관없이 열리는 별도 페이지. 앱 화면 위를 덮어서 보여줌 */
export type LegalDoc = "terms" | "privacy";
const LEGAL_PATHS: Record<LegalDoc, string> = { terms: "/terms", privacy: "/privacy" };

function readLegal(): LegalDoc | null {
  const p = location.pathname.replace(/\/+$/, "");
  return p === "/terms" ? "terms" : p === "/privacy" ? "privacy" : null;
}

export function useLegal(): LegalDoc | null {
  const [doc, setDoc] = useState<LegalDoc | null>(readLegal);
  useEffect(() => {
    const sync = () => setDoc(readLegal());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return doc;
}

/** 약관 링크용 속성. <a {...legalLink("privacy")}>. replace = 약관 페이지 안에서 탭만 바꿀 때 (뒤로 가기 기록을 쌓지 않음) */
export function legalLink(doc: LegalDoc, replace = false) {
  return {
    href: LEGAL_PATHS[doc],
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (replace) history.replaceState(history.state, "", LEGAL_PATHS[doc]);
      else history.pushState({ legal: true }, "", LEGAL_PATHS[doc]);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  };
}

/** 약관 페이지 닫기: 앱 안에서 열었으면 뒤로 가기, 주소로 바로 들어왔으면 첫 화면으로 */
export function closeLegal() {
  if (history.state && (history.state as { legal?: boolean }).legal) history.back();
  else {
    history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
