/* =========================================================
 * ★ Supabase 주소, 공개 키, 내 계정 이메일
 * - 비워 두면 로컬 모드(이 브라우저의 IndexedDB에만 저장)로 동작합니다.
 * - 값은 .env.local 에 넣습니다 (.env.example 참고). 배포(Vercel)에는 같은 이름으로 환경 변수를 등록하세요.
 * - 공개 저장소이므로 이 파일에 실제 값을 직접 적지 마세요.
 * - 이 키는 브라우저에 공개돼도 되는 publishable(anon) 키입니다. service_role / secret 키는 절대 넣지 마세요.
 * ========================================================= */
export interface AppConfig {
  supabaseUrl: string;
  supabaseKey: string;
  ownerEmail: string;
}

export const CONFIG: AppConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseKey: import.meta.env.VITE_SUPABASE_KEY ?? "",
  ownerEmail: import.meta.env.VITE_OWNER_EMAIL ?? "",
};
