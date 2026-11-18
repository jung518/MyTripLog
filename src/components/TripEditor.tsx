import { useEffect, useRef, useState } from "react";
import { CATS, KO } from "../lib/data";
import { tripCost, won, wonShort } from "../lib/format";
import { cname, countryFor } from "../lib/geo";
import { LIMITS } from "../lib/limits";
import { toast } from "../lib/ui";
import { store } from "../store";
import type { City, Expense, Hotel, Trip, TripDraft } from "../types";
import { CitySearch } from "./CitySearch";
import {
  Button,
  DateRangePicker,
  Field,
  FieldRow,
  IconButton,
  Modal,
  MoneyInput,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "./ui";

export interface EditorRequest {
  trip: Trip | null;
  /** 처음부터 넣어 둘 도시 (가고 싶은 곳 → 다녀왔어요) */
  initialCity?: City;
  /** 저장하면 지울 가고 싶은 곳 id */
  fromWish?: string;
}

interface Props {
  request: EditorRequest;
  show: boolean;
  onClose: () => void;
  /** 지도에서 위치 찍기 (편집 창은 잠시 숨김) */
  onStartPick: (text: string, cb: (lat: number, lng: number) => void) => void;
}

function blankTrip(): TripDraft {
  return {
    title: "",
    start: "",
    end: "",
    with: "",
    memo: "",
    cities: [],
    hotels: [],
    expenses: [],
  };
}

const addCityTo = (d: TripDraft, c: City): TripDraft => ({ ...d, cities: [...d.cities, c] });

/** 예전 기록에 남아 있을 수 있는 필드(사진, 통화·환율, 별점, 태그)를 버림. 다시 저장하면 깨끗해짐 */
const LEGACY_TRIP = ["photos", "cover", "currency", "rate", "rating", "tags"];
const omit = <T extends object>(o: T, keys: string[]): T =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k))) as T;

function initDraft(req: EditorRequest): TripDraft {
  let d: TripDraft = blankTrip();
  if (req.trip) {
    const t = omit(structuredClone(req.trip), LEGACY_TRIP);
    d = {
      ...d,
      ...t,
      // 숙소 도시·경비 날짜는 더 이상 쓰지 않음 (도시는 위 방문 도시로 충분)
      hotels: (t.hotels || []).map((h) => omit(h, ["currency", "rating", "city"])),
      expenses: (t.expenses || []).map((e) => omit(e, ["currency", "date"])),
    };
  }
  if (req.initialCity) d = addCityTo(d, req.initialCity);
  return d;
}

const COUNTRY_IDS = Object.keys(KO);
/** 경비 항목 선택지. 예전에 고른 항목이 목록에 없으면(예: 숙박) 그 줄에서만 보이게 덧붙임 */
const catOpts = (current: string) =>
  [...CATS, ...(current && !CATS.includes(current) ? [current] : [])].map((c) => ({ value: c, label: c }));

const X = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** 이 컴포넌트는 열 때마다 key를 바꿔 새로 만들어집니다 (초안 초기화). */
export function TripEditor({ request, show, onClose, onStartPick }: Props) {
  const [draft, setDraft] = useState<TripDraft>(() => initDraft(request));
  const [cityQ, setCityQ] = useState("");
  const [saving, setSaving] = useState(false);
  const expRowsRef = useRef<HTMLDivElement>(null);
  const focusNewExp = useRef(false);

  const set = <K extends keyof TripDraft>(k: K, v: TripDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function setRow<A extends "cities" | "hotels" | "expenses">(
    arr: A,
    i: number,
    patch: Partial<TripDraft[A][number]>,
  ) {
    setDraft((d) => ({ ...d, [arr]: d[arr].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }
  const delRow = (arr: "cities" | "hotels" | "expenses", i: number) =>
    setDraft((d) => ({ ...d, [arr]: d[arr].filter((_, j) => j !== i) }));

  const addCity = (c: City) => setDraft((d) => addCityTo(d, c));

  function pickCity() {
    const name = cityQ.trim() || "새 장소";
    onStartPick(`‘${name}’ 위치를 지도에서 클릭하세요 (확대해서 찍으면 정확해요)`, (lat, lng) => {
      addCity({ name, lat, lng, cid: countryFor(lat, lng) });
      setCityQ("");
    });
  }

  function addHotel() {
    setDraft((d) => {
      const h: Hotel = {
        name: "",
        checkIn: d.start,
        checkOut: d.end,
        price: "",
        memo: "",
      };
      return { ...d, hotels: [...d.hotels, h] };
    });
  }

  function addExpense() {
    setDraft((d) => {
      const last = d.expenses[d.expenses.length - 1];
      const e: Expense = {
        category: last ? "식비" : "항공",
        desc: "",
        amount: "",
      };
      return { ...d, expenses: [...d.expenses, e] };
    });
    focusNewExp.current = true;
  }

  useEffect(() => {
    if (!focusNewExp.current) return;
    focusNewExp.current = false;
    const ins = expRowsRef.current?.querySelectorAll<HTMLInputElement>("input[data-f=desc]");
    ins?.[ins.length - 1]?.focus();
  }, [draft.expenses.length]);

  async function save() {
    const d: TripDraft = {
      ...draft,
      title: draft.title.trim(),
      with: draft.with.trim(),
    };
    // 제목이 비어 있으면 도시 이름으로 자동 제목 (글자 수 한도 안에서)
    if (!d.title)
      d.title = d.cities.length
        ? (d.cities.map((c) => c.name).slice(0, 3).join("·") + " 여행").slice(0, LIMITS.tripTitle)
        : "";
    if (!d.title && !d.cities.length) {
      toast("제목이나 도시를 하나 이상 입력해 주세요");
      return;
    }
    if (d.start && d.end && d.end < d.start) {
      toast("귀국일이 출발일보다 빨라요");
      return;
    }
    d.hotels = d.hotels.filter((h) => h.name || h.price);
    d.expenses = d.expenses.filter((e) => (e.amount !== "" && e.amount != null) || e.desc);
    if (!d.createdAt) d.createdAt = new Date().toISOString();
    setSaving(true);
    try {
      await store.save("trips", d);
      if (request.fromWish) {
        try {
          await store.remove("wishes", request.fromWish);
        } catch {
          /* 무시 */
        }
      }
      onClose();
      toast("저장했어요");
    } catch {
      /* store가 이미 알림을 띄움 */
    } finally {
      setSaving(false);
    }
  }

  const countryOpts = (sel: string) => [
    { value: "", label: "-" },
    ...[...new Set([...COUNTRY_IDS, ...(sel ? [sel] : [])])]
      .sort((a, b) => cname(a).localeCompare(cname(b), "ko"))
      .map((id) => ({ value: id, label: cname(id) })),
  ];
  const cost = tripCost(draft);
  // 숙소·경비 날짜를 고를 때 달력에 여행 기간을 은은하게 표시
  const tripRange = { start: draft.start, end: draft.end };

  return (
    <Modal
      show={show}
      title={request.trip ? "여행 수정" : "여행 추가"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </>
      }
    >
      <div className="modal-b">
        <fieldset>
          <legend>기본 정보</legend>
          <FieldRow>
            <Field label="여행 제목" span={2}>
              <TextInput
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="예: 첫 오사카 미식 여행"
                maxLength={LIMITS.tripTitle}
                onClear={() => set("title", "")}
              />
            </Field>
            <Field label="여행 기간" span={2}>
              <DateRangePicker
                start={draft.start}
                end={draft.end}
                onChange={(start, end) => setDraft((d) => ({ ...d, start, end }))}
                placeholder="출발일 – 귀국일"
                ariaLabel="여행 기간"
              />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="동행">
              <TextInput value={draft.with} onChange={(e) => set("with", e.target.value)} placeholder="혼자, 친구, 가족…"
                maxLength={LIMITS.tripWith}
              />
            </Field>
          </FieldRow>
          <Field label="메모 / 여행 일기">
            <TextArea
              value={draft.memo}
              onChange={(e) => set("memo", e.target.value)}
              placeholder="기억하고 싶은 순간, 맛집, 다음에 다시 가면 할 것…"
              rows={5}
              maxLength={LIMITS.tripMemo}
              diary
            />
          </Field>
        </fieldset>

        <fieldset>
          <legend>방문한 도시</legend>
          <div className="rowhead city">
            <span>도시</span>
            <span>나라</span>
            <span>위도</span>
            <span>경도</span>
          </div>
          <div className="rows">
            {draft.cities.length ? (
              draft.cities.map((c, i) => (
                <div className="row city" key={i}>
                  <TextInput
                    aria-label="도시 이름"
                    maxLength={LIMITS.cityName}
                    value={c.name}
                    onChange={(e) => setRow("cities", i, { name: e.target.value })}
                  />
                  <Select
                    value={c.cid || ""}
                    options={countryOpts(c.cid)}
                    onChange={(v) => setRow("cities", i, { cid: v })}
                    ariaLabel="나라"
                  />
                  <NumberInput
                    aria-label="위도"
                    placeholder="위도"
                    value={c.lat}
                    onValue={(v) => setRow("cities", i, { lat: v === "" ? null : v })}
                  />
                  <NumberInput
                    aria-label="경도"
                    placeholder="경도"
                    value={c.lng}
                    onValue={(v) => setRow("cities", i, { lng: v === "" ? null : v })}
                  />
                  <IconButton label="도시 삭제" className="x" onClick={() => delRow("cities", i)}>
                    {X}
                  </IconButton>
                </div>
              ))
            ) : (
              <div className="note">아직 도시가 없어요.</div>
            )}
          </div>
          <CitySearch value={cityQ} onChange={setCityQ} onPick={addCity} placeholder="도시 검색 (예: 타이베이, 방콕, 다낭)">
            <Button size="sm" onClick={pickCity}>
              지도에서 찍기
            </Button>
          </CitySearch>
          <div className="note" style={{ marginTop: 6 }}>
            목록에 없는 도시는 이름을 입력하고 ‘지도에서 찍기’로 위치를 정하세요.
          </div>
        </fieldset>

        <fieldset>
          <legend>숙소</legend>
          <div className="rowhead hotel">
            <span>호텔 이름</span>
            <span>숙박 기간</span>
            <span>총 금액</span>
          </div>
          <div className="rows">
            {draft.hotels.map((h, i) => (
              <div className="row hotel" key={i}>
                <TextInput
                  aria-label="호텔 이름"
                  maxLength={LIMITS.hotelName}
                  placeholder="호텔 이름"
                  value={h.name}
                  onChange={(e) => setRow("hotels", i, { name: e.target.value })}
                />
                <DateRangePicker
                  start={h.checkIn || ""}
                  end={h.checkOut || ""}
                  onChange={(checkIn, checkOut) => setRow("hotels", i, { checkIn, checkOut })}
                  placeholder="체크인 – 체크아웃"
                  labels={["체크인", "체크아웃"]}
                  sameDayLabel="대실"
                  defaultMonth={draft.start}
                  highlight={tripRange}
                  ariaLabel="숙박 기간"
                />
                <MoneyInput
                  aria-label="숙소 총 금액 (원)"
                  placeholder="금액"
                  suffix="원"
                  value={h.price}
                  onValue={(v) => setRow("hotels", i, { price: v })}
                />
                <IconButton label="숙소 삭제" className="x" onClick={() => delRow("hotels", i)}>
                  {X}
                </IconButton>
                <TextInput
                  aria-label="숙소 메모"
                  maxLength={LIMITS.hotelMemo}
                  placeholder="메모 (위치, 조식, 다시 묵을지…)"
                  value={h.memo || ""}
                  onChange={(e) => setRow("hotels", i, { memo: e.target.value })}
                  boxStyle={{ gridColumn: "1/-1" }}
                />
              </div>
            ))}
          </div>
          <Button size="sm" style={{ marginTop: 8 }} onClick={addHotel}>
            + 숙소 추가
          </Button>
        </fieldset>

        <fieldset>
          <legend>경비</legend>
          <div className="rowhead exp">
            <span>항목</span>
            <span>상세 내용</span>
            <span>금액</span>
          </div>
          <div className="rows" ref={expRowsRef}>
            {draft.expenses.map((x, i) => (
              <div className="row exp" key={i}>
                <Select
                  value={x.category}
                  options={catOpts(x.category)}
                  onChange={(v) => setRow("expenses", i, { category: v })}
                  ariaLabel="항목"
                />
                <TextInput
                  data-f="desc"
                  aria-label="경비 상세 내용"
                  maxLength={LIMITS.expenseDesc}
                  placeholder="상세 내용"
                  boxClassName="exp-desc"
                  value={x.desc || ""}
                  onChange={(e) => setRow("expenses", i, { desc: e.target.value })}
                />
                <MoneyInput
                  aria-label="경비 금액 (원)"
                  placeholder="금액"
                  suffix="원"
                  value={x.amount}
                  onValue={(v) => setRow("expenses", i, { amount: v })}
                />
                <IconButton label="경비 삭제" className="x" onClick={() => delRow("expenses", i)}>
                  {X}
                </IconButton>
              </div>
            ))}
          </div>
          <Button size="sm" style={{ marginTop: 8 }} onClick={addExpense}>
            + 경비 추가
          </Button>
          <div className="sum">
            {cost.total > 0 && (
              <>
                <span>
                  합계 <b>{won(cost.total)}</b>
                </span>
                {Object.entries(cost.byCat)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <span key={k}>
                      {k} <b>{wonShort(v)}</b>
                    </span>
                  ))}
              </>
            )}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
