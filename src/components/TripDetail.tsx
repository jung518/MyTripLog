import { useEffect, useState } from "react";
import { CAT_COLORS } from "../lib/data";
import { amt, fmtDate, mrzLine, tripCost, tripCountries, tripLen, won } from "../lib/format";
import { cname } from "../lib/geo";
import { toast } from "../lib/ui";
import { store } from "../store";
import type { Trip } from "../types";
import { Bars } from "./Bars";
import { Button, ConfirmModal, Kpi, KpiGrid, Modal, Panel, TableScroll } from "./ui";

interface Props {
  trip: Trip | null;
  show: boolean;
  onClose: () => void;
  onEdit: (t: Trip) => void;
  onShowOnMap: (t: Trip) => void;
}

export function TripDetail({ trip, show, onClose, onEdit, onShowOnMap }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setConfirming(false);
  }, [trip?.id, show]);

  async function del() {
    if (!trip) return;
    setDeleting(true);
    try {
      await store.remove("trips", trip.id);
      setConfirming(false);
      onClose();
      toast("삭제");
    } catch {
      /* store가 이미 알림을 띄움 */
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Modal
        show={show && !!trip}
        title="여행 상세"
        onClose={onClose}
        footer={
          <>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              삭제
            </Button>
            <div className="spacer" />
            <Button onClick={() => trip && onShowOnMap(trip)}>지도에서 보기</Button>
            <Button variant="primary" onClick={() => trip && onEdit(trip)}>
              수정
            </Button>
          </>
        }
      >
        <div className="modal-b">{trip && <DetailBody t={trip} />}</div>
      </Modal>
      <ConfirmModal
        show={show && !!trip && confirming}
        title="여행 삭제"
        message={
          <>
            <b>‘{trip?.title || "제목 없음"}’</b> 여행을 삭제할까요?
            <br />
            <span className="note">삭제한 기록은 되돌릴 수 없어요.</span>
          </>
        }
        confirmLabel="삭제"
        danger
        loading={deleting}
        onConfirm={del}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

function DetailBody({ t }: { t: Trip }) {
  const c = tripCost(t);
  const cities = t.cities || [];
  const hotels = t.hotels || [];
  const exps = t.expenses || [];
  const catBars = Object.entries(c.byCat).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="d-hero">
        <div className="d-country">{tripCountries(t).map(cname).join(" · ")}</div>
        <h2>{t.title || "제목 없음"}</h2>
        <div>
          {fmtDate(t.start)}
          {t.end ? " – " + fmtDate(t.end) : ""} · {tripLen(t)}
          {t.with ? " · " + t.with : ""}
        </div>
        <div className="mrz" aria-hidden="true">
          {mrzLine(t)}
        </div>
      </div>
      <KpiGrid>
        <Kpi value={won(c.total)} label="총 경비" />
        <Kpi value={cities.length} label="도시" />
        <Kpi value={hotels.length} label="숙소" />
      </KpiGrid>
      {cities.length > 0 && <Panel title="경로">{cities.map((x) => x.name).join(" → ")}</Panel>}
      {t.memo && (
        <Panel title="메모">
          <p className="memo-text">{t.memo}</p>
        </Panel>
      )}
      {hotels.length > 0 && (
        <Panel title="숙소">
          <TableScroll>
            <table>
              <tbody>
                <tr>
                  <th>호텔</th>
                  <th>기간</th>
                  <th className="num">금액</th>
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
                    <td>
                      {fmtDate(h.checkIn)} – {fmtDate(h.checkOut)}
                    </td>
                    <td className="num">{h.price ? won(amt(h.price)) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      )}
      {catBars.length > 0 && (
        <Panel title="경비 구성">
          <Bars rows={catBars} fmt={won} colorOf={(k) => CAT_COLORS[k] || "#9c968a"} />
        </Panel>
      )}
      {exps.length > 0 && (
        <Panel title="경비 내역">
          <TableScroll>
            <table>
              <tbody>
                <tr>
                  <th>항목</th>
                  <th>상세 내용</th>
                  <th className="num">금액</th>
                </tr>
                {exps.map((e, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className="tag"
                        style={{
                          background: `${CAT_COLORS[e.category] || "#ddd"}22`,
                        }}
                      >
                        {e.category || "기타"}
                      </span>
                    </td>
                    <td>{e.desc || ""}</td>
                    <td className="num">{won(amt(e.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      )}
    </>
  );
}
