/* =========================================================
 * 로컬 저장소 (IndexedDB) - js/config.js에 Supabase 정보가 없을 때 사용
 * - trips   : 여행 기록
 * - wishes  : 가고 싶은 곳
 * - photos  : 사진 원본(Blob)  { id, blob, createdAt }
 * 데이터는 "이 브라우저"에 저장됩니다. 다른 기기로 옮길 때는 백업/복원을 쓰세요.
 * 나중에 Supabase 등 서버 저장소로 바꿀 때는 이 파일만 교체하면 됩니다.
 * ========================================================= */
const DB_NAME = "travel-map";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ["trips", "wishes", "photos"]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const LocalStore = {
  mode: "local",
  idb: null,
  trips: [],
  wishes: [],
  photoUrls: {},          // photoId -> objectURL (화면 표시용)
  listeners: [],

  emit() { this.listeners.forEach(f => f()); },
  onChange(f) { this.listeners.push(f); },

  async init() {
    try {
      this.idb = await openDB();
      // 브라우저가 저장공간을 임의로 비우지 않도록 요청 (지원 브라우저만)
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      this.trips = await this._all("trips");
      this.wishes = await this._all("wishes");
      const photos = await this._all("photos");
      photos.forEach(p => { this.photoUrls[p.id] = URL.createObjectURL(p.blob); });
    } catch (e) {
      console.error(e);
      showBanner("브라우저 저장소를 열 수 없어요. 시크릿 모드라면 일반 창에서 열어 주세요.");
    }
    this.emit();
  },

  _tx(name, mode = "readonly") { return this.idb.transaction(name, mode).objectStore(name); },
  _all(name) { return idbReq(this._tx(name).getAll()); },

  async save(kind, obj) {
    const id = obj.id || uid();
    const rec = { ...obj, id, updatedAt: new Date().toISOString() };
    try {
      await idbReq(this._tx(kind, "readwrite").put(rec));
    } catch (e) {
      toast("저장하지 못했어요. 저장 공간을 확인해 주세요.");
      throw e;
    }
    const arr = this[kind];
    const i = arr.findIndex(x => x.id === id);
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    this.emit();
    return id;
  },

  async remove(kind, id) {
    await idbReq(this._tx(kind, "readwrite").delete(id));
    this[kind] = this[kind].filter(x => x.id !== id);
    if (kind === "trips") await this.cleanupPhotos();
    this.emit();
  },

  /* ---------- 사진 ---------- */
  async addPhoto(blob) {
    const id = uid();
    await idbReq(this._tx("photos", "readwrite").put({ id, blob, createdAt: new Date().toISOString() }));
    this.photoUrls[id] = URL.createObjectURL(blob);
    return id;
  },
  photoUrl(id) { return this.photoUrls[id] || ""; },
  async getPhotoBlob(id) {
    const r = await idbReq(this._tx("photos").get(id));
    return r ? r.blob : null;
  },
  // 어떤 여행에도 연결되지 않은 사진 삭제
  async cleanupPhotos() {
    const used = new Set(this.trips.flatMap(t => (t.photos || []).map(p => p.id)));
    const all = await this._all("photos");
    for (const p of all) {
      if (!used.has(p.id)) {
        await idbReq(this._tx("photos", "readwrite").delete(p.id));
        URL.revokeObjectURL(this.photoUrls[p.id]);
        delete this.photoUrls[p.id];
      }
    }
  },

  /* ---------- 백업 / 복원 ---------- */
  async exportJSON(includePhotos) {
    const out = { app: "travel-map", version: 1, exportedAt: new Date().toISOString(), trips: this.trips, wishes: this.wishes, photos: [] };
    if (includePhotos) {
      const all = await this._all("photos");
      for (const p of all) out.photos.push({ id: p.id, dataUrl: await blobToDataURL(p.blob) });
    }
    return JSON.stringify(out);
  },
  async importJSON(text) {
    const d = JSON.parse(text);
    for (const p of d.photos || []) {
      const blob = await (await fetch(p.dataUrl)).blob();
      await idbReq(this._tx("photos", "readwrite").put({ id: p.id, blob, createdAt: new Date().toISOString() }));
      this.photoUrls[p.id] = URL.createObjectURL(blob);
    }
    for (const t of d.trips || []) await idbReq(this._tx("trips", "readwrite").put(t));
    for (const w of d.wishes || []) await idbReq(this._tx("wishes", "readwrite").put(w));
    this.trips = await this._all("trips");
    this.wishes = await this._all("wishes");
    this.emit();
    return (d.trips || []).length;
  }
};

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
