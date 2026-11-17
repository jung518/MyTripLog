/* 토스트·배너처럼 저장소(store)에서도 띄워야 하는 화면 알림 상태 */
import { useSyncExternalStore } from "react";

interface UiState {
  toast: string;
  toastOn: boolean;
  banner: string | null;
}

let state: UiState = { toast: "", toastOn: false, banner: null };
const listeners = new Set<() => void>();

function set(p: Partial<UiState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

let toastTimer: number | undefined;
export function toast(msg: string) {
  set({ toast: msg, toastOn: true });
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => set({ toastOn: false }), 2200);
}

export const showBanner = (msg: string) => set({ banner: msg });
export const hideBanner = () => set({ banner: null });

export const useUi = () => useSyncExternalStore(subscribe, () => state);
