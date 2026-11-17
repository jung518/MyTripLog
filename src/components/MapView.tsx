/* =========================================================
 * 세계 지도 (D3 + topojson)
 * - 나라 색칠(방문 횟수), 도시 핀, 가고 싶은 곳 핀, 확대/이동, 지도에서 위치 찍기
 * - D3가 SVG를 직접 그리고, React는 도구 막대·범례·팝업을 그립니다.
 * ========================================================= */
import * as d3 from "d3";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { byStartDesc, fmtDate, tripCost, tripCountries, tripLen, wonShort } from "../lib/format";
import { cname, type CountryFeature } from "../lib/geo";
import type { Trip, Wish } from "../types";
import { Button, Select } from "./ui";

export type ZoomKind = "mine" | "asia" | "world";
type LngLat = [number, number];

export interface MapHandle {
  zoomTo(kind: ZoomKind, anim?: boolean): void;
  zoomToPoints(pts: LngLat[]): void;
  hidePopup(): void;
}

interface CityPin {
  name: string;
  lat: number;
  lng: number;
  trips: Trip[];
}

type PopupContent = { kind: "city"; city: CityPin } | { kind: "wish"; wish: Wish } | { kind: "country"; id: string };

interface PopupState {
  x: number;
  y: number;
  placed: boolean;
  content: PopupContent;
}

type GSel = d3.Selection<SVGGElement, unknown, null, undefined>;
interface MapCtx {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  projection: d3.GeoProjection;
  path: d3.GeoPath;
  gCountries: GSel;
  gPins: GSel;
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  k: number;
}

interface Props {
  ref?: Ref<MapHandle>;
  features: CountryFeature[];
  /** 연도 필터가 적용된 여행 */
  trips: Trip[];
  wishes: Wish[];
  visible: boolean;
  years: string[];
  year: string;
  onYearChange: (y: string) => void;
  /** 위치 찍기 중이면 안내 문구, 아니면 null */
  pickText: string | null;
  onPick: (lat: number, lng: number) => void;
  onPickCancel: () => void;
  onAddWish: () => void;
  onOpenTrip: (id: string) => void;
  onNewTripIn: (countryId: string) => void;
  onWishDone: (w: Wish) => void;
  onWishDelete: (id: string) => void;
}

export function MapView(props: Props) {
  const { ref, features, trips, wishes, visible, years, year, onYearChange, pickText } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<MapCtx | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const zoomedWithTrips = useRef(false);
  const [popup, setPopup] = useState<PopupState | null>(null);

  /* ---------- helpers (refs만 읽으므로 D3 이벤트 안에서 써도 안전) ---------- */
  function openPopup(ev: MouseEvent, content: PopupContent) {
    const wrap = wrapRef.current!.getBoundingClientRect();
    setPopup({ x: ev.clientX - wrap.left + 12, y: ev.clientY - wrap.top + 12, placed: false, content });
  }

  function fit(c: MapCtx) {
    const el = svgRef.current!;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 500;
    c.projection.fitExtent(
      [
        [10, 10],
        [w - 10, h - 10],
      ],
      { type: "FeatureCollection", features },
    );
  }

  function scalePins(c: MapCtx) {
    const k = c.k;
    c.gPins
      .selectAll<SVGCircleElement, CityPin>("g.c circle")
      .attr("r", (d) => (4 + Math.min(d.trips.length, 4) * 1.2) / k)
      .attr("stroke-width", 1.6 / k);
    c.gPins
      .selectAll("g.w circle")
      .attr("r", 5 / k)
      .attr("stroke-width", 2.4 / k);
    c.gPins
      .selectAll("text")
      .style("font-size", 12.5 / k + "px")
      .attr("x", 9 / k)
      .attr("y", 4 / k)
      .style("stroke-width", 3 / k)
      .style("display", k >= 3 ? "" : "none");
  }

  function drawCountries(c: MapCtx, ts: Trip[]) {
    const cnt: Record<string, number> = {};
    ts.forEach((t) => tripCountries(t).forEach((id) => (cnt[id] = (cnt[id] || 0) + 1)));
    const paths = c.gCountries.selectAll<SVGPathElement, CountryFeature>("path");
    paths.attr("class", (f) => {
      const n = cnt[f.id] || 0;
      return "country" + (n >= 3 ? " v3" : n === 2 ? " v2" : n === 1 ? " v1" : "");
    });
    paths.selectAll("title").remove();
    paths.append("title").text((f) => cname(f.id) + (cnt[f.id] ? ` · ${cnt[f.id]}번 방문` : ""));
  }

  function drawPins(c: MapCtx, ts: Trip[], ws: Wish[]) {
    const byCity: Record<string, CityPin> = {};
    ts.forEach((t) =>
      (t.cities || []).forEach((city) => {
        if (city.lat == null || city.lng == null) return;
        const key = city.name + "|" + city.lat.toFixed(2) + "|" + city.lng.toFixed(2);
        (byCity[key] ||= { name: city.name, lat: city.lat, lng: city.lng, trips: [] }).trips.push(t);
      }),
    );
    const at = (lng: number, lat: number) => `translate(${c.projection([lng, lat])})`;
    c.gPins.selectAll("*").remove();
    const wg = c.gPins
      .selectAll("g.w")
      .data(ws.filter((w) => w.lat != null && w.lng != null))
      .join("g")
      .attr("class", "w")
      .attr("transform", (d) => at(d.lng!, d.lat!));
    wg.append("circle")
      .attr("class", "wishpin")
      .on("click", (ev: MouseEvent, d) => {
        ev.stopPropagation();
        openPopup(ev, { kind: "wish", wish: d });
      });
    const cg = c.gPins
      .selectAll("g.c")
      .data(Object.values(byCity))
      .join("g")
      .attr("class", "c")
      .attr("transform", (d) => at(d.lng, d.lat));
    cg.append("circle")
      .attr("class", "pin")
      .on("click", (ev: MouseEvent, d) => {
        ev.stopPropagation();
        openPopup(ev, { kind: "city", city: d });
      });
    cg.append("text")
      .attr("class", "pin-label")
      .text((d) => d.name);
    scalePins(c);
  }

  function redraw() {
    const c = ctxRef.current;
    if (!c) return;
    fit(c);
    c.gCountries.selectAll<SVGPathElement, CountryFeature>("path").attr("d", (f) => c.path(f) ?? "");
    drawPins(c, propsRef.current.trips, propsRef.current.wishes);
  }

  function zoomBox(pts: LngLat[], minBox: number, fill: number, dur: number) {
    const c = ctxRef.current;
    if (!c || !pts.length) return;
    const el = svgRef.current!;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const xy = pts.map((p) => c.projection(p)!);
    const [x0, x1] = d3.extent(xy, (d) => d[0]) as [number, number];
    const [y0, y1] = d3.extent(xy, (d) => d[1]) as [number, number];
    const bw = Math.max(x1 - x0, minBox);
    const bh = Math.max(y1 - y0, minBox);
    const k = Math.min(40, fill / Math.max(bw / w, bh / h));
    const t = d3.zoomIdentity
      .translate(w / 2, h / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    c.svg.transition().duration(dur).call(c.zoom.transform, t);
  }

  function zoomTo(kind: ZoomKind, anim = true) {
    const c = ctxRef.current;
    if (!c) return;
    let pts: LngLat[] = [];
    if (kind === "mine") {
      propsRef.current.trips.forEach((t) =>
        (t.cities || []).forEach((city) => {
          if (city.lat != null && city.lng != null) pts.push([city.lng, city.lat]);
        }),
      );
      if (!pts.length) kind = "asia";
    }
    if (kind === "world") {
      c.svg
        .transition()
        .duration(anim ? 700 : 0)
        .call(c.zoom.transform, d3.zoomIdentity);
      return;
    }
    if (kind === "asia")
      pts = [
        [95, -9],
        [146, 45],
      ];
    zoomBox(pts, 40, 0.85, anim ? 750 : 0);
  }

  useImperativeHandle(ref, () => ({
    zoomTo,
    zoomToPoints: (pts) => zoomBox(pts, 15, 0.6, 750),
    hidePopup: () => setPopup(null),
  }));

  /* ---------- 지도 만들기 (나라 데이터가 준비되면 한 번) ---------- */
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !features.length) return;
    const svg = d3.select(el);
    const projection = d3.geoMercator();
    const path = d3.geoPath(projection);
    const gRoot = svg.append("g");
    const gCountries = gRoot.append("g");
    const gPins = gRoot.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 60])
      .on("zoom", (ev: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        gRoot.attr("transform", ev.transform.toString());
        const c = ctxRef.current;
        if (c) {
          c.k = ev.transform.k;
          scalePins(c);
        }
        setPopup(null);
      });
    const c: MapCtx = { svg, projection, path, gCountries, gPins, zoom, k: 1 };
    ctxRef.current = c;
    fit(c);
    gCountries
      .selectAll("path")
      .data(features)
      .join("path")
      .attr("class", "country")
      .attr("d", (f) => path(f) ?? "")
      .on("click", (ev: MouseEvent, f) => {
        if (propsRef.current.pickText !== null) return;
        openPopup(ev, { kind: "country", id: f.id });
      });
    svg.call(zoom).on("dblclick.zoom", null);
    svg.on("click", (ev: MouseEvent) => {
      if (propsRef.current.pickText === null) {
        if ((ev.target as Element).tagName === "svg") setPopup(null);
        return;
      }
      const t = d3.zoomTransform(el);
      const [x, y] = t.invert(d3.pointer(ev, el));
      const lngLat = projection.invert!([x, y]);
      if (!lngLat) return;
      const [lng, lat] = lngLat;
      propsRef.current.onPick(+lat.toFixed(4), +lng.toFixed(4));
    });
    drawCountries(c, propsRef.current.trips);
    drawPins(c, propsRef.current.trips, propsRef.current.wishes);
    zoomTo("mine", false);
    return () => {
      svg.on(".zoom", null).on("click", null);
      svg.selectAll("*").remove();
      ctxRef.current = null;
    };
  }, [features]);

  /* ---------- 데이터가 바뀌면 다시 칠하기 ---------- */
  useEffect(() => {
    const c = ctxRef.current;
    if (!c) return;
    drawCountries(c, trips);
    drawPins(c, trips, wishes);
    // 처음으로 여행 기록이 들어오면 내 여행 쪽으로 확대
    if (!zoomedWithTrips.current && trips.length) {
      zoomedWithTrips.current = true;
      zoomTo("mine", false);
    }
  }, [trips, wishes]);

  /* ---------- 지도 탭으로 돌아오거나 창 크기가 바뀌면 다시 맞추기 ---------- */
  useEffect(() => {
    if (visible) redraw();
    const onResize = () => {
      if (propsRef.current.visible) redraw();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [visible]);

  useEffect(() => {
    if (pickText !== null) setPopup(null);
  }, [pickText]);

  /* ---------- 팝업이 지도 밖으로 나가지 않게 ---------- */
  useLayoutEffect(() => {
    const p = popupRef.current;
    const wrapEl = wrapRef.current;
    if (!popup || popup.placed || !p || !wrapEl) return;
    const wrap = wrapEl.getBoundingClientRect();
    let { x, y } = popup;
    if (x + p.offsetWidth > wrap.width - 8) x = wrap.width - p.offsetWidth - 8;
    if (y + p.offsetHeight > wrap.height - 8) y = wrap.height - p.offsetHeight - 8;
    setPopup({ ...popup, x, y, placed: true });
  }, [popup]);

  return (
    <div className="map-wrap" ref={wrapRef}>
      <svg id="map" ref={svgRef} className={pickText !== null ? "picking" : undefined} />
      <div className="map-tools">
        <Button size="sm" onClick={() => zoomTo("mine")}>
          내 여행
        </Button>
        <Button size="sm" onClick={() => zoomTo("asia")}>
          아시아
        </Button>
        <Button size="sm" onClick={() => zoomTo("world")}>
          세계
        </Button>
        <Select
          value={year}
          options={[{ value: "", label: "전체 연도" }, ...years.map((y) => ({ value: y, label: y }))]}
          onChange={onYearChange}
          ariaLabel="연도"
        />
        <Button size="sm" onClick={props.onAddWish}>
          ☆ 가고 싶은 곳
        </Button>
      </div>
      <div className={"pick-banner" + (pickText !== null ? " show" : "")}>
        <span>{pickText || "지도에서 위치를 클릭하세요"}</span>
        <button onClick={props.onPickCancel}>취소</button>
      </div>
      <div className="legend">
        <div>
          <i style={{ background: "var(--v1)" }} />
          1번 방문
        </div>
        <div>
          <i style={{ background: "var(--v2)" }} />
          2번 방문
        </div>
        <div>
          <i style={{ background: "var(--v3)" }} />
          3번 이상
        </div>
        <div>
          <i className="c" style={{ background: "var(--pin)" }} />
          다녀온 도시
        </div>
        <div>
          <i className="c" style={{ background: "#fff", border: "2px solid var(--wish)" }} />
          가고 싶은 곳
        </div>
      </div>
      {popup && (
        <div className="popup" ref={popupRef} style={{ display: "block", left: popup.x, top: popup.y }}>
          <PopupBody
            content={popup.content}
            trips={trips}
            onOpenTrip={props.onOpenTrip}
            onNewTripIn={props.onNewTripIn}
            onWishDone={props.onWishDone}
            onWishDelete={props.onWishDelete}
            close={() => setPopup(null)}
          />
        </div>
      )}
    </div>
  );
}

function TripLinks({ trips, onOpenTrip }: { trips: Trip[]; onOpenTrip: (id: string) => void }) {
  return (
    <>
      {trips.map((t) => (
        <a className="tlink" key={t.id} onClick={() => onOpenTrip(t.id)}>
          <b>{t.title || "제목 없음"}</b>
          <br />
          <span className="note">
            {fmtDate(t.start)} · {tripLen(t)}
          </span>
        </a>
      ))}
    </>
  );
}

function PopupBody({
  content,
  trips,
  onOpenTrip,
  onNewTripIn,
  onWishDone,
  onWishDelete,
  close,
}: Pick<Props, "trips" | "onOpenTrip" | "onNewTripIn" | "onWishDone" | "onWishDelete"> & {
  content: PopupContent;
  close: () => void;
}) {
  if (content.kind === "city") {
    const d = content.city;
    return (
      <>
        <h3>{d.name}</h3>
        <div className="note">{d.trips.length}번 방문</div>
        <TripLinks trips={[...d.trips].sort(byStartDesc)} onOpenTrip={onOpenTrip} />
      </>
    );
  }
  if (content.kind === "wish") {
    const w = content.wish;
    return (
      <>
        <h3>☆ {w.name}</h3>
        <div className="note">{cname(w.cid)}</div>
        {w.memo && <p style={{ margin: "6px 0" }}>{w.memo}</p>}
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <Button
            size="sm"
            onClick={() => {
              close();
              onWishDone(w);
            }}
          >
            다녀왔어요 → 여행 추가
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              close();
              onWishDelete(w.id);
            }}
          >
            삭제
          </Button>
        </div>
      </>
    );
  }
  const id = content.id;
  const ts = trips.filter((t) => tripCountries(t).includes(id));
  if (!ts.length)
    return (
      <>
        <h3>{cname(id)}</h3>
        <div className="note">아직 기록이 없어요</div>
        <Button
          size="sm"
          style={{ marginTop: 8 }}
          onClick={() => {
            close();
            onNewTripIn(id);
          }}
        >
          여행 추가
        </Button>
      </>
    );
  return (
    <>
      <h3>{cname(id)}</h3>
      <div className="note">
        {ts.length}번 방문 · {wonShort(ts.reduce((s, t) => s + tripCost(t).total, 0))}
      </div>
      <TripLinks trips={ts} onOpenTrip={onOpenTrip} />
    </>
  );
}
