import type { BackupFile, Draft, Kind, Records, Trip, Wish } from "../types";

export interface StoreState {
  trips: Trip[];
  wishes: Wish[];
  /** 클라우드 모드에서 로그인한 사용자 (로컬 모드는 항상 null) */
  user: { id: string; email: string; /** 없으면 "" (예전 계정) */ nickname: string } | null;
  /** 클라우드 모드에서 로그인 화면이 필요한지 */
  needsAuth: boolean;
  /** 기록을 불러오는 중 (앱 시작, 로그인 직후) */
  loading: boolean;
  /** 비밀번호 재설정 메일의 링크로 들어옴 → 새 비밀번호를 정해야 함 */
  recovery: boolean;
}

/** LocalStore(IndexedDB)와 CloudStore(Supabase)가 공통으로 따르는 저장소 인터페이스 */
export interface TravelStore {
  readonly mode: "local" | "cloud";
  getState(): StoreState;
  subscribe(listener: () => void): () => void;
  init(): Promise<void>;
  /** 저장된 기록을 다시 불러오기 (화면 당겨서 새로고침). 로딩 화면은 띄우지 않음 */
  refresh(): Promise<void>;
  save<K extends Kind>(kind: K, obj: Draft<K>): Promise<string>;
  remove(kind: Kind, id: string): Promise<void>;
  exportJSON(): Promise<string>;
  importJSON(text: string): Promise<number>;
  signIn(email: string, password: string): Promise<void>;
  /**
   * 새 계정 만들기.
   * "confirm" = 인증 메일을 보냄 (메일의 링크를 눌러야 가입 완료), "done" = 바로 로그인됨 (메일 인증을 꺼 둔 경우)
   */
  signUp(email: string, password: string, nickname: string): Promise<"confirm" | "done">;
  /** 닉네임 바꾸기 */
  updateNickname(nickname: string): Promise<void>;
  /** 가입 인증 메일 다시 보내기 */
  resendSignup(email: string): Promise<void>;
  /** 비밀번호 재설정 메일 보내기 */
  sendPasswordReset(email: string): Promise<void>;
  /** 새 비밀번호 저장 (재설정 링크로 들어온 뒤) */
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  /** 회원 탈퇴: 계정과 모든 기록을 지움 (Supabase에 delete_my_account 함수 필요) */
  deleteAccount(): Promise<void>;
}

export abstract class BaseStore {
  protected state: StoreState = { trips: [], wishes: [], user: null, needsAuth: false, loading: true, recovery: false };
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

  protected backupBase(): BackupFile {
    return {
      app: "travel-map",
      version: 1,
      exportedAt: new Date().toISOString(),
      trips: this.state.trips,
      wishes: this.state.wishes,
    };
  }
}
