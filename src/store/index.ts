/* 설정이 있으면 Supabase(클라우드), 없으면 브라우저(로컬) 저장소를 씁니다. */
import { useSyncExternalStore } from "react";
import { CONFIG } from "../config";
import type { TravelStore } from "./base";
import { CloudStore } from "./cloud";
import { LocalStore } from "./local";

export type { StoreState, TravelStore } from "./base";

export const store: TravelStore =
  CONFIG.supabaseUrl && CONFIG.supabaseKey ? new CloudStore(CONFIG) : new LocalStore();

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.getState);
}
