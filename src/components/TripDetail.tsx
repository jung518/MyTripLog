import { useEffect, useState } from "react";
import { CAT_COLORS } from "../lib/data";
import { fmtDate, stars, toKRW, tripCost, tripCountries, tripDays, tripLen, won, wonShort } from "../lib/format";
import { cname } from "../lib/geo";
import { toast } from "../lib/ui";
import { store } from "../store";
import type { Trip } from "../types";
import { Bars } from "./Bars";
import { Modal } from "./Modal";
import { coverUrl } from "./TripsView";

interface Props {
  trip: Trip | null;
  show: boolean;
  onClose: () => void;
  onEdit: (t: Trip) => void;
  onShowOnMap: (t: Trip) => void;
  onPhoto: (src: string) => void;
}

export function TripDetail({ trip, show, onClose, onEdit, onShowOnMap, onPhoto }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(false);
  }, [trip?.id, show]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  async function del() {
    if (!trip) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    try {
      await store.remove("trips", trip.id);
      onClose();
      toast("삭제했어요");
    } catch {
      /* store가 이미 알림을 띄움 */
    }
  }

  return (
    <Modal
      show={show && !!trip}
      title="여행 상세"
      onClose={onClose}
      footer={
        <>
          <button className={"btn danger" + (armed ? " armed" : "")} onClick={del}>
            {armed ? "한 번 더 누르면 삭제" : "삭제"}
          </button>
          <div className="spacer" />
          <button className="btn" onClick={() => trip && onShowOnMap(trip)}>
            지도에서 보기
          </button>
          <button className="btn primary" onClick={() => trip && onEdit(trip)}>
            수정
          </button>
        </>
      }
    >
      <div className="modal-b">{trip && <DetailBody t={trip} onPhoto={onPhoto} />}</div>
    </Modal>
  );
}

function DetailBody({ t, onPhoto }: { t: Trip; onPhoto: (src: string) => void }) {
  const c = tripCost(t);
  const cv = coverUrl(t);
  const days = tripDays(t);
  const cities = t.cities || [];
  const hotels = t.hotels || [];
  const tags = t.tags || [];
  const photos = t.photos || [];
  const exps = [...(t.expenses || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const catBars = Object.entries(c.byCat).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div
        className="d-hero"
        style={
          cv ? { backgroundImage: `linear-gradient(transparent 40%,rgba(0,0,0,.55)),url('${cv}')` } : undefined
        }
      >
        <div className="note" style={{ color: "#fffd" }}>
          {tripCountries(t).map(cname).join(" · ")}
        </div>
        <h2>{t.title || "제목 없음"}</h2>
        <div>
          {fmtDate(t.start)}
          {t.end ? " – " + fmtDate(t.end) : ""} · {tripLen(t)}
          {t.with ? " · " + t.with : ""} <span className="stars">{stars(t.rating || 0)}</span>
        </div>
      </div>
      <div className="stat-grid">
        <div className="kpi">
          <b>{won(c.total)}</b>
          <span>총 경비</span>
        </div>
        <div className="kpi">
          <b>{days ? wonShort(c.total / days) : "-"}</b>
          <span>하루 평균</span>
        </div>
        <div className="kpi">
          <b>{cities.length}</b>
          <span>도시</span>
        </div>
        <div className="kpi">
          <b>{hotels.length}</b>
          <span>숙소</span>
        </div>
      </div>
      {cities.length > 0 && (
        <div className="panel">
          <h2>경로</h2>
          {cities.map((x) => x.name).join(" → ")}
        </div>
      )}
      {(t.memo || tags.length > 0) && (
        <div className="panel">
          <h2>메모</h2>
          {tags.map((x) => (
            <span className="tag" key={x}>
              #{x}
            </span>
          ))}
          <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{t.memo || ""}</p>
        </div>
      )}
      {hotels.length > 0 && (
        <div className="panel">
          <h2>숙소</h2>
          <div style={{ overflow: "auto" }}>
            <table>
              <tbody>
                <tr>
                  <th>호텔</th>
                  <th>도시</th>
                  <th>기간</th>
                  <th className="num">금액</th>
                  <th className="num">원화</th>
                  <th>별점</th>
                </tr>
                {hotels.map((h, i) => (
                  <tr key={i}>
                    <td>
                      <b>{h.name}</b>
                      {h.memo && (
                        <>
                          <br />
                          <span className="note">{h.memo}</span>
                        </>
                      )}
                    </td>
                    <td>{h.city || ""}</td>
                    <td>
                      {fmtDate(h.checkIn)} – {fmtDate(h.checkOut)}
                    </td>
                    <td className="num">
                      {h.price ? (+h.price).toLocaleString("ko-KR") + " " + (h.currency || "") : ""}
                    </td>
                    <td className="num">{won(toKRW(t, h.price, h.currency))}</td>
                    <td className="stars">{stars(+h.rating || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {catBars.length > 0 && (
        <div className="panel">
          <h2>경비 구성</h2>
          <Bars rows={catBars} fmt={won} colorOf={(k) => CAT_COLORS[k] || "#9c968a"} />
          {t.currency && t.currency !== "KRW" && (
            <div className="note">
              환율: 1 {t.currency} = {t.rate}원
            </div>
          )}
        </div>
      )}
      {exps.length > 0 && (
        <div className="panel">
          <h2>경비 내역</h2>
          <div style={{ overflow: "auto" }}>
            <table>
              <tbody>
                <tr>
                  <th>날짜</th>
                  <th>항목</th>
                  <th>내용</th>
                  <th className="num">금액</th>
                  <th className="num">원화</th>
                </tr>
                {exps.map((e, i) => (
                  <tr key={i}>
                    <td>{fmtDate(e.date)}</td>
                    <td>
                      <span className="tag" style={{ background: `${CAT_COLORS[e.category] || "#ddd"}22` }}>
                        {e.category || "기타"}
                      </span>
                    </td>
                    <td>{e.desc || ""}</td>
                    <td className="num">
                      {(+e.amount || 0).toLocaleString("ko-KR")} {e.currency || ""}
                    </td>
                    <td className="num">{won(toKRW(t, e.amount, e.currency))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {photos.length > 0 && (
        <div className="panel">
          <h2>사진</h2>
          <div className="photos">
            {photos.map((p) => {
              const src = store.photoUrl(p.id);
              return (
                <div className="ph" key={p.id}>
                  <img src={src} alt="" loading="lazy" onClick={() => onPhoto(src)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
