/* =========================================================
 * ★ Supabase 주소, 공개 키, 내 계정 이메일
 * - 비워 두면 로컬 모드(이 브라우저의 IndexedDB에만 저장)로 동작합니다.
 * - .env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_KEY / VITE_OWNER_EMAIL 을 넣으면 그 값이 우선합니다.
 * - 이 키는 브라우저에 공개돼도 되는 publishable(anon) 키입니다. service_role / secret 키는 절대 넣지 마세요.
 * ========================================================= */
export interface AppConfig {
  supabaseUrl: string;
  supabaseKey: string;
  ownerEmail: string;
}

export const CONFIG: AppConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "https://zzqcyatsskbjamjasvqg.supabase.co",
  supabaseKey: import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_7rctZvNa-dlRu6sECanRSg_4jxSRhhb",
  ownerEmail: import.meta.env.VITE_OWNER_EMAIL ?? "wjddndus0518@naver.com",
};
