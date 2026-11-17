/* 입력칸 최대 글자 수. 숫자를 바꾸려면 여기만 고치면 됩니다. */
export const LIMITS = {
  /** 여행 제목 */
  tripTitle: 20,
  /** 동행 */
  tripWith: 20,
  /** 메모 / 여행 일기 */
  tripMemo: 500,
  /** 방문한 도시 이름 */
  cityName: 30,
  /** 호텔 이름 */
  hotelName: 20,
  /** 숙소 메모 */
  hotelMemo: 50,
  /** 경비 상세 내용 */
  expenseDesc: 20,
  /** 가고 싶은 곳 메모 */
  wishMemo: 500,
  /** 검색칸 (여행 목록, 도시 검색) */
  search: 30,
} as const;
