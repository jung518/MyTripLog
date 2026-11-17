/* =========================================================
 * 클라우드 저장소 (Supabase)
 * - 로그인: 이메일 + 비밀번호 (Supabase Auth)
 * - 여행 기록: trips 테이블 / 가고 싶은 곳: wishes 테이블 (각 행의 data 칸에 JSON 통째로 저장)
 * - 사진: Storage의 photos 버킷, 경로 = <사용자ID>/<사진ID>.jpg (비공개, 서명된 URL로 표시)
 * 테이블·버킷·보안 규칙은 supabase/schema.sql 을 Supabase SQL Editor에서 한 번 실행해 만듭니다.
 * LocalStore(js/store-local.js)와 같은 함수 이름을 써서 app.js는 그대로 동작합니다.
 * ========================================================= */
const PHOTO_BUCKET = "photos";
const SIGNED_URL_SECONDS = 60 * 60 * 24; // 사진 주소 유효시간 24시간

const CloudStore = {
  mode: "cloud",
  sb: null,
  user: null,
  loaded: false,
  trips: [],
  wishes: [],
  photoUrls: {},   // photoId -> 표시용 URL
  urlsAt: 0,
  listeners: [],

  emit() { this.listeners.forEach(f => f()); },
  onChange(f) { this.listeners.push(f); },

  async init() {
    const c = window.TRAVEL_MAP_CONFIG;
    this.sb = window.supabase.createClient(c.supabaseUrl, c.supabaseKey);
    this.sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        this.user = null; this.loaded = false;
        this.trips = []; this.wishes = []; this.photoUrls = {};
        this.emit(); showAuth();
      }
    });
    const { data } = await this.sb.auth.getSession();
    if (data && data.session) {
      this.user = data.session.user;
      await this.load();
    } else {
      showAuth();
    }
    // 다른 기기에서 고친 내용을 탭으로 돌아올 때 다시 불러오기
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.user && this.loaded) this.load(true);
    });
    this.emit();
  },

  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    await this.load();
  },

  async signOut() { await this.sb.auth.signOut(); },

  async load(quiet) {
    if (!quiet) showBanner("기록을 불러오는 중이에요…");
    const [t, w] = await Promise.all([
      this.sb.from("trips").select("id,data"),
      this.sb.from("wishes").select("id,data"),
    ]);
    const err = t.error || w.error;
    if (err) { showBanner("기록을 불러오지 못했어요: " + esc(err.message)); return; }
    this.trips = t.data.map(r => ({ ...r.data, id: r.id }));
    this.wishes = w.data.map(r => ({ ...r.data, id: r.id }));
    this.loaded = true;
    if (Date.now() - this.urlsAt > SIGNED_URL_SECONDS * 500) { this.photoUrls = {}; } // 12시간 지나면 주소 새로 받기
    await this.refreshPhotoUrls();
    hideBanner();
    this.emit();
  },

  path(id) { return `${this.user.id}/${id}.jpg`; },

  async refreshPhotoUrls() {
    const ids = [...new Set(this.trips.flatMap(t => (t.photos || []).map(p => p.id)))].filter(id => !this.photoUrls[id]);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data, error } = await this.sb.storage.from(PHOTO_BUCKET).createSignedUrls(chunk.map(id => this.path(id)), SIGNED_URL_SECONDS);
      if (error || !data) continue;
      data.forEach((d, j) => { if (d.signedUrl) this.photoUrls[chunk[j]] = d.signedUrl; });
    }
    this.urlsAt = Date.now();
  },

  async save(kind, obj) {
    const id = obj.id || uid();
    const rec = { ...obj, id, updatedAt: new Date().toISOString() };
    const body = { ...rec }; delete body.id;
    const { error } = await this.sb.from(kind).upsert({ id, data: body, updated_at: rec.updatedAt });
    if (error) { toast("저장하지 못했어요: " + error.message); throw error; }
    const arr = this[kind];
    const i = arr.findIndex(x => x.id === id);
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    this.emit();
    return id;
  },

  async remove(kind, id) {
    const { error } = await this.sb.from(kind).delete().eq("id", id);
    if (error) { toast("삭제하지 못했어요: " + error.message); throw error; }
    this[kind] = this[kind].filter(x => x.id !== id);
    if (kind === "trips") await this.cleanupPhotos();
    this.emit();
  },

  /* ---------- 사진 ---------- */
  async addPhoto(blob) {
    const id = uid();
    const { error } = await this.sb.storage.from(PHOTO_BUCKET).upload(this.path(id), blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    this.photoUrls[id] = URL.createObjectURL(blob);
    return id;
  },
  photoUrl(id) { return this.photoUrls[id] || ""; },

  // 어떤 여행에도 연결되지 않은 사진을 Storage에서 삭제
  async cleanupPhotos() {
    if (!this.loaded || !this.user) return;
    const used = new Set(this.trips.flatMap(t => (t.photos || []).map(p => p.id)));
    const { data, error } = await this.sb.storage.from(PHOTO_BUCKET).list(this.user.id, { limit: 1000 });
    if (error || !data) return;
    const orphan = data.map(f => f.name).filter(n => n.endsWith(".jpg") && !used.has(n.slice(0, -4)));
    if (!orphan.length) return;
    await this.sb.storage.from(PHOTO_BUCKET).remove(orphan.map(n => `${this.user.id}/${n}`));
    orphan.forEach(n => delete this.photoUrls[n.slice(0, -4)]);
  },

  /* ---------- 백업 / 복원 ---------- */
  async exportJSON(includePhotos) {
    const out = { app: "travel-map", version: 1, exportedAt: new Date().toISOString(), trips: this.trips, wishes: this.wishes, photos: [] };
    if (includePhotos) {
      const ids = [...new Set(this.trips.flatMap(t => (t.photos || []).map(p => p.id)))];
      for (const id of ids) {
        const { data, error } = await this.sb.storage.from(PHOTO_BUCKET).download(this.path(id));
        if (!error && data) out.photos.push({ id, dataUrl: await blobToDataURL(data) });
      }
    }
    return JSON.stringify(out);
  },

  // 로컬 버전에서 받은 백업 파일도 그대로 불러올 수 있음 (사진 포함)
  async importJSON(text) {
    const d = JSON.parse(text);
    for (const p of d.photos || []) {
      const blob = await (await fetch(p.dataUrl)).blob();
      const { error } = await this.sb.storage.from(PHOTO_BUCKET).upload(this.path(p.id), blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
    }
    const rows = kind => (d[kind] || []).map(r => { const body = { ...r }; delete body.id; return { id: r.id, data: body, updated_at: r.updatedAt || new Date().toISOString() }; });
    for (const kind of ["trips", "wishes"]) {
      const list = rows(kind);
      if (!list.length) continue;
      const { error } = await this.sb.from(kind).upsert(list);
      if (error) throw error;
    }
    await this.load(true);
    return (d.trips || []).length;
  }
};
