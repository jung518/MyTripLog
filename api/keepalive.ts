// Vercel Cron이 하루 한 번 호출합니다 (vercel.json 의 crons).
// 무료 Supabase 프로젝트는 일주일 동안 활동이 없으면 일시정지되므로, 매일 가벼운 요청을 보내 둡니다.
// Vercel → Project → Settings → Environment Variables 에 SUPABASE_URL, SUPABASE_KEY 를 넣어야 동작합니다.
//
// 표준 웹 방식(Request/Response)으로 작성해서 Node 전용 타입(@types/node)이 필요 없습니다.
// (Vercel 함수 빌더가 TypeScript 7 환경에서 Node 타입을 못 찾아 배포가 실패하던 문제를 피함)

// Vercel 서버(Node.js)에 있는 환경 변수 객체. Node 타입 없이 필요한 부분만 선언
declare const process: { env: Record<string, string | undefined> };

export async function GET(): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, reason: "SUPABASE_URL / SUPABASE_KEY 환경변수가 없어요" });
  }
  try {
    const r = await fetch(`${url}/rest/v1/trips?select=id&limit=1`, { headers: { apikey: key } });
    return Response.json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) });
  }
}
