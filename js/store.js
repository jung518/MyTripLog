/* 설정이 있으면 Supabase(클라우드), 없으면 브라우저(로컬) 저장소를 씁니다. */
const Store = (() => {
  const c = window.TRAVEL_MAP_CONFIG || {};
  if (c.supabaseUrl && c.supabaseKey && window.supabase) return CloudStore;
  return LocalStore;
})();
