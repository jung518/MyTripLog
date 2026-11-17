/* =========================================================
 * 클라우드 저장소 (Supabase)
 * - 로그인: 이메일 + 비밀번호 (Supabase Auth)
 * - 여행 기록: trips 테이블 / 가고 싶은 곳: wishes 테이블 (각 행의 data 칸에 JSON 통째로 저장)
 * - 사진: Storage의 photos 버킷, 경로 = <사용자ID>/<사진ID>.jpg (비공개, 서명된 URL로 표시)
 * 테이블·버킷·보안 규칙은 supabase/schema.sql 을 Supabase SQL Editor에서 한 번 실행해 만듭니다.
 * ========================================================= */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config";
import { blobToDataURL, uid } from "../lib/format";
import { hideBanner, showBanner, toast } from "../lib/ui";
import type { BackupFile, Draft, Kind, Records, Trip, Wish } from "../types";
import { BaseStore, type TravelStore } from "./base";

const PHOTO_BUCKET = "photos";
const SIGNED_URL_SECONDS = 60 * 60 * 24; // 사진 주소 유효시간 24시간

interface Row<T> {
  id: string;
  data: Omit<T, "id">;
}

export class CloudStore extends BaseStore implements TravelStore {
  readonly mode = "cloud" as const;
  private sb: SupabaseClient;
  private loaded = false;
  private urlsAt = 0;

  constructor(config: AppConfig) {
    super();
    this.sb = createClient(config.supabaseUrl, config.supabaseKey);
  }

  private get userId(): string {
    if (!this.state.user) throw new Error("로그인이 필요해요");
    return this.state.user.id;
  }

  async init() {
    this.sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        this.loaded = false;
        this.photoUrls = {};
        hideBanner();
        this.setState({ user: null, trips: [], wishes: [], needsAuth: true });
      }
    });
    const { data } = await this.sb.auth.getSession();
    if (data?.session) {
      this.setState({ user: { id: data.session.user.id } });
      await this.load();
    } else {
      this.setState({ needsAuth: true });
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
    if (!quiet) showBanner("기록을 불러오는 중이에요…");
    const [t, w] = await Promise.all([
      this.sb.from("trips").select("id,data"),
      this.sb.from("wishes").select("id,data"),
    ]);
    const err = t.error || w.error;
    if (err) {
      showBanner("기록을 불러오지 못했어요: " + err.message);
      return;
    }
    const trips = (t.data as Row<Trip>[]).map((r) => ({ ...r.data, id: r.id }) as Trip);
    const wishes = (w.data as Row<Wish>[]).map((r) => ({ ...r.data, id: r.id }) as Wish);
    this.loaded = true;
    // 12시간 지나면 사진 주소 새로 받기
    if (Date.now() - this.urlsAt > SIGNED_URL_SECONDS * 500) this.photoUrls = {};
    await this.refreshPhotoUrls(trips);
    hideBanner();
    this.setState({ trips, wishes });
  }

  private path(id: string) {
    return `${this.userId}/${id}.jpg`;
  }

  private async refreshPhotoUrls(trips: Trip[]) {
    const ids = [...new Set(trips.flatMap((t) => (t.photos || []).map((p) => p.id)))].filter(
      (id) => !this.photoUrls[id],
    );
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data, error } = await this.sb.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(
          chunk.map((id) => this.path(id)),
          SIGNED_URL_SECONDS,
        );
      if (error || !data) continue;
      data.forEach((d, j) => {
        if (d.signedUrl) this.photoUrls[chunk[j]] = d.signedUrl;
      });
    }
    this.urlsAt = Date.now();
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
    if (kind === "trips") await this.cleanupPhotos();
  }

  /* ---------- 사진 ---------- */
  async addPhoto(blob: Blob): Promise<string> {
    const id = uid();
    const { error } = await this.sb.storage
      .from(PHOTO_BUCKET)
      .upload(this.path(id), blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    this.photoUrls[id] = URL.createObjectURL(blob);
    return id;
  }

  /** 어떤 여행에도 연결되지 않은 사진을 Storage에서 삭제 */
  async cleanupPhotos() {
    if (!this.loaded || !this.state.user) return;
    const used = this.usedPhotoIds();
    const { data, error } = await this.sb.storage.from(PHOTO_BUCKET).list(this.userId, { limit: 1000 });
    if (error || !data) return;
    const orphan = data.map((f) => f.name).filter((n) => n.endsWith(".jpg") && !used.has(n.slice(0, -4)));
    if (!orphan.length) return;
    await this.sb.storage.from(PHOTO_BUCKET).remove(orphan.map((n) => `${this.userId}/${n}`));
    orphan.forEach((n) => delete this.photoUrls[n.slice(0, -4)]);
  }

  /* ---------- 백업 / 복원 ---------- */
  async exportJSON(includePhotos: boolean) {
    const out = this.backupBase();
    if (includePhotos) {
      for (const id of this.usedPhotoIds()) {
        const { data, error } = await this.sb.storage.from(PHOTO_BUCKET).download(this.path(id));
        if (!error && data) out.photos.push({ id, dataUrl: await blobToDataURL(data) });
      }
    }
    return JSON.stringify(out);
  }

  /** 로컬 버전에서 받은 백업 파일도 그대로 불러올 수 있음 (사진 포함) */
  async importJSON(text: string) {
    const d = JSON.parse(text) as Partial<BackupFile>;
    for (const p of d.photos || []) {
      const blob = await (await fetch(p.dataUrl)).blob();
      const { error } = await this.sb.storage
        .from(PHOTO_BUCKET)
        .upload(this.path(p.id), blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
    }
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
