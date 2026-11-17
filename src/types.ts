export interface City {
  name: string;
  lat: number | null;
  lng: number | null;
  /** ISO 3166-1 숫자 나라 코드 (예: "392" 일본) */
  cid: string;
}

export interface Hotel {
  name: string;
  city: string;
  checkIn: string;
  checkOut: string;
  price: number | "";
  currency: string;
  rating: number;
  memo: string;
}

export interface Expense {
  date: string;
  category: string;
  desc: string;
  amount: number | "";
  currency: string;
}

export interface PhotoRef {
  id: string;
}

export interface Trip {
  id: string;
  title: string;
  start: string;
  end: string;
  with: string;
  rating: number;
  tags: string[];
  memo: string;
  cities: City[];
  hotels: Hotel[];
  expenses: Expense[];
  photos: PhotoRef[];
  cover?: string;
  currency: string;
  /** 1 현지통화 = ? 원 */
  rate: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Wish extends City {
  id: string;
  memo: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Records {
  trips: Trip;
  wishes: Wish;
}
export type Kind = keyof Records;
/** 저장 전 레코드 (id가 없으면 새로 만듦) */
export type Draft<K extends Kind> = Omit<Records[K], "id"> & { id?: string };
export type TripDraft = Draft<"trips">;

export interface BackupFile {
  app: "travel-map";
  version: 1;
  exportedAt: string;
  trips: Trip[];
  wishes: Wish[];
  photos: { id: string; dataUrl: string }[];
}
