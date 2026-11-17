import { useState } from "react";
import { byStartAsc, byStartDesc, fmtDate, stars, tripCost, tripCountries, tripLen, tripYear, won } from "../lib/format";
import { cname } from "../lib/geo";
import { store } from "../store";
import type { Trip } from "../types";

type SortKey = "new" | "old" | "cost" | "rating";

const SORTS: Record<SortKey, (a: Trip, b: Trip) => number> = {
  new: byStartDesc,
  old: byStartAsc,
  cost: (a, b) => tripCost(b).total - tripCost(a).total,
  rating: (a, b) => (b.rating || 0) - (a.rating || 0),
};

export function coverUrl(t: Trip): string {
  const p = t.photos || [];
  if (!p.length) return "";
  const c = p.find((x) => x.id === t.cover) || p[0];
  return store.photoUrl(c.id);
}

interface Props {
  trips: Trip[];
  years: string[];
  country: string;
  onCountryChange: (id: string) => void;
  onOpenTrip: (id: string) => void;
}

export function TripsView({ trips, years, country, onCountryChange, onOpenTrip }: Props) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState<SortKey>("new");

  const countries = [...new Set(trips.flatMap(tripCountries))].sort((a, b) => cname(a).localeCompare(cname(b), "ko"));
  const y = years.includes(year) ? year : "";
  const c = countries.includes(country) ? country : "";
  const query = q.trim().toLowerCase();

  const list = trips
    .filter((t) => {
      if (y && tripYear(t) !== y) return false;
      if (c && !tripCountries(t).includes(c)) return false;
      if (query) {
        const hay = [
          t.title,
          t.memo,
          t.with,
          (t.tags || []).join(" "),
          (t.cities || []).map((x) => x.name).join(" "),
          (t.hotels || []).map((h) => h.name).join(" "),
          tripCountries(t).map(cname).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    })
    .sort(SORTS[sort]);

  return (
    <div className="page">
      <div className="toolbar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="여행 제목, 도시, 호텔, 태그 검색" />
        <select value={y} onChange={(e) => setYear(e.target.value)}>
          <option value="">전체 연도</option>
          {years.map((yr) => (
            <option key={yr}>{yr}</option>
          ))}
        </select>
        <select value={c} onChange={(e) => onCountryChange(e.target.value)}>
          <option value="">전체 나라</option>
          {countries.map((id) => (
            <option key={id} value={id}>
              {cname(id)}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="new">최신순</option>
          <option value="old">오래된순</option>
          <option value="cost">경비 많은순</option>
          <option value="rating">별점순</option>
        </select>
      </div>
      <div className="grid">
        {list.length ? (
          list.map((t) => {
            const cv = coverUrl(t);
            return (
              <div className="tcard" key={t.id} onClick={() => onOpenTrip(t.id)}>
                <div className="cover" style={cv ? { backgroundImage: `url('${cv}')` } : undefined}>
                  <span className="days">{tripLen(t) || "날짜 미정"}</span>
                  <span className="ctry">{tripCountries(t).map(cname).join(" · ")}</span>
                </div>
                <div className="body">
                  <h3>{t.title || "제목 없음"}</h3>
                  <div className="meta">
                    {fmtDate(t.start)}
                    {t.end ? " – " + fmtDate(t.end) : ""}
                    {t.with ? " · " + t.with : ""}
                  </div>
                  <div className="meta">{(t.cities || []).map((x) => x.name).join(" → ")}</div>
                  <div className="foot">
                    <span className="stars">{stars(t.rating || 0)}</span>
                    <b>{won(tripCost(t).total)}</b>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty">
            {trips.length ? (
              "조건에 맞는 여행이 없어요."
            ) : (
              <>
                아직 기록이 없어요. <b>+ 여행 추가</b>로 시작해 보세요.
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
