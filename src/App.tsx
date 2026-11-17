import { useEffect, useMemo, useRef, useState } from "react";
import { AuthModal } from "./components/AuthModal";
import { BackupModal } from "./components/BackupModal";
import { MapView, type MapHandle } from "./components/MapView";
import { SidePanel } from "./components/SidePanel";
import { StatsView } from "./components/StatsView";
import { TripDetail } from "./components/TripDetail";
import { CityDatalist, TripEditor, type EditorRequest } from "./components/TripEditor";
import { TripsView } from "./components/TripsView";
import { WishModal } from "./components/WishModal";
import { tripYear } from "./lib/format";
import { loadCountries, type CountryFeature } from "./lib/geo";
import { showBanner, toast, useUi } from "./lib/ui";
import { store, useStore } from "./store";
import type { Trip, Wish } from "./types";

type View = "map" | "trips" | "stats";
const VIEWS: View[] = ["map", "trips", "stats"];

function readHash(): View {
  const v = (location.hash || "#map").slice(1) as View;
  return VIEWS.includes(v) ? v : "map";
}

function useHashView(): View {
  const [view, setView] = useState(readHash);
  useEffect(() => {
    const f = () => setView(readHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return view;
}

const go = (v: View) => {
  if (location.hash !== "#" + v) location.hash = v;
};

interface PickState {
  text: string;
  cb: (lat: number, lng: number) => void;
  /** 위치를 찍는 동안 숨길 모달 */
  hide: "editor" | "wish";
}

let started = false;

export function App() {
  const { trips, wishes, user, needsAuth } = useStore();
  const ui = useUi();
  const view = useHashView();
  const mapRef = useRef<MapHandle>(null);

  const [features, setFeatures] = useState<CountryFeature[]>([]);
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
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pick, setPick] = useState<PickState | null>(null);

  /* ---------- 시작: 지도 데이터 + 저장소 ---------- */
  useEffect(() => {
    if (started) return;
    started = true;
    loadCountries()
      .then(setFeatures)
      .catch(() => showBanner("지도 데이터를 불러오지 못했어요."));
    void store.init().then(() => {
      if (store.mode === "local")
        showBanner(
          "로컬 모드: 이 브라우저에만 저장돼요. 여러 기기에서 쓰려면 src/config.ts에 Supabase 정보를 넣으세요.",
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

  const startPick = (hide: PickState["hide"]) => (text: string, cb: PickState["cb"]) => {
    setPick({ text, cb, hide });
    go("map");
  };

  function onPick(lat: number, lng: number) {
    const p = pick;
    setPick(null);
    p?.cb(lat, lng);
  }

  function showOnMap(t: Trip) {
    setDetailId(null);
    setYear("");
    go("map");
    const pts = (t.cities || [])
      .filter((c) => c.lat != null && c.lng != null)
      .map((c): [number, number] => [c.lng!, c.lat!]);
    setTimeout(() => {
      if (pts.length) mapRef.current?.zoomToPoints(pts);
    }, 60);
  }

  function wishGo(w: Wish) {
    if (w.lat != null && w.lng != null) mapRef.current?.zoomToPoints([[w.lng, w.lat]]);
  }

  async function wishDelete(id: string) {
    try {
      await store.remove("wishes", id);
      toast("삭제했어요");
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
      setLightbox(null);
      mapRef.current?.hidePopup();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const tab = (v: View, label: string) => (
    <a href={"#" + v} className={view === v ? "on" : undefined}>
      {label}
    </a>
  );
  const on = (v: View) => "view" + (view === v ? " on" : "");

  return (
    <>
      <header>
        <h1>
          My <span>Trip</span> Log
        </h1>
        <nav>
          {tab("map", "지도")}
          {tab("trips", "여행 기록")}
          {tab("stats", "통계")}
        </nav>
        <div className="spacer" />
        {store.mode === "cloud" && user && (
          <button
            className="btn ghost"
            title="이 기기에서 잠그기 (다음에 비밀번호 다시 입력)"
            onClick={() => void store.signOut()}
          >
            🔒 잠그기
          </button>
        )}
        <button className="btn" onClick={() => setBackupOpen(true)}>
          백업 / 복원
        </button>
        <button className="btn primary" onClick={() => openEditor({ trip: null })}>
          + 여행 추가
        </button>
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
            onNewTripIn={(cid) => openEditor({ trip: null, presetCountry: cid })}
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
            onCountry={(id) => {
              setTripCountry(id);
              go("trips");
            }}
            onWishGo={wishGo}
          />
        </section>

        <section className={on("trips")} id="tripsView">
          <TripsView
            trips={trips}
            years={years}
            country={tripCountry}
            onCountryChange={setTripCountry}
            onOpenTrip={openDetail}
          />
        </section>

        <section className={on("stats")} id="statsView">
          <StatsView trips={trips} onOpenTrip={openDetail} />
        </section>
      </main>

      <TripEditor
        key={editor.session}
        request={editor.req}
        show={editor.open && pick?.hide !== "editor"}
        onClose={closeEditor}
        onStartPick={startPick("editor")}
      />
      <TripDetail
        trip={detailTrip}
        show={!!detailTrip}
        onClose={() => setDetailId(null)}
        onEdit={(t) => {
          setDetailId(null);
          openEditor({ trip: t });
        }}
        onShowOnMap={showOnMap}
        onPhoto={setLightbox}
      />
      <WishModal
        key={"w" + wish.session}
        show={wish.open && pick?.hide !== "wish"}
        onClose={() => setWish((w) => ({ ...w, open: false }))}
        onStartPick={startPick("wish")}
      />
      <BackupModal show={backupOpen} onClose={() => setBackupOpen(false)} />
      <AuthModal show={store.mode === "cloud" && needsAuth} />

      <div className={"lightbox" + (lightbox ? " show" : "")} onClick={() => setLightbox(null)}>
        {lightbox && <img src={lightbox} alt="" />}
      </div>
      <div className={"toast" + (ui.toastOn ? " show" : "")}>{ui.toast}</div>
      <CityDatalist />
    </>
  );
}
