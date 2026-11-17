import { wonShort } from "../lib/format";
import { EmptyState } from "./ui";

export type BarRow = [label: string, value: number];

interface Props {
  rows: BarRow[];
  fmt?: (v: number) => string;
  colorOf?: (label: string) => string;
}

/** 가로 막대 그래프 */
export function Bars({ rows, fmt = wonShort, colorOf }: Props) {
  if (!rows.length) return <EmptyState compact title="데이터가 없어요" />;
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <>
      {rows.map(([k, v], i) => (
        <div className="bar-row" key={k + i}>
          <span>{k}</span>
          <div className="track">
            <div
              className="fill"
              style={{ width: `${((v / max) * 100).toFixed(1)}%`, ...(colorOf ? { background: colorOf(k) } : null) }}
            />
          </div>
          <span className="val">{fmt(v)}</span>
        </div>
      ))}
    </>
  );
}
