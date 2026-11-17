import { byStartDesc, fmtDate, tripCost, tripCountries, tripDays, tripLen, wonShort } from "../lib/format";
import { cname } from "../lib/geo";
import type { Trip, Wish } from "../types";

interface Props {
  trips: Trip[];
  wishes: Wish[];
  onOpenTrip: (id: string) => void;
  onCountry: (id: string) => void;
  onWishGo: (w: Wish) => void;
}

export function MiniTrip({ t, onOpen }: { t: Trip; onOpen: (id: string) => void }) {
  return (
    <div className="mini-trip" onClick={() => onOpen(t.id)}>
      <div className="t">{t.title || "제목 없음"}</div>
      <div className="m">
        {tripCountries(t).map(cname).join(", ")} · {fmtDate(t.start)} · {tripLen(t)} · {wonShort(tripCost(t).total)}
      </div>
    </div>
  );
}

export function SidePanel({ trips, wishes, onOpenTrip, onCountry, onWishGo }: Props) {
  const countries = new Set<string>();
  const cities = new Set<string>();
  let days = 0;
  let cost = 0;
  const cnt: Record<string, number> = {};
  trips.forEach((t) => {
    tripCountries(t).forEach((c) => {
      countries.add(c);
      cnt[c] = (cnt[c] || 0) + 1;
    });
    (t.cities || []).forEach((c) => cities.add(c.name));
    days += tripDays(t);
    cost += tripCost(t).total;
  });
  const abroad = [...countries].filter((c) => c !== "410").length;
  const ids = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  const recent = [...trips].sort(byStartDesc).slice(0, 5);

  return (
    <aside className="side">
      <div className="kpis">
        <div className="kpi">
          <b>{abroad}</b>
          <span>다녀온 나라 (해외)</span>
        </div>
        <div className="kpi">
          <b>{cities.size}</b>
          <span>다녀온 도시</span>
        </div>
        <div className="kpi">
          <b>{trips.length}</b>
          <span>여행 횟수 · 총 {days}일</span>
        </div>
        <div className="kpi">
          <b>{wonShort(cost)}</b>
          <span>총 여행 경비</span>
        </div>
      </div>
      <div>
        <div className="sec-h">
          <h2>다녀온 나라</h2>
        </div>
        <div className="flag-list">
          {ids.length ? (
            ids.map((id) => (
              <span className="chip" key={id} onClick={() => onCountry(id)}>
                {cname(id)} {cnt[id] > 1 ? "×" + cnt[id] : ""}
              </span>
            ))
          ) : (
            <div className="empty">여행을 추가하면 나라가 지도에 색칠돼요.</div>
          )}
        </div>
      </div>
      <div>
        <div className="sec-h">
          <h2>최근 여행</h2>
          <a href="#trips" className="note">
            전체 보기 →
          </a>
        </div>
        {recent.length ? (
          recent.map((t) => <MiniTrip key={t.id} t={t} onOpen={onOpenTrip} />)
        ) : (
          <div className="empty">
            아직 기록이 없어요. 오른쪽 위 <b>+ 여행 추가</b>로 첫 여행을 남겨 보세요.
          </div>
        )}
      </div>
      <div>
        <div className="sec-h">
          <h2>가고 싶은 곳</h2>
        </div>
        {wishes.length ? (
          wishes.map((w) => (
            <div className="wish-item" key={w.id}>
              <span>
                ☆ <b>{w.name}</b> <span className="note">{cname(w.cid)}</span>
              </span>
              <button className="btn small ghost" onClick={() => onWishGo(w)}>
                보기
              </button>
            </div>
          ))
        ) : (
          <div className="empty">
            지도 위 <b>☆ 가고 싶은 곳</b>으로 다음 여행지를 찍어 두세요.
          </div>
        )}
      </div>
    </aside>
  );
}
