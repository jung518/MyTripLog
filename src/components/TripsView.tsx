import { Fragment, useState } from "react";
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
  wonShort,
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

/** 입국 도장에 찍을 이름: 첫 도시 → "여행" (카드에는 나라 이름을 쓰지 않음) */
function stampPlace(t: Trip): string {
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

  // 최신순·오래된순일 때는 연도별로 묶어서 보여줌 (여권 사증 페이지를 연도별로 넘기듯)
  const grouped = sort === "new" || sort === "old";
  const groups: [string, Trip[]][] = [];
  if (grouped)
    for (const t of list) {
      const yr = tripYear(t) || "날짜 미정";
      const last = groups[groups.length - 1];
      if (last && last[0] === yr) last[1].push(t);
      else groups.push([yr, [t]]);
    }

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
          grouped ? (
            groups.map(([yr, ts]) => (
              <Fragment key={yr}>
                <h2 className="year-h">
                  <b>{yr}</b>
                  <span>
                    {ts.length}번의 여행 · {wonShort(ts.reduce((n, t) => n + tripCost(t).total, 0))}
                  </span>
                </h2>
                {ts.map((t) => (
                  <TripCard key={t.id} t={t} onOpen={onOpenTrip} />
                ))}
              </Fragment>
            ))
          ) : (
            list.map((t) => <TripCard key={t.id} t={t} onOpen={onOpenTrip} />)
          )
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

/** 여행 카드 하나 (사증 페이지 모양) */
function TripCard({ t, onOpen }: { t: Trip; onOpen: (id: string) => void }) {
  return (
    <div
      className="tcard"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(t.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(t.id);
        }
      }}
    >
      <div className="cover">
        <span className="visa">VISA · 사증</span>
        <span className="days">{tripLen(t) || "날짜 미정"}</span>
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
        </div>
        <div className="meta">{(t.cities || []).map((x) => x.name).join(" → ")}</div>
        <div className="foot">
          <b>{won(tripCost(t).total)}</b>
        </div>
      </div>
      <div className="mrz" aria-hidden="true">
        {mrzLine(t)}
      </div>
    </div>
  );
}
