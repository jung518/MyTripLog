/* =========================================================
 * 로컬 저장소 (IndexedDB) - src/config.ts에 Supabase 정보가 없을 때 사용
 * - trips   : 여행 기록
 * - wishes  : 가고 싶은 곳
 * 데이터는 "이 브라우저"에 저장됩니다. 다른 기기로 옮길 때는 백업/복원을 쓰세요.
 * ========================================================= */
import { uid } from "../lib/format";
import { showBanner, toast } from "../lib/ui";
import type { BackupFile, Draft, Kind, Records, Trip, Wish } from "../types";
import { BaseStore, type TravelStore } from "./base";

const DB_NAME = "travel-map";
const DB_VERSION = 1;
type StoreName = "trips" | "wishes";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ["trips", "wishes"]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class LocalStore extends BaseStore implements TravelStore {
  readonly mode = "local" as const;
  private idb: IDBDatabase | null = null;

  async init() {
    try {
      this.idb = await openDB();
      // 브라우저가 저장공간을 임의로 비우지 않도록 요청 (지원 브라우저만)
      navigator.storage?.persist?.().catch(() => {});
      const trips = await this.all<Trip>("trips");
      const wishes = await this.all<Wish>("wishes");
      this.setState({ trips, wishes, loading: false });
    } catch (e) {
      console.error(e);
      this.setState({ loading: false });
      showBanner("브라우저 저장소를 열 수 없어요. 시크릿 모드라면 일반 창에서 열어 주세요.");
    }
  }

  private tx(name: StoreName, mode: IDBTransactionMode = "readonly") {
    if (!this.idb) throw new Error("IndexedDB가 열려 있지 않아요");
    return this.idb.transaction(name, mode).objectStore(name);
  }
  private all<T>(name: StoreName): Promise<T[]> {
    return idbReq(this.tx(name).getAll()) as Promise<T[]>;
  }

  async save<K extends Kind>(kind: K, obj: Draft<K>): Promise<string> {
    const id = obj.id || uid();
    const rec = { ...obj, id, updatedAt: new Date().toISOString() } as Records[K];
    try {
      await idbReq(this.tx(kind, "readwrite").put(rec));
    } catch (e) {
      toast("저장하지 못했어요. 저장 공간을 확인해 주세요.");
      throw e;
    }
    this.putLocal(kind, rec);
    return id;
  }

  async remove(kind: Kind, id: string) {
    await idbReq(this.tx(kind, "readwrite").delete(id));
    this.dropLocal(kind, id);
  }

  /* ---------- 백업 / 복원 ---------- */
  async exportJSON() {
    return JSON.stringify(this.backupBase());
  }

  /** 예전 백업 파일에 photos가 들어 있어도 무시하고 여행·가고 싶은 곳만 불러옴 */
  async importJSON(text: string) {
    const d = JSON.parse(text) as Partial<BackupFile>;
    for (const t of d.trips || []) await idbReq(this.tx("trips", "readwrite").put(t));
    for (const w of d.wishes || []) await idbReq(this.tx("wishes", "readwrite").put(w));
    this.setState({ trips: await this.all<Trip>("trips"), wishes: await this.all<Wish>("wishes") });
    return (d.trips || []).length;
  }

  /* 로컬 모드에는 잠금이 없음 */
  async signIn() {}
  async signOut() {}
}
