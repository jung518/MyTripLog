import { useState } from "react";
import {
  byStartAsc,
  byStartDesc,
  fmtDate,
  mrzLine,
  stampDate,
  tripCost,
  tripCountries,
  tripLen,
  tripYear,
  won,
} from "../lib/format";
import { cname } from "../lib/geo";
import { LIMITS } from "../lib/limits";
import type { Trip } from "../types";
import { Button, EmptyState, SearchInput, Select, type SelectOption } from "./ui";

type SortKey = "new" | "old" | "cost" | "cheap";

const SORTS: Record<SortKey, (a: Trip, b: Trip) => number> = {
  new: byStartDesc,
  old: byStartAsc,
  cost: (a, b) => tripCost(b).total - tripCost(a).total,
  cheap: (a, b) => tripCost(a).total - tripCost(b).total,
};

/** 입국 도장에 찍을 이름: 첫 나라 → 첫 도시 → "여행" */
function stampPlace(t: Trip): string {
  const cid = tripCountries(t)[0];
  if (cid) return cname(cid);
  return t.cities?.[0]?.name || "여행";
}

const SORT_OPTS: SelectOption<SortKey>[] = [
  { value: "new", label: "최신순" },
  { value: "old", label: "오래된순" },
  { value: "cost", label: "경비 많은순" },
  { value: "cheap", label: "경비 적은순" },
];

interface Props {
  trips: Trip[];
  years: string[];
  country: string;
  onCountryChange: (id: string) => void;
  onOpenTrip: (id: string) => void;
  onAddTrip: () => void;
}

export function TripsView({ trips, years, country, onCountryChange, onOpenTrip, onAddTrip }: Props) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState<SortKey>("new");

  const countries = [...new Set(trips.flatMap(tripCountries))].sort((a, b) =>
    cname(a).localeCompare(cname(b), "ko"),
  );
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

  function resetFilters() {
    setQ("");
    setYear("");
    onCountryChange("");
  }

  return (
    <div className="page">
      <div className="toolbar">
        <SearchInput
          value={q}
          onValue={setQ}
          placeholder="검색"
          maxLength={LIMITS.search}
          aria-label="여행 검색 (제목, 도시, 호텔, 메모)"
          boxClassName="toolbar-search"
        />
        <Select
          value={y}
          options={[{ value: "", label: "전체 연도" }, ...years.map((yr) => ({ value: yr, label: yr }))]}
          onChange={setYear}
          ariaLabel="연도"
        />
        <Select
          value={c}
          options={[{ value: "", label: "전체 나라" }, ...countries.map((id) => ({ value: id, label: cname(id) }))]}
          onChange={onCountryChange}
          ariaLabel="나라"
        />
        {/* 정렬은 가나다순이 아니라 정해진 순서대로 보여줌 */}
        <Select value={sort} options={SORT_OPTS} onChange={setSort} ariaLabel="정렬" sorted={false} />
      </div>
      <div className="grid">
        {list.length ? (
          list.map((t) => {
            return (
              <div
                className="tcard"
                key={t.id}
                onClick={() => onOpenTrip(t.id)}
              >
                <div className="cover">
                  <span className="visa">VISA · 사증</span>
                  <span className="days">{tripLen(t) || "날짜 미정"}</span>
                  <span className="ctry">
                    {tripCountries(t).map(cname).join(" · ")}
                  </span>
                </div>
                <span className="stamp" aria-hidden="true">
                  <small>ARRIVED</small>
                  {stampPlace(t)}
                  <small>{stampDate(t.start)}</small>
                </span>
                <div className="body">
                  <h3>{t.title || "제목 없음"}</h3>
                  <div className="meta">
                    {fmtDate(t.start)}
                    {t.end ? " – " + fmtDate(t.end) : ""}
                    {t.with ? " · " + t.with : ""}
                  </div>
                  <div className="meta">
                    {(t.cities || []).map((x) => x.name).join(" → ")}
                  </div>
                  <div className="foot">
                    <b>{won(tripCost(t).total)}</b>
                  </div>
                </div>
                <div className="mrz" aria-hidden="true">
                  {mrzLine(t)}
                </div>
              </div>
            );
          })
        ) : trips.length ? (
          <EmptyState
            kind="search"
            title="검색 결과가 없어요"
            description={
              query
                ? `‘${q.trim()}’와 맞는 여행이 없어요. 다른 단어로 찾아보세요.`
                : "고른 연도·나라에 해당하는 여행이 없어요."
            }
            action={
              <Button size="sm" onClick={resetFilters}>
                검색 조건 지우기
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="아직 기록이 없어요"
            description="첫 여행을 추가하면 여기에 여권 사증처럼 쌓여요."
            action={
              <Button variant="primary" size="sm" onClick={onAddTrip}>
                + 여행 추가
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
