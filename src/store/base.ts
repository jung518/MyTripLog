import type { BackupFile, Draft, Kind, Records, Trip, Wish } from "../types";

export interface StoreState {
  trips: Trip[];
  wishes: Wish[];
  /** 클라우드 모드에서 로그인한 사용자 (로컬 모드는 항상 null) */
  user: { id: string } | null;
  /** 클라우드 모드에서 잠금 화면(비밀번호)이 필요한지 */
  needsAuth: boolean;
}

/** LocalStore(IndexedDB)와 CloudStore(Supabase)가 공통으로 따르는 저장소 인터페이스 */
export interface TravelStore {
  readonly mode: "local" | "cloud";
  getState(): StoreState;
  subscribe(listener: () => void): () => void;
  init(): Promise<void>;
  save<K extends Kind>(kind: K, obj: Draft<K>): Promise<string>;
  remove(kind: Kind, id: string): Promise<void>;
  addPhoto(blob: Blob): Promise<string>;
  photoUrl(id: string): string;
  cleanupPhotos(): Promise<void>;
  exportJSON(includePhotos: boolean): Promise<string>;
  importJSON(text: string): Promise<number>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

export abstract class BaseStore {
  protected state: StoreState = { trips: [], wishes: [], user: null, needsAuth: false };
  /** photoId -> 화면 표시용 URL */
  protected photoUrls: Record<string, string> = {};
  private listeners = new Set<() => void>();

  getState = (): StoreState => this.state;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  protected setState(p: Partial<StoreState>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  }

  photoUrl(id: string): string {
    return this.photoUrls[id] || "";
  }

  /** 메모리 목록에 레코드를 넣거나 교체 */
  protected putLocal<K extends Kind>(kind: K, rec: Records[K]) {
    const arr = this.state[kind] as Records[K][];
    const i = arr.findIndex((x) => x.id === rec.id);
    const next = i >= 0 ? arr.map((x, j) => (j === i ? rec : x)) : [...arr, rec];
    this.setState({ [kind]: next } as Partial<StoreState>);
  }

  protected dropLocal(kind: Kind, id: string) {
    const arr = this.state[kind] as { id: string }[];
    this.setState({ [kind]: arr.filter((x) => x.id !== id) } as Partial<StoreState>);
  }

  protected usedPhotoIds(): Set<string> {
    return new Set(this.state.trips.flatMap((t) => (t.photos || []).map((p) => p.id)));
  }

  protected backupBase(): BackupFile {
    return {
      app: "travel-map",
      version: 1,
      exportedAt: new Date().toISOString(),
      trips: this.state.trips,
      wishes: this.state.wishes,
      photos: [],
    };
  }
}
