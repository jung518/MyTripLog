import { CAT_COLORS } from "../lib/data";
import {
  amt,
  byStartDesc,
  daysBetween,
  fmtDate,
  tripCost,
  tripCountries,
  tripDays,
  tripLen,
  tripYear,
  wonShort,
} from "../lib/format";
import { cname } from "../lib/geo";
import type { Trip } from "../types";
import { Bars } from "./Bars";
import { EmptyState, Kpi, Panel, TableScroll } from "./ui";

interface Props {
  trips: Trip[];
  onOpenTrip: (id: string) => void;
}

export function StatsView({ trips: ts, onOpenTrip }: Props) {
  let total = 0;
  let days = 0;
  const byYear: Record<string, number> = {};
  const byCat: Record<string, number> = {};
  const byC: Record<string, number> = {};
  const countries = new Set<string>();
  const cities = new Set<string>();
  ts.forEach((t) => {
    const c = tripCost(t);
    total += c.total;
    days += tripDays(t);
    const y = tripYear(t) || "미정";
    byYear[y] = (byYear[y] || 0) + c.total;
    Object.entries(c.byCat).forEach(([k, v]) => (byCat[k] = (byCat[k] || 0) + v));
    tripCountries(t).forEach((x) => {
      countries.add(x);
      byC[x] = (byC[x] || 0) + 1;
    });
    (t.cities || []).forEach((x) => cities.add(x.name));
  });
  const hotels = ts.flatMap((t) =>
    (t.hotels || []).map((h) => ({
      ...h,
      trip: t,
      nights: Math.max(1, daysBetween(h.checkIn, h.checkOut)),
      krw: amt(h.price),
    })),
  );
  const abroad = [...countries].filter((c) => c !== "410").length;
  const avg = ts.length ? wonShort(total / ts.length) : "-";
  // 나라 도장: 많이 간 순, 같으면 가나다순
  const stamps = Object.entries(byC).sort((a, b) => b[1] - a[1] || cname(a[0]).localeCompare(cname(b[0]), "ko"));
  const hs = [...hotels].sort((a, b) => (b.trip.start || "").localeCompare(a.trip.start || ""));
  const tl = [...ts].sort(byStartDesc);

  /* 벤토 그리드: 여권 표지 타일(다녀온 나라 + 도장) → 숫자 타일 → 경비 그래프 → 타임라인·호텔 */
  return (
    <div className="page">
      <div className="bento">
        <section className="b-hero" aria-label="다녀온 나라">
          <div className="b-hero-k">VISITED · 다녀온 나라</div>
          <div className="b-hero-n">
            <b>{abroad}</b>개국
          </div>
          {stamps.length ? (
            <ul className="b-stamps">
              {stamps.map(([id, n]) => (
                <li key={id}>
                  {cname(id)}
                  {n > 1 && <small>×{n}</small>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="b-hero-empty">첫 여행을 기록하면 여기에 입국 도장이 찍혀요.</p>
          )}
        </section>
        <Kpi value={cities.size} label="다녀온 도시" />
        <Kpi value={ts.length} label="여행 횟수" />
        <Kpi value={days + "일"} label="여행한 날" />
        <Kpi value={wonShort(total)} label={<>총 경비 · 여행당 평균 {avg}</>} />
        <Panel title="연도별 경비">
          <Bars rows={Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0]))} />
        </Panel>
        <Panel title="항목별 경비">
          <Bars rows={Object.entries(byCat).sort((a, b) => b[1] - a[1])} colorOf={(k) => CAT_COLORS[k] || "#9c968a"} />
        </Panel>
        <Panel title="호텔 기록">
          {hs.length ? (
            <TableScroll>
              {/* 칸이 3개뿐이라 휴대폰에서도 옆으로 밀지 않고 화면에 맞춤 */}
              <table className="fit">
                <tbody>
                  <tr>
                    <th>호텔</th>
                    <th className="num">박</th>
                    <th className="num">1박 평균</th>
                  </tr>
                  {hs.slice(0, 15).map((h, i) => (
                    <tr key={i}>
                      <td>{h.name}</td>
                      <td className="num">{h.checkIn && h.checkOut ? h.nights : "-"}</td>
                      <td className="num">{h.krw ? wonShort(h.krw / h.nights) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          ) : (
            <EmptyState compact title="숙소 기록이 없어요" />
          )}
        </Panel>
        <Panel title="여행 타임라인">
          <div className="timeline">
            {tl.length ? (
              tl.map((t) => (
                <button type="button" className="tl-item" key={t.id} onClick={() => onOpenTrip(t.id)}>
                  <span className="y">
                    {fmtDate(t.start)} · {tripLen(t)}
                  </span>
                  <b>{t.title || "제목 없음"}</b> <span className="note">{tripCountries(t).map(cname).join(", ")}</span>
                </button>
              ))
            ) : (
              <EmptyState compact title="아직 기록이 없어요" />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
