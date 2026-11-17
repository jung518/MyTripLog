import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CATS, CITIES, CUR_BY_COUNTRY, CURRENCIES, KO, RATE_HINT } from "../lib/data";
import { shrinkImage, tripCost, won, wonShort } from "../lib/format";
import { cname, countryFor } from "../lib/geo";
import { toast } from "../lib/ui";
import { store } from "../store";
import type { City, Expense, Hotel, Trip, TripDraft } from "../types";
import { CitySearch } from "./CitySearch";
import { Modal } from "./Modal";

export interface EditorRequest {
  trip: Trip | null;
  /** "이 나라 여행 추가"로 열었을 때 그 나라 통화로 맞춤 */
  presetCountry?: string;
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
    rating: 0,
    tags: [],
    memo: "",
    cities: [],
    hotels: [],
    expenses: [],
    photos: [],
    currency: "KRW",
    rate: 1,
  };
}

const withCurrency = (d: TripDraft, c: string): TripDraft => ({ ...d, currency: c, rate: RATE_HINT[c] || 1 });

function addCityTo(d: TripDraft, c: City): TripDraft {
  let n: TripDraft = { ...d, cities: [...d.cities, c] };
  const cur = c.cid ? CUR_BY_COUNTRY[c.cid] : undefined;
  if (n.currency === "KRW" && cur && cur !== "KRW") n = withCurrency(n, cur);
  return n;
}

function initDraft(req: EditorRequest): TripDraft {
  let d: TripDraft = req.trip ? { ...blankTrip(), ...structuredClone(req.trip) } : blankTrip();
  if (req.presetCountry && CUR_BY_COUNTRY[req.presetCountry]) d = withCurrency(d, CUR_BY_COUNTRY[req.presetCountry]);
  if (req.initialCity) d = addCityTo(d, req.initialCity);
  return d;
}

const numOrBlank = (v: string): number | "" => (v === "" ? "" : +v);
const numOrNull = (v: string): number | null => (v === "" ? null : +v);

const COUNTRY_IDS = Object.keys(KO);

/** 이 컴포넌트는 열 때마다 key를 바꿔 새로 만들어집니다 (초안 초기화). */
export function TripEditor({ request, show, onClose, onStartPick }: Props) {
  const [draft, setDraft] = useState<TripDraft>(() => initDraft(request));
  const [tagsText, setTagsText] = useState(() => (draft.tags || []).join(", "));
  const [cityQ, setCityQ] = useState("");
  const [uploading, setUploading] = useState(false);
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

  function changeCurrency(c: string) {
    setDraft((d) => {
      const prev = d.currency;
      // 기존 현지통화 항목도 새 통화로 맞춤
      const conv = <T extends { currency: string }>(x: T): T =>
        x.currency === prev && prev !== "KRW" ? { ...x, currency: c } : x;
      return { ...withCurrency(d, c), hotels: d.hotels.map(conv), expenses: d.expenses.map(conv) };
    });
  }

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
        city: d.cities.length ? d.cities[d.cities.length - 1].name : "",
        checkIn: d.start,
        checkOut: d.end,
        price: "",
        currency: d.currency,
        rating: 0,
        memo: "",
      };
      return { ...d, hotels: [...d.hotels, h] };
    });
  }

  function addExpense() {
    setDraft((d) => {
      const last = d.expenses[d.expenses.length - 1];
      const e: Expense = {
        date: last?.date || d.start,
        category: last ? "식비" : "항공",
        desc: "",
        amount: "",
        currency: last ? last.currency : "KRW",
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

  async function onPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    let n = 0;
    for (const f of files) {
      toast(`사진 올리는 중… (${++n}/${files.length})`);
      try {
        const id = await store.addPhoto(await shrinkImage(f));
        setDraft((d) => ({ ...d, photos: [...d.photos, { id }] }));
      } catch {
        toast("사진을 올리지 못했어요");
      }
    }
    setUploading(false);
    toast("사진을 추가했어요");
  }

  function removePhoto(i: number) {
    setDraft((d) => {
      const p = d.photos[i];
      return { ...d, photos: d.photos.filter((_, j) => j !== i), cover: d.cover === p.id ? "" : d.cover };
    });
  }

  async function save() {
    const d: TripDraft = {
      ...draft,
      title: draft.title.trim(),
      with: draft.with.trim(),
      tags: tagsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (!d.title) d.title = d.cities.length ? d.cities.map((c) => c.name).slice(0, 3).join("·") + " 여행" : "";
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
      await store.cleanupPhotos();
      onClose();
      toast("저장했어요 ✈️");
    } catch {
      /* store가 이미 알림을 띄움 */
    } finally {
      setSaving(false);
    }
  }

  const curOpts = [...new Set(["KRW", draft.currency, ...CURRENCIES])];
  const countryIds = (sel: string) =>
    [...new Set([...COUNTRY_IDS, ...(sel ? [sel] : [])])].sort((a, b) => cname(a).localeCompare(cname(b), "ko"));
  const cost = tripCost(draft);

  return (
    <Modal
      show={show}
      title={request.trip ? "여행 수정" : "여행 추가"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" onClick={save} disabled={uploading || saving}>
            저장
          </button>
        </>
      }
    >
      <div className="modal-b">
        <fieldset>
          <legend>기본 정보</legend>
          <div className="frow">
            <label className="f" style={{ gridColumn: "span 2" }}>
              여행 제목
              <input
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="예: 첫 오사카 미식 여행"
              />
            </label>
            <label className="f">
              출발일
              <input type="date" value={draft.start} onChange={(e) => set("start", e.target.value)} />
            </label>
            <label className="f">
              귀국일
              <input type="date" value={draft.end} onChange={(e) => set("end", e.target.value)} />
            </label>
          </div>
          <div className="frow">
            <label className="f">
              동행
              <input value={draft.with} onChange={(e) => set("with", e.target.value)} placeholder="혼자, 친구, 가족…" />
            </label>
            <label className="f">
              만족도
              <select value={draft.rating || 0} onChange={(e) => set("rating", +e.target.value)}>
                <option value="0">-</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
            </label>
            <label className="f" style={{ gridColumn: "span 2" }}>
              태그 (쉼표로 구분)
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="미식, 온천, 휴양" />
            </label>
          </div>
          <label className="f">
            메모 / 여행 일기
            <textarea
              value={draft.memo}
              onChange={(e) => set("memo", e.target.value)}
              placeholder="기억하고 싶은 순간, 맛집, 다음에 다시 가면 할 것…"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>방문한 도시</legend>
          <div className="rowhead city">
            <span>도시</span>
            <span>나라</span>
            <span>위도</span>
            <span>경도</span>
            <span />
          </div>
          <div className="rows">
            {draft.cities.length ? (
              draft.cities.map((c, i) => (
                <div className="row city" key={i}>
                  <input value={c.name} onChange={(e) => setRow("cities", i, { name: e.target.value })} />
                  <select value={c.cid || ""} onChange={(e) => setRow("cities", i, { cid: e.target.value })}>
                    <option value="">-</option>
                    {countryIds(c.cid).map((id) => (
                      <option key={id} value={id}>
                        {cname(id)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="any"
                    value={c.lat ?? ""}
                    onChange={(e) => setRow("cities", i, { lat: numOrNull(e.target.value) })}
                  />
                  <input
                    type="number"
                    step="any"
                    value={c.lng ?? ""}
                    onChange={(e) => setRow("cities", i, { lng: numOrNull(e.target.value) })}
                  />
                  <button className="x" title="삭제" onClick={() => delRow("cities", i)}>
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="note">아직 도시가 없어요.</div>
            )}
          </div>
          <CitySearch
            value={cityQ}
            onChange={setCityQ}
            onPick={addCity}
            placeholder="도시 검색 (예: 타이베이, 방콕, 다낭)"
          >
            <button className="btn small" onClick={pickCity}>
              📍 지도에서 찍기
            </button>
          </CitySearch>
          <div className="note" style={{ marginTop: 6 }}>
            목록에 없는 도시는 이름을 입력하고 ‘지도에서 찍기’로 위치를 정하세요.
          </div>
        </fieldset>

        <fieldset>
          <legend>통화 · 환율</legend>
          <div className="frow">
            <label className="f">
              현지 통화
              <select value={draft.currency} onChange={(e) => changeCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="f">
              환율 (1 현지통화 = ? 원)
              <input
                type="number"
                step="any"
                value={draft.rate ?? 1}
                onChange={(e) => set("rate", +e.target.value || 0)}
              />
            </label>
            <div className="note" style={{ alignSelf: "end" }}>
              기본값은 대략적인 값이에요. 실제 환전한 환율로 바꿔 두면 원화 합계가 정확해져요.
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>숙소</legend>
          <div className="rowhead hotel">
            <span>호텔 이름</span>
            <span>도시</span>
            <span>체크인</span>
            <span>체크아웃</span>
            <span>총 금액</span>
            <span>통화</span>
            <span>별점</span>
            <span />
          </div>
          <div className="rows">
            {draft.hotels.map((h, i) => (
              <div className="row hotel" key={i}>
                <input
                  placeholder="호텔 이름"
                  value={h.name}
                  onChange={(e) => setRow("hotels", i, { name: e.target.value })}
                />
                <input
                  placeholder="도시"
                  list="cityList"
                  value={h.city || ""}
                  onChange={(e) => setRow("hotels", i, { city: e.target.value })}
                />
                <input
                  type="date"
                  value={h.checkIn || ""}
                  onChange={(e) => setRow("hotels", i, { checkIn: e.target.value })}
                />
                <input
                  type="date"
                  value={h.checkOut || ""}
                  onChange={(e) => setRow("hotels", i, { checkOut: e.target.value })}
                />
                <input
                  type="number"
                  step="any"
                  placeholder="금액"
                  value={h.price ?? ""}
                  onChange={(e) => setRow("hotels", i, { price: numOrBlank(e.target.value) })}
                />
                <select value={h.currency} onChange={(e) => setRow("hotels", i, { currency: e.target.value })}>
                  {curOpts.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select value={+h.rating || 0} onChange={(e) => setRow("hotels", i, { rating: +e.target.value })}>
                  <option value="0">-</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}★
                    </option>
                  ))}
                </select>
                <button className="x" title="삭제" onClick={() => delRow("hotels", i)}>
                  ×
                </button>
                <input
                  placeholder="메모 (위치, 조식, 다시 묵을지…)"
                  value={h.memo || ""}
                  onChange={(e) => setRow("hotels", i, { memo: e.target.value })}
                  style={{ gridColumn: "1/-1" }}
                />
              </div>
            ))}
          </div>
          <button className="btn small" style={{ marginTop: 8 }} onClick={addHotel}>
            + 숙소 추가
          </button>
        </fieldset>

        <fieldset>
          <legend>경비</legend>
          <div className="rowhead exp">
            <span>날짜</span>
            <span>항목</span>
            <span>내용</span>
            <span>금액</span>
            <span>통화</span>
            <span />
          </div>
          <div className="rows" ref={expRowsRef}>
            {draft.expenses.map((x, i) => (
              <div className="row exp" key={i}>
                <input
                  type="date"
                  value={x.date || ""}
                  onChange={(e) => setRow("expenses", i, { date: e.target.value })}
                />
                <select value={x.category} onChange={(e) => setRow("expenses", i, { category: e.target.value })}>
                  {CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <input
                  data-f="desc"
                  placeholder="내용"
                  value={x.desc || ""}
                  onChange={(e) => setRow("expenses", i, { desc: e.target.value })}
                />
                <input
                  type="number"
                  step="any"
                  placeholder="금액"
                  value={x.amount ?? ""}
                  onChange={(e) => setRow("expenses", i, { amount: numOrBlank(e.target.value) })}
                />
                <select value={x.currency} onChange={(e) => setRow("expenses", i, { currency: e.target.value })}>
                  {curOpts.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <button className="x" title="삭제" onClick={() => delRow("expenses", i)}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button className="btn small" style={{ marginTop: 8 }} onClick={addExpense}>
            + 경비 추가
          </button>
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

        <fieldset>
          <legend>사진</legend>
          <div className="photos">
            {draft.photos.map((p, i) => (
              <div className="ph" key={p.id}>
                <img src={store.photoUrl(p.id)} alt="" />
                <button title="빼기" onClick={() => removePhoto(i)}>
                  ×
                </button>
                <button className="cov" onClick={() => set("cover", p.id)}>
                  {(draft.cover ? draft.cover === p.id : i === 0) ? "★ 대표" : "대표로"}
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label className="btn small" style={{ cursor: "pointer" }}>
              + 사진 올리기
              <input type="file" accept="image/*" multiple hidden onChange={onPhotos} />
            </label>
            <span className="note">첫 번째 사진(또는 ‘대표’로 고른 사진)이 카드 표지가 돼요.</span>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

/** 숙소 도시 입력칸 자동완성용 목록 */
export function CityDatalist() {
  return (
    <datalist id="cityList">
      {CITIES.map((c) => (
        <option key={c[0] + c[3]} value={c[0]} />
      ))}
    </datalist>
  );
}
