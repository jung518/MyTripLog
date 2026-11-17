/* =========================================================
 * Supabase 연결 정보
 * Supabase 대시보드 → Project Settings → API (또는 Connect 버튼)에서 복사해 넣으세요.
 *  - supabaseUrl : Project URL        예) https://abcdefghijkl.supabase.co
 *  - supabaseKey : anon public 키 또는 publishable 키 (sb_publishable_...)
 *  - ownerEmail  : Supabase Authentication → Users 에 만든 내 계정 이메일
 *                  (화면에는 비밀번호만 묻고, 이메일은 여기 값을 씁니다)
 * 이 두 값은 브라우저에 공개돼도 되는 값이에요. 데이터는 로그인한 본인만 볼 수 있게
 * supabase/schema.sql 의 보안 규칙(RLS)이 막아 줍니다.
 * ⚠️ service_role / secret 키는 절대 여기에 넣지 마세요.
 *
 * 두 값을 비워 두면 로컬 모드(이 브라우저에만 저장)로 동작합니다.
 * ========================================================= */
window.TRAVEL_MAP_CONFIG = {
  supabaseUrl: "",
  supabaseKey: "",
  ownerEmail: ""
};
