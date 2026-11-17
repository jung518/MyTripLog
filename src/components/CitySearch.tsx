import { useState, type CSSProperties, type ReactNode } from "react";
import { CITIES, type CityRef } from "../lib/data";
import { cname } from "../lib/geo";
import type { City } from "../types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick: (c: City) => void;
  placeholder?: string;
  style?: CSSProperties;
  /** 입력칸 옆에 놓을 버튼 등 */
  children?: ReactNode;
}

/** 도시 이름 자동완성 입력칸 (data.ts의 CITIES 목록 검색) */
export function CitySearch({ value, onChange, onPick, placeholder, style, children }: Props) {
  const [hl, setHl] = useState(-1);
  const [open, setOpen] = useState(false);
  const q = value.trim();
  const items = q ? CITIES.filter((c) => c[0].includes(q) || cname(c[3]).includes(q)).slice(0, 12) : [];

  const pick = (c: CityRef) => {
    onPick({ name: c[0], lat: c[1], lng: c[2], cid: c[3] });
    onChange("");
    setOpen(false);
  };

  return (
    <div className="city-add" style={style}>
      <input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setHl(-1);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            setHl(Math.min(hl + 1, items.length - 1));
            e.preventDefault();
          } else if (e.key === "ArrowUp") {
            setHl(Math.max(hl - 1, 0));
            e.preventDefault();
          } else if (e.key === "Enter") {
            const c = items[hl >= 0 ? hl : 0];
            if (c) pick(c);
            e.preventDefault();
          } else if (e.key === "Escape") {
            setOpen(false);
            e.stopPropagation();
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {children}
      <div className="suggest" style={{ display: open && q ? "block" : "none" }}>
        {items.length ? (
          items.map((c, i) => (
            <div
              key={c[0] + c[3]}
              className={i === hl ? "hl" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
            >
              {c[0]} <span className="note">{cname(c[3])}</span>
            </div>
          ))
        ) : (
          <div className="note" style={{ cursor: "default" }}>
            목록에 없어요 — ‘지도에서 찍기’로 추가하세요
          </div>
        )}
      </div>
    </div>
  );
}
