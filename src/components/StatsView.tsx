import { CAT_COLORS } from "../lib/data";
import {
  byStartDesc,
  daysBetween,
  fmtDate,
  stars,
  toKRW,
  tripCost,
  tripCountries,
  tripDays,
  tripLen,
  tripYear,
  wonShort,
} from "../lib/format";
import { cname } from "../lib/geo";
import type { Trip } from "../types";
import { Bars, type BarRow } from "./Bars";

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
      krw: toKRW(t, h.price, h.currency),
    })),
  );
  const nights = hotels.reduce((s, h) => s + (h.checkIn && h.checkOut ? h.nights : 0), 0);
  const abroad = [...countries].filter((c) => c !== "410").length;
  const kpis: [string | number, string][] = [
    [abroad, "다녀온 나라"],
    [cities.size, "다녀온 도시"],
    [ts.length, "여행 횟수"],
    [days + "일", "여행한 날"],
    [wonShort(total), "총 경비"],
    [days ? wonShort(total / days) : "-", "하루 평균"],
    [ts.length ? wonShort(total / ts.length) : "-", "여행당 평균"],
    [nights + "박", "호텔 숙박"],
  ];
  const perDay: BarRow[] = ts
    .filter((t) => tripDays(t))
    .map((t): BarRow => [t.title || "제목 없음", tripCost(t).total / tripDays(t)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const hs = [...hotels].sort(
    (a, b) => (b.rating || 0) - (a.rating || 0) || (b.trip.start || "").localeCompare(a.trip.start || ""),
  );
  const tl = [...ts].sort(byStartDesc);

  return (
    <div className="page">
      <div className="stat-grid">
        {kpis.map(([b, s]) => (
          <div className="kpi" key={s}>
            <b>{b}</b>
            <span>{s}</span>
          </div>
        ))}
      </div>
      <div className="two">
        <div className="panel">
          <h2>연도별 경비</h2>
          <Bars rows={Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0]))} />
        </div>
        <div className="panel">
          <h2>항목별 경비</h2>
          <Bars rows={Object.entries(byCat).sort((a, b) => b[1] - a[1])} colorOf={(k) => CAT_COLORS[k] || "#9c968a"} />
        </div>
      </div>
      <div className="two">
        <div className="panel">
          <h2>나라별 방문</h2>
          <Bars
            rows={Object.entries(byC)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]): BarRow => [cname(k), v])}
            fmt={(v) => v + "번"}
            colorOf={() => "var(--pin)"}
          />
        </div>
        <div className="panel">
          <h2>하루 평균 경비 (여행별)</h2>
          <Bars rows={perDay} />
        </div>
      </div>
      <div className="two">
        <div className="panel">
          <h2>호텔 기록</h2>
          {hs.length ? (
            <table>
              <tbody>
                <tr>
                  <th>호텔</th>
                  <th>도시</th>
                  <th className="num">박</th>
                  <th className="num">1박 평균</th>
                  <th>별점</th>
                </tr>
                {hs.slice(0, 15).map((h, i) => (
                  <tr key={i}>
                    <td>{h.name}</td>
                    <td>{h.city || ""}</td>
                    <td className="num">{h.checkIn && h.checkOut ? h.nights : "-"}</td>
                    <td className="num">{h.krw ? wonShort(h.krw / h.nights) : "-"}</td>
                    <td className="stars">{stars(+h.rating || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">숙소 기록이 없어요</div>
          )}
        </div>
        <div className="panel">
          <h2>여행 타임라인</h2>
          <div className="timeline">
            {tl.length ? (
              tl.map((t) => (
                <div className="tl-item" key={t.id} onClick={() => onOpenTrip(t.id)}>
                  <div className="y">
                    {fmtDate(t.start)} · {tripLen(t)}
                  </div>
                  <b>{t.title || "제목 없음"}</b> <span className="note">{tripCountries(t).map(cname).join(", ")}</span>
                </div>
              ))
            ) : (
              <div className="empty">아직 기록이 없어요</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
