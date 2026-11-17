// Vercel Cron이 하루 한 번 호출합니다 (vercel.json 의 crons).
// 무료 Supabase 프로젝트는 일주일 동안 활동이 없으면 일시정지되므로, 매일 가벼운 요청을 보내 둡니다.
// Vercel → Project → Settings → Environment Variables 에 SUPABASE_URL, SUPABASE_KEY 를 넣어야 동작합니다.
import type { IncomingMessage, ServerResponse } from "node:http";

type VercelResponse = ServerResponse & { status(code: number): VercelResponse; json(body: unknown): void };

export default async function handler(_req: IncomingMessage, res: VercelResponse) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    res.status(200).json({ ok: false, reason: "SUPABASE_URL / SUPABASE_KEY 환경변수가 없어요" });
    return;
  }
  try {
    const r = await fetch(`${url}/rest/v1/trips?select=id&limit=1`, { headers: { apikey: key } });
    res.status(200).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e) });
  }
}
