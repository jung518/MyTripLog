/* =========================================================
 * 클라우드 저장소 (Supabase)
 * - 로그인: 이메일 + 비밀번호 + 메일 인증 (Supabase Auth). 누구나 가입해서 자기 기록만 씀
 *   인증·비밀번호 재설정 메일의 링크는 이 앱 주소로 돌아옴 (주소 끝 #access_token=...&type=signup|recovery)
 *   다른 사람 기록은 테이블 보안 규칙(RLS: user_id = 로그인한 사람)이 막아 줌
 * - 여행 기록: trips 테이블 / 가고 싶은 곳: wishes 테이블 (각 행의 data 칸에 JSON 통째로 저장)
 * 테이블·보안 규칙은 supabase/schema.sql 을 Supabase SQL Editor에서 한 번 실행해 만듭니다.
 * ========================================================= */
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { AppConfig } from "../config";
import { uid } from "../lib/format";
import { hideBanner, showBanner, toast } from "../lib/ui";
import type { BackupFile, Draft, Kind, Records, Trip, Wish } from "../types";
import { BaseStore, type TravelStore } from "./base";

/** Supabase 로그인 오류를 쉬운 한국어로 */
export function authErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(msg)) return "이메일 또는 비밀번호가 일치하지 않습니다.";
  if (/already registered|already been registered|already exists/i.test(msg)) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (/password should be at least|password.*(short|length)/i.test(msg)) return "비밀번호는 6자 이상이어야 해요.";
  if (/weak.?password/i.test(msg)) return "비밀번호가 너무 쉬워요. 더 길거나 복잡하게 만들어 주세요.";
  if (/signups? not allowed|signup.*disabled/i.test(msg)) return "지금은 새 가입을 받지 않아요.";
  if (/email not confirmed/i.test(msg)) return "이메일 인증이 아직 안 됐어요. 받은 메일의 링크를 눌러 주세요.";
  if (/different from the old password|same.*password/i.test(msg)) return "이전과 다른 비밀번호를 써 주세요.";
  if (/email rate limit|over_email_send_rate_limit/i.test(msg)) return "메일을 너무 자주 보냈어요. 잠시 뒤에 다시 해 주세요.";
  if (/error sending|smtp/i.test(msg)) return "메일을 보내지 못했어요. 잠시 뒤에 다시 해 주세요.";
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(msg)) return "이메일 주소를 확인해 주세요.";
  if (/rate limit|too many/i.test(msg)) return "시도가 너무 많았어요. 잠시 뒤에 다시 해 주세요.";
  if (/failed to fetch|network/i.test(msg)) return "인터넷 연결을 확인해 주세요.";
  return "문제가 생겼어요: " + msg;
}

/** Supabase 사용자 → 앱에서 쓰는 사용자 정보 (닉네임은 계정의 user_metadata에 저장) */
function toUser(u: User, fallbackEmail = "") {
  const nick = (u.user_metadata as { nickname?: unknown } | undefined)?.nickname;
  return { id: u.id, email: u.email || fallbackEmail, nickname: typeof nick === "string" ? nick : "" };
}

interface Row<T> {
  id: string;
  data: Omit<T, "id">;
}

export class CloudStore extends BaseStore implements TravelStore {
  readonly mode = "cloud" as const;
  private sb: SupabaseClient;
  private loaded = false;

  /** 메일 링크로 들어왔을 때 주소 끝(#...)에 붙어 온 정보. Supabase가 읽고 지우기 전에 먼저 챙겨 둠 */
  private link: { type: string; error: string };

  constructor(config: AppConfig) {
    super();
    const h = new URLSearchParams(location.hash.slice(1));
    this.link = { type: h.get("type") || "", error: h.get("error_description") || h.get("error") || "" };
    this.sb = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /** 메일 링크가 돌아올 주소 (배포 주소든 localhost든 지금 연 곳) */
  private get redirectTo() {
    return location.origin + "/";
  }

  async init() {
    this.sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        this.loaded = false;
        hideBanner();
        this.setState({ user: null, trips: [], wishes: [], needsAuth: true, loading: false, recovery: false });
      }
      if (event === "PASSWORD_RECOVERY") this.setState({ recovery: true });
    });
    const { data } = await this.sb.auth.getSession();
    if (data?.session) {
      const recovery = this.link.type === "recovery";
      this.setState({ user: toUser(data.session.user), recovery });
      if (this.link.type === "signup") toast("이메일 인증이 끝났어요");
      await this.load();
    } else {
      this.setState({ needsAuth: true, loading: false });
      // 링크가 만료됐거나 이미 쓴 링크
      if (this.link.error)
        showBanner(
          /expired|invalid/i.test(this.link.error)
            ? "메일의 링크가 만료됐거나 이미 사용됐어요. 다시 요청해 주세요."
            : "메일 링크로 로그인하지 못했어요: " + this.link.error,
        );
    }
    // 메일 링크 정보(#access_token=… / #error=…)를 주소창에서 지움 (Supabase가 남기는 빈 # 포함)
    if (this.link.type || this.link.error || location.href.endsWith("#"))
      history.replaceState(null, "", location.pathname + location.search);
    // 다른 기기에서 고친 내용을 탭으로 돌아올 때 다시 불러오기
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.state.user && this.loaded) void this.load(true);
    });
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.setState({ user: toUser(data.user, email), needsAuth: false });
    await this.load();
  }

  async signUp(email: string, password: string, nickname: string) {
    const { data, error } = await this.sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: this.redirectTo, data: { nickname } },
    });
    if (error) throw error;
    // 이미 있는 이메일이면 Supabase가 오류 대신 빈 identities를 돌려줌 (가입 여부를 숨기려고)
    if (data.user && data.user.identities && data.user.identities.length === 0)
      throw new Error("User already registered");
    // 메일 인증이 켜져 있으면 세션 없이 돌아옴 → 메일의 링크를 눌러야 가입 완료
    if (!data.session || !data.user) return "confirm" as const;
    this.setState({ user: toUser(data.user, email), needsAuth: false });
    await this.load();
    return "done" as const;
  }

  async updateNickname(nickname: string) {
    const { data, error } = await this.sb.auth.updateUser({ data: { nickname } });
    if (error) throw error;
    if (data.user) this.setState({ user: toUser(data.user) });
  }

  async resendSignup(email: string) {
    const { error } = await this.sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: this.redirectTo } });
    if (error) throw error;
  }

  async sendPasswordReset(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: this.redirectTo });
    if (error) throw error;
  }

  async updatePassword(password: string) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw error;
    this.setState({ recovery: false });
  }

  async refresh() {
    if (this.state.user) await this.load(true);
  }

  async signOut() {
    // 이 기기에서만 로그아웃 (다른 기기의 로그인은 유지)
    await this.sb.auth.signOut({ scope: "local" });
  }

  async deleteAccount() {
    const { error } = await this.sb.rpc("delete_my_account");
    if (error) {
      // SQL 함수를 아직 안 만든 경우
      if (/delete_my_account|function|not find|PGRST202/i.test(error.message + (error.code || "")))
        throw new Error("탈퇴 기능이 아직 준비되지 않았어요. 운영자에게 문의해 주세요.");
      throw error;
    }
    await this.sb.auth.signOut({ scope: "local" });
  }

  private async load(quiet = false) {
    if (!quiet) this.setState({ loading: true });
    const [t, w] = await Promise.all([
      this.sb.from("trips").select("id,data"),
      this.sb.from("wishes").select("id,data"),
    ]);
    const err = t.error || w.error;
    if (err) {
      this.setState({ loading: false });
      showBanner("기록을 불러오지 못했어요: " + err.message);
      return;
    }
    const trips = (t.data as Row<Trip>[]).map((r) => ({ ...r.data, id: r.id }) as Trip);
    const wishes = (w.data as Row<Wish>[]).map((r) => ({ ...r.data, id: r.id }) as Wish);
    this.loaded = true;
    hideBanner();
    this.setState({ trips, wishes, loading: false });
  }

  async save<K extends Kind>(kind: K, obj: Draft<K>): Promise<string> {
    const id = obj.id || uid();
    const rec = { ...obj, id, updatedAt: new Date().toISOString() } as Records[K];
    const { id: _omit, ...body } = rec;
    void _omit;
    const { error } = await this.sb.from(kind).upsert({ id, data: body, updated_at: rec.updatedAt });
    if (error) {
      toast("저장하지 못했어요: " + error.message);
      throw error;
    }
    this.putLocal(kind, rec);
    return id;
  }

  async remove(kind: Kind, id: string) {
    const { error } = await this.sb.from(kind).delete().eq("id", id);
    if (error) {
      toast("삭제하지 못했어요: " + error.message);
      throw error;
    }
    this.dropLocal(kind, id);
  }

  /* ---------- 백업 / 복원 ---------- */
  async exportJSON() {
    return JSON.stringify(this.backupBase());
  }

  /** 로컬 버전에서 받은 백업 파일도 그대로 불러올 수 있음 (예전 파일의 photos는 무시) */
  async importJSON(text: string) {
    const d = JSON.parse(text) as Partial<BackupFile>;
    for (const kind of ["trips", "wishes"] as const) {
      const list = (d[kind] || []).map((r: Trip | Wish) => {
        const { id, ...body } = r;
        return { id, data: body, updated_at: r.updatedAt || new Date().toISOString() };
      });
      if (!list.length) continue;
      const { error } = await this.sb.from(kind).upsert(list);
      if (error) throw error;
    }
    await this.load(true);
    return (d.trips || []).length;
  }
}
