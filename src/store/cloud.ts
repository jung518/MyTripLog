/* =========================================================
 * 클라우드 저장소 (Supabase)
 * - 로그인: 이메일 + 비밀번호 (Supabase Auth)
 * - 여행 기록: trips 테이블 / 가고 싶은 곳: wishes 테이블 (각 행의 data 칸에 JSON 통째로 저장)
 * 테이블·보안 규칙은 supabase/schema.sql 을 Supabase SQL Editor에서 한 번 실행해 만듭니다.
 * ========================================================= */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config";
import { uid } from "../lib/format";
import { hideBanner, showBanner, toast } from "../lib/ui";
import type { BackupFile, Draft, Kind, Records, Trip, Wish } from "../types";
import { BaseStore, type TravelStore } from "./base";

interface Row<T> {
  id: string;
  data: Omit<T, "id">;
}

export class CloudStore extends BaseStore implements TravelStore {
  readonly mode = "cloud" as const;
  private sb: SupabaseClient;
  private loaded = false;

  constructor(config: AppConfig) {
    super();
    this.sb = createClient(config.supabaseUrl, config.supabaseKey);
  }

  async init() {
    this.sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        this.loaded = false;
        hideBanner();
        this.setState({ user: null, trips: [], wishes: [], needsAuth: true, loading: false });
      }
    });
    const { data } = await this.sb.auth.getSession();
    if (data?.session) {
      this.setState({ user: { id: data.session.user.id } });
      await this.load();
    } else {
      this.setState({ needsAuth: true, loading: false });
    }
    // 다른 기기에서 고친 내용을 탭으로 돌아올 때 다시 불러오기
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.state.user && this.loaded) void this.load(true);
    });
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.setState({ user: { id: data.user.id }, needsAuth: false });
    await this.load();
  }

  async signOut() {
    await this.sb.auth.signOut();
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
