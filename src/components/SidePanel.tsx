import { byStartDesc, fmtDate, tripCost, tripCountries, tripDays, tripLen, wonShort } from "../lib/format";
import { cname } from "../lib/geo";
import { linkTo } from "../lib/router";
import type { Trip, Wish } from "../types";
import { Button, EmptyState, Kpi, KpiGrid, SectionHeader } from "./ui";

interface Props {
  trips: Trip[];
  wishes: Wish[];
  onOpenTrip: (id: string) => void;
  onWishGo: (w: Wish) => void;
}

export function MiniTrip({ t, onOpen }: { t: Trip; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="mini-trip" onClick={() => onOpen(t.id)}>
      <span className="t">{t.title || "제목 없음"}</span>
      <span className="m">
        {tripCountries(t).map(cname).join(", ")} · {fmtDate(t.start)} · {tripLen(t)} · {wonShort(tripCost(t).total)}
      </span>
    </button>
  );
}

export function SidePanel({ trips, wishes, onOpenTrip, onWishGo }: Props) {
  const countries = new Set<string>();
  const cities = new Set<string>();
  let days = 0;
  let cost = 0;
  trips.forEach((t) => {
    tripCountries(t).forEach((c) => countries.add(c));
    (t.cities || []).forEach((c) => cities.add(c.name));
    days += tripDays(t);
    cost += tripCost(t).total;
  });
  const abroad = [...countries].filter((c) => c !== "410").length;
  const recent = [...trips].sort(byStartDesc).slice(0, 5);

  return (
    <aside className="side">
      <KpiGrid variant="side">
        <Kpi value={abroad} label="다녀온 나라" />
        <Kpi value={cities.size} label="다녀온 도시" />
        <Kpi value={trips.length} label={`여행 횟수 · 총 ${days}일`} />
        <Kpi value={wonShort(cost)} label="총 여행 경비" />
      </KpiGrid>

      <div>
        <SectionHeader title="최근 여행" />
        {recent.length ? (
          <>
            {recent.map((t) => (
              <MiniTrip key={t.id} t={t} onOpen={onOpenTrip} />
            ))}
            {/* 최근 여행을 훑어본 다음 자연스럽게 이어지도록 목록 맨 아래에 둠 */}
            <a {...linkTo("trips")} className="see-all">
              여행 기록 전체 보기 <span className="see-all-count">{trips.length}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </>
        ) : (
          <EmptyState
            compact
            title="아직 기록이 없어요."
            description={
              <>
                오른쪽 위 <b>+ 여행 추가</b>로 첫 여행을 남겨 보세요.
              </>
            }
          />
        )}
      </div>

      <div>
        <SectionHeader title="가고 싶은 곳" />
        {wishes.length ? (
          wishes.map((w) => (
            <div className="wish-item" key={w.id}>
              <span>
                <b>{w.name}</b> <span className="note">{cname(w.cid)}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => onWishGo(w)}>
                보기
              </Button>
            </div>
          ))
        ) : (
          <EmptyState
            compact
            title={
              <>
                지도 위 <b>가고 싶은 곳</b>으로 다음 여행지를 찍어 두세요.
              </>
            }
          />
        )}
      </div>
    </aside>
  );
}
