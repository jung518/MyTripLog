import { geoContains } from "d3";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { KO } from "./data";

export type CountryFeature = Feature<Geometry, { name: string }> & { id: string };

let features: CountryFeature[] = [];
const nameEn: Record<string, string> = {};

/** 세계 지도(Natural Earth 1:50m)를 불러오고 영문 나라 이름표를 채웁니다. */
export async function loadCountries(): Promise<CountryFeature[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/countries.json`);
  const topo = (await res.json()) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const fc = feature(topo, topo.objects.countries);
  features = fc.features
    .map((f) => ({ ...f, id: String(f.id ?? "") }) as CountryFeature)
    .filter((f) => f.id !== "010"); // 남극 제외
  features.forEach((f) => {
    if (f.id) nameEn[f.id] = f.properties.name;
  });
  return features;
}

/** 나라 코드 → 한글 이름 (없으면 영문, 그것도 없으면 "기타") */
export const cname = (id?: string) => (id && (KO[id] || nameEn[id])) || "기타";

export function countryFor(lat: number, lng: number): string {
  const f = features.find((f) => geoContains(f, [lng, lat]));
  return f ? f.id : "";
}
