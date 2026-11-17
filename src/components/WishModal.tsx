import { useState } from "react";
import { cname, countryFor } from "../lib/geo";
import { toast } from "../lib/ui";
import { store } from "../store";
import type { City } from "../types";
import { CitySearch } from "./CitySearch";
import { Modal } from "./Modal";

interface Props {
  show: boolean;
  onClose: () => void;
  onStartPick: (text: string, cb: (lat: number, lng: number) => void) => void;
}

/** 열 때마다 key를 바꿔 새로 만들어집니다. */
export function WishModal({ show, onClose, onStartPick }: Props) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<City | null>(null);
  const [memo, setMemo] = useState("");

  function pick() {
    const name = q.trim() || "가고 싶은 곳";
    onStartPick(`‘${name}’ 위치를 클릭하세요`, (lat, lng) => setChosen({ name, lat, lng, cid: countryFor(lat, lng) }));
  }

  async function save() {
    if (!chosen) {
      toast("장소를 먼저 골라 주세요");
      return;
    }
    try {
      await store.save("wishes", { ...chosen, memo: memo.trim(), createdAt: new Date().toISOString() });
      onClose();
      toast("가고 싶은 곳에 추가했어요");
    } catch {
      /* store가 이미 알림을 띄움 */
    }
  }

  return (
    <Modal
      show={show}
      title="가고 싶은 곳"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" onClick={save}>
            저장
          </button>
        </>
      }
    >
      <div className="modal-b">
        <CitySearch
          value={q}
          onChange={setQ}
          onPick={setChosen}
          placeholder="도시 검색 (예: 치앙마이, 삿포로)"
          style={{ marginTop: 0 }}
        >
          <button className="btn small" onClick={pick}>
            📍 지도에서 찍기
          </button>
        </CitySearch>
        <div className="note" style={{ margin: "8px 0" }}>
          {chosen ? (
            <>
              선택: <b>{chosen.name}</b> ({cname(chosen.cid)})
            </>
          ) : (
            "선택된 곳 없음"
          )}
        </div>
        <label className="f">
          메모
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="언제쯤, 누구랑, 뭐 하고 싶은지" />
        </label>
      </div>
    </Modal>
  );
}
