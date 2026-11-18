import { Analytics } from "@vercel/analytics/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccountMenu } from "./components/AccountMenu";
import { AuthModal } from "./components/AuthModal";
import { BackupModal } from "./components/BackupModal";
import { Landing } from "./components/Landing";
import { LegalPage } from "./components/LegalPage";
import { NicknameModal } from "./components/NicknameModal";
import { MapView, type MapHandle } from "./components/MapView";
import { PullToRefresh } from "./components/PullToRefresh";
import { SidePanel } from "./components/SidePanel";
import { StatsView } from "./components/StatsView";
import { TripDetail } from "./components/TripDetail";
import { TripEditor, type EditorRequest } from "./components/TripEditor";
import { TripsView } from "./components/TripsView";
import { Button, ConfirmModal, LoadingScreen } from "./components/ui";
import { WishModal } from "./components/WishModal";
import { tripYear } from "./lib/format";
import { loadCountries, type CountryFeature } from "./lib/geo";
import { linkTo, navigate as go, useLegal, useView, type View } from "./lib/router";
import { showBanner, toast, useUi } from "./lib/ui";
import { store, useStore } from "./store";

interface PickState {
  text: string;
  cb: (lat: number, lng: number) => void;
}

let started = false;

/** 하단 탭 바 아이콘 */
const TAB_ICONS: Record<View, ReactNode> = {
  map: (
    <svg viewBox="0 0 24 24">
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 4v14M15 6v14" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  trips: (
    <svg viewBox="0 0 24 24">
      <rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.8 10.5h6.4M12 7.3v6.4" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path d="M9 17h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24">
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="6" y="11" width="3" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="6" width="3" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="16" y="13" width="3" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

export function App() {
  const { trips, wishes, user, needsAuth, loading, recovery } = useStore();
  const ui = useUi();
  const view = useView();
  const legal = useLegal();
  const mapRef = useRef<MapHandle>(null);
  const headerRef = useRef<HTMLElement>(null);

  // 지도 화면이 헤더 아래를 꽉 채우도록 헤더 실제 높이를 CSS 변수(--header-h)로 알려줌
  // (글자 크기나 화면 폭 때문에 헤더 높이가 바뀌어도 맞춰짐)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--header-h", el.offsetHeight + "px");
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [year, setYear] = useState("");
  const [tripCountry, setTripCountry] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; session: number; req: EditorRequest }>({
    open: false,
    session: 0,
    req: { trip: null },
  });
  const [wish, setWish] = useState({ open: false, session: 0 });
  const [backupOpen, setBackupOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nickOpen, setNickOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 로그인하기 전 첫 화면 (클라우드 모드). 비밀번호 재설정 링크로 들어온 경우는 바로 새 비밀번호 창
  const landing = store.mode === "cloud" && needsAuth && !recovery;
  const [authTab, setAuthTab] = useState<"login" | "signup" | null>(null);
  useEffect(() => {
    if (!landing) setAuthTab(null);
  }, [landing]);
  const [pick, setPick] = useState<PickState | null>(null);

  /* ---------- 시작: 지도 데이터 + 저장소 ---------- */
  useEffect(() => {
    if (started) return;
    started = true;
    loadCountries()
      .then(setFeatures)
      .catch(() => showBanner("지도 데이터를 불러오지 못했어요."))
      .finally(() => setMapReady(true));
    void store.init().then(() => {
      if (store.mode === "local")
        showBanner(
          "로컬 모드: 이 브라우저에만 저장돼요. 여러 기기에서 쓰려면 .env.local에 Supabase 정보를 넣으세요 (.env.example 참고).",
        );
    });
  }, []);

  /* ---------- 파생 데이터 ---------- */
  const years = useMemo(() => [...new Set(trips.map(tripYear).filter(Boolean))].sort().reverse(), [trips]);
  const mapYear = years.includes(year) ? year : "";
  const mapTrips = useMemo(() => trips.filter((t) => !mapYear || tripYear(t) === mapYear), [trips, mapYear]);
  const detailTrip = detailId ? trips.find((t) => t.id === detailId) || null : null;

  /* ---------- 동작 ---------- */
  const openEditor = (req: EditorRequest) => setEditor((e) => ({ open: true, session: e.session + 1, req }));
  const closeEditor = () => setEditor((e) => ({ ...e, open: false }));

  function openDetail(id: string) {
    mapRef.current?.hidePopup();
    setDetailId(id);
  }

  // 여행 편집 창에서 도시 위치를 지도에서 찍는 동안 편집 창을 숨김
  const startPick = (text: string, cb: PickState["cb"]) => {
    setPick({ text, cb });
    go("map");
  };

  function onPick(lat: number, lng: number) {
    const p = pick;
    setPick(null);
    p?.cb(lat, lng);
  }



  async function wishDelete(id: string) {
    try {
      await store.remove("wishes", id);
      toast("삭제");
    } catch {
      /* store가 이미 알림을 띄움 */
    }
  }

  /* ---------- Esc: 열린 창 모두 닫기 (잠금 화면 제외) ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setEditor((x) => ({ ...x, open: false }));
      setDetailId(null);
      setWish((x) => ({ ...x, open: false }));
      setBackupOpen(false);
      setLogoutOpen(false);
      setDeleteOpen(false);
      setNickOpen(false);
      setAuthTab(null);
      mapRef.current?.hidePopup();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const tab = (v: View, label: string) => (
    <a {...linkTo(v)} className={view === v ? "on" : undefined} aria-current={view === v ? "page" : undefined}>
      {/* 아이콘은 휴대폰 하단 탭 바에서만 보임 */}
      <span className="tab-ico" aria-hidden="true">
        {TAB_ICONS[v]}
      </span>
      <span className="tab-label">{label}</span>
    </a>
  );
  const on = (v: View) => "view" + (view === v ? " on" : "");

  return (
    <>
      <header ref={headerRef}>
        <h1>
          {/* 로고: public/data/logo.png 원본에서 여백을 자르고 줄인 파일 */}
          <img className="logo-img" src="/logo-mark.png" alt="My Trip Log" width={56} height={56} />
        </h1>
        {/* 데스크톱: 상단 메뉴 / 휴대폰(640px 이하): 화면 아래 고정 탭 바 */}
        <nav aria-label="화면 이동">
          {tab("map", "지도")}
          {tab("trips", "여행 기록")}
          {tab("stats", "통계")}
        </nav>
        <div className="spacer" />
        {/* 클라우드: 계정 메뉴(내 기록 내려받기, 로그아웃) / 로컬: 이 브라우저에만 저장되니 백업·복원 버튼 */}
        {store.mode === "cloud" && user && <AccountMenu
            email={user.email}
            nickname={user.nickname}
            onNickname={() => setNickOpen(true)}
            onLogout={() => setLogoutOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />}
        {store.mode === "local" && (
          <Button onClick={() => setBackupOpen(true)}>
            백업<span className="hide-sm"> / 복원</span>
          </Button>
        )}
        <Button variant="primary" onClick={() => openEditor({ trip: null })}>
          + 여행 추가
        </Button>
      </header>
      <div className={"banner" + (ui.banner ? " show" : "")}>{ui.banner}</div>

      <main>
        <section className={on("map")} id="mapView">
          <MapView
            ref={mapRef}
            features={features}
            trips={mapTrips}
            wishes={wishes}
            visible={view === "map"}
            years={years}
            year={mapYear}
            onYearChange={setYear}
            pickText={pick ? pick.text : null}
            onPick={onPick}
            onPickCancel={() => setPick(null)}
            onAddWish={() => setWish((w) => ({ open: true, session: w.session + 1 }))}
            onOpenTrip={openDetail}
            onNewTripIn={() => openEditor({ trip: null })}
            onWishDone={(w) =>
              openEditor({
                trip: null,
                initialCity: { name: w.name, lat: w.lat, lng: w.lng, cid: w.cid },
                fromWish: w.id,
              })
            }
            onWishDelete={wishDelete}
          />
          <SidePanel
            trips={mapTrips}
            wishes={wishes}
            onOpenTrip={openDetail}
            onWishDelete={wishDelete}
          />
        </section>

        <section className={on("trips")} id="tripsView">
          <TripsView
            trips={trips}
            years={years}
            country={tripCountry}
            onCountryChange={setTripCountry}
            onOpenTrip={openDetail}
            onAddTrip={() => openEditor({ trip: null })}
          />
        </section>

        <section className={on("stats")} id="statsView">
          <StatsView trips={trips} onOpenTrip={openDetail} />
        </section>
      </main>

      <TripEditor
        key={editor.session}
        request={editor.req}
        show={editor.open && !pick}
        onClose={closeEditor}
        onStartPick={startPick}
      />
      <TripDetail
        trip={detailTrip}
        show={!!detailTrip}
        onClose={() => setDetailId(null)}
        onEdit={(t) => {
          setDetailId(null);
          openEditor({ trip: t });
        }}
      />
      <WishModal
        key={"w" + wish.session}
        show={wish.open}
        onClose={() => setWish((w) => ({ ...w, open: false }))}
      />
      <BackupModal show={backupOpen} onClose={() => setBackupOpen(false)} />
      {landing && <Landing onLogin={() => setAuthTab("login")} onSignup={() => setAuthTab("signup")} />}
      {legal && <LegalPage doc={legal} />}
      <AuthModal
        show={landing && authTab !== null}
        recovery={store.mode === "cloud" && recovery}
        initialMode={authTab || "login"}
        onClose={() => setAuthTab(null)}
      />
      <ConfirmModal
        show={logoutOpen && !!user}
        title="로그아웃"
        message={
          <>
            <b>{user?.email}</b> 계정에서 나갈까요?
            <br />
            <span className="note">여행 기록은 계정에 그대로 남아 있어요.</span>
          </>
        }
        confirmLabel="로그아웃"
        loading={loggingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          try {
            await store.signOut();
          } finally {
            setLoggingOut(false);
            setLogoutOpen(false);
          }
        }}
      />

      {/* 첫 화면에서는 지도를 기다리지 않음 (지도는 뒤에서 미리 불러 둠) */}
      <NicknameModal show={nickOpen && !!user} current={user?.nickname || ""} onClose={() => setNickOpen(false)} />
      <ConfirmModal
        show={deleteOpen && !!user}
        title="회원 탈퇴"
        message={
          <>
            <b>{user?.email}</b> 계정과 <b>모든 여행 기록</b>이 바로 삭제되며 되돌릴 수 없어요.
            <br />
            <span className="note">필요하면 먼저 계정 메뉴의 ‘내 기록 내려받기’로 저장해 두세요.</span>
          </>
        }
        confirmLabel="탈퇴하기"
        danger
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await store.deleteAccount();
            setDeleteOpen(false);
            toast("탈퇴했어요");
          } catch (e) {
            toast(e instanceof Error ? e.message : "탈퇴하지 못했어요");
          } finally {
            setDeleting(false);
          }
        }}
      />
      <LoadingScreen show={(loading || (!mapReady && !landing)) && !legal} />
      {/* 휴대폰: 맨 위에서 당기면 스피너가 돌며 기록을 다시 불러옴 */}
      <PullToRefresh onRefresh={() => store.refresh()} disabled={loading || !mapReady || needsAuth || pick !== null} />
      {/* Vercel Web Analytics: 화면(#map·#trips·#stats)을 각각 /map·/trips·/stats 페이지로 집계 */}
      <Analytics route={landing ? "/welcome" : "/" + view} path={landing ? "/welcome" : "/" + view} />
      <div className={"toast" + (ui.toastOn ? " show" : "")} role="status" aria-live="polite">
        {ui.toast}
      </div>
    </>
  );
}
