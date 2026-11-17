/* =========================================================
 * 나의 여행 지도 - 화면/지도/편집 로직
 * 의존: d3, topojson-client (CDN), js/data.js, js/store.js
 * ========================================================= */
/* ---------------- Helpers ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const won = n => (Math.round(n||0)).toLocaleString("ko-KR") + "원";
const wonShort = n => { n = Math.round(n||0); if (n >= 1e8) return (n/1e8).toFixed(1).replace(/\.0$/,"")+"억원"; if (n >= 1e4) return Math.round(n/1e4).toLocaleString("ko-KR")+"만원"; return n.toLocaleString("ko-KR")+"원"; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const stars = n => n ? "★".repeat(n) + "☆".repeat(5-n) : "";
let countryNameEn = {};
const cname = id => KO[id] || countryNameEn[id] || "기타";
function daysBetween(a,b){ if(!a||!b) return 0; return Math.round((new Date(b)-new Date(a))/864e5); }
function tripDays(t){ const n = daysBetween(t.start,t.end); return t.start && t.end ? n+1 : 0; }
function tripLen(t){ if(!t.start) return ""; if(!t.end) return ""; const n = daysBetween(t.start,t.end); return n<=0 ? "당일" : `${n}박 ${n+1}일`; }
function fmtDate(d){ if(!d) return ""; const [y,m,dd]=d.split("-"); return `${y}.${m}.${dd}`; }
function tripYear(t){ return t.start ? t.start.slice(0,4) : ""; }
function toKRW(t, amount, cur){ amount = +amount||0; if(!cur || cur==="KRW") return amount; if(cur===t.currency) return amount*(+t.rate||RATE_HINT[cur]||0); return amount*(RATE_HINT[cur]||0); }
function tripCost(t){
  let total=0, byCat={};
  (t.hotels||[]).forEach(h=>{ const v=toKRW(t,h.price,h.currency); total+=v; byCat["숙박"]=(byCat["숙박"]||0)+v; });
  (t.expenses||[]).forEach(e=>{ const v=toKRW(t,e.amount,e.currency); total+=v; const c=e.category||"기타"; byCat[c]=(byCat[c]||0)+v; });
  return {total, byCat};
}
function tripCountries(t){ return [...new Set((t.cities||[]).map(c=>c.cid).filter(Boolean))]; }
function coverUrl(t){ const p=(t.photos||[]); if(!p.length) return ""; const c=p.find(x=>x.id===t.cover)||p[0]; return Store.photoUrl(c.id); }
function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove("show"),2200); }

/* ---------------- Banner ---------------- */
function showBanner(html){ const b=$("#banner"); b.innerHTML=html; b.classList.add("show"); }
function hideBanner(){ $("#banner").classList.remove("show"); }

/* ---------------- Map ---------------- */
let features=[], projection, path, svg, gRoot, gCountries, gPins, zoom, curK=1;
let pickCb=null;
async function initMap(){
  const topo = await (await fetch("data/countries.json")).json();
  features = topojson.feature(topo, topo.objects.countries).features.filter(f=>f.id!=="010");
  features.forEach(f=>{ if(f.id) countryNameEn[f.id]=f.properties.name; });
  svg = d3.select("#map");
  projection = d3.geoMercator();
  path = d3.geoPath(projection);
  gRoot = svg.append("g");
  gCountries = gRoot.append("g");
  gPins = gRoot.append("g");
  resizeMap();
  gCountries.selectAll("path").data(features).join("path")
    .attr("class","country").attr("d",path)
    .on("click",(ev,f)=>{ if(pickCb) return; onCountryClick(ev,f); });
  zoom = d3.zoom().scaleExtent([1,60]).on("zoom",ev=>{
    gRoot.attr("transform",ev.transform); curK=ev.transform.k; scalePins(); hidePopup();
  });
  svg.call(zoom).on("dblclick.zoom",null);
  svg.on("click",ev=>{
    if(!pickCb){ if(ev.target.tagName==="svg") hidePopup(); return; }
    const t=d3.zoomTransform(svg.node()); const [x,y]=t.invert(d3.pointer(ev,svg.node()));
    const [lng,lat]=projection.invert([x,y]); const cb=pickCb; endPick(); cb(+lat.toFixed(4),+lng.toFixed(4));
  });
  window.addEventListener("resize",()=>{ if($("#mapView").classList.contains("on")){ resizeMap(); gCountries.selectAll("path").attr("d",path); renderPins(); } });
  renderMap();
  zoomTo("mine", false);
}
function resizeMap(){
  const el=$("#map"); const w=el.clientWidth||800, h=el.clientHeight||500;


  projection.fitExtent([[10,10],[w-10,h-10]], {type:"FeatureCollection",features});
}
function countryFor(lat,lng){ const f=features.find(f=>d3.geoContains(f,[lng,lat])); return f?f.id:""; }
function zoomTo(kind, anim=true){
  const el=$("#map"); const w=el.clientWidth, h=el.clientHeight;
  let pts=[];
  if(kind==="mine"){ filteredTrips().forEach(t=>(t.cities||[]).forEach(c=>pts.push([c.lng,c.lat]))); if(!pts.length) kind="asia"; }
  if(kind==="world"){ svg.transition().duration(anim?700:0).call(zoom.transform,d3.zoomIdentity); return; }
  if(kind==="asia") pts=[[95,-9],[146,45]];
  const xy=pts.map(p=>projection(p));
  let [x0,x1]=d3.extent(xy,d=>d[0]), [y0,y1]=d3.extent(xy,d=>d[1]);
  const pad=60; let bw=Math.max(x1-x0,40), bh=Math.max(y1-y0,40);
  const k=Math.min(40, 0.85/Math.max(bw/w,bh/h));
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  const t=d3.zoomIdentity.translate(w/2,h/2).scale(k).translate(-cx,-cy);
  svg.transition().duration(anim?750:0).call(zoom.transform,t);
}
function zoomToPoints(pts){
  const el=$("#map"); const w=el.clientWidth, h=el.clientHeight;
  const xy=pts.map(p=>projection(p));
  let [x0,x1]=d3.extent(xy,d=>d[0]), [y0,y1]=d3.extent(xy,d=>d[1]);
  let bw=Math.max(x1-x0,15), bh=Math.max(y1-y0,15);
  const k=Math.min(40,0.6/Math.max(bw/w,bh/h));
  const t=d3.zoomIdentity.translate(w/2,h/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2);
  svg.transition().duration(750).call(zoom.transform,t);
}
function filteredTrips(){ const y=$("#yearFilter").value; return Store.trips.filter(t=>!y||tripYear(t)===y); }
function renderMap(){
  if(!gCountries) return;
  const trips=filteredTrips(); const cnt={};
  trips.forEach(t=>tripCountries(t).forEach(c=>cnt[c]=(cnt[c]||0)+1));
  gCountries.selectAll("path").attr("class",f=>{ const n=cnt[f.id]||0; return "country"+(n>=3?" v3":n==2?" v2":n==1?" v1":""); });
  gCountries.selectAll("path").selectAll("title").remove();
  gCountries.selectAll("path").append("title").text(f=>cname(f.id)+(cnt[f.id]?` · ${cnt[f.id]}번 방문`:""));
  renderPins();
}
function renderPins(){
  const trips=filteredTrips(); const byCity={};
  trips.forEach(t=>(t.cities||[]).forEach(c=>{
    if(c.lat==null||c.lng==null) return;
    const key=c.name+"|"+c.lat.toFixed(2)+"|"+c.lng.toFixed(2);
    (byCity[key] ||= {name:c.name,lat:c.lat,lng:c.lng,trips:[]}).trips.push(t);
  }));
  const cities=Object.values(byCity);
  const wishes=Store.wishes.filter(w=>w.lat!=null);
  gPins.selectAll("*").remove();
  const wg=gPins.selectAll("g.w").data(wishes).join("g").attr("class","w")
    .attr("transform",d=>`translate(${projection([d.lng,d.lat])})`);
  wg.append("circle").attr("class","wishpin").on("click",(ev,d)=>{ev.stopPropagation(); showWishPopup(ev,d);});
  const cg=gPins.selectAll("g.c").data(cities).join("g").attr("class","c")
    .attr("transform",d=>`translate(${projection([d.lng,d.lat])})`);
  cg.append("circle").attr("class","pin").on("click",(ev,d)=>{ev.stopPropagation(); showCityPopup(ev,d);});
  cg.append("text").attr("class","pin-label").text(d=>d.name);
  scalePins();
}
function scalePins(){
  const k=curK;
  gPins.selectAll("g.c circle").attr("r",d=>(4+Math.min(d.trips.length,4)*1.2)/k).attr("stroke-width",1.6/k);
  gPins.selectAll("g.w circle").attr("r",5/k).attr("stroke-width",2.4/k);
  gPins.selectAll("text").style("font-size",(11/k)+"px").attr("x",9/k).attr("y",4/k).style("stroke-width",3/k).style("display",k>=3?null:"none");
}
function placePopup(ev, html){
  const p=$("#popup"); p.innerHTML=html; p.style.display="block";
  const wrap=$(".map-wrap").getBoundingClientRect();
  let x=ev.clientX-wrap.left+12, y=ev.clientY-wrap.top+12;
  const pw=p.offsetWidth, ph=p.offsetHeight;
  if(x+pw>wrap.width-8) x=wrap.width-pw-8; if(y+ph>wrap.height-8) y=wrap.height-ph-8;
  p.style.left=x+"px"; p.style.top=y+"px";
}
function hidePopup(){ $("#popup").style.display="none"; }
function showCityPopup(ev,d){
  const html=`<h3>${esc(d.name)}</h3><div class="note">${d.trips.length}번 방문</div>`+
    d.trips.sort((a,b)=>(b.start||"").localeCompare(a.start||"")).map(t=>`<a class="tlink" data-trip="${esc(t.id)}"><b>${esc(t.title||"제목 없음")}</b><br><span class="note">${fmtDate(t.start)} · ${tripLen(t)}</span></a>`).join("");
  placePopup(ev,html);
}
function showWishPopup(ev,w){
  placePopup(ev,`<h3>☆ ${esc(w.name)}</h3><div class="note">${esc(cname(w.cid))}</div>${w.memo?`<p style="margin:6px 0">${esc(w.memo)}</p>`:""}<div style="display:flex;gap:6px;margin-top:6px"><button class="btn small" data-wish-done="${esc(w.id)}">다녀왔어요 → 여행 추가</button><button class="btn small danger" data-wish-del="${esc(w.id)}">삭제</button></div>`);
}
function onCountryClick(ev,f){
  const ts=filteredTrips().filter(t=>tripCountries(t).includes(f.id));
  if(!ts.length){ placePopup(ev,`<h3>${esc(cname(f.id))}</h3><div class="note">아직 기록이 없어요</div><button class="btn small" style="margin-top:8px" data-new-in="${esc(f.id)}">이 나라 여행 추가</button>`); return; }
  placePopup(ev,`<h3>${esc(cname(f.id))}</h3><div class="note">${ts.length}번 방문 · ${wonShort(ts.reduce((s,t)=>s+tripCost(t).total,0))}</div>`+
    ts.map(t=>`<a class="tlink" data-trip="${esc(t.id)}"><b>${esc(t.title||"제목 없음")}</b><br><span class="note">${fmtDate(t.start)} · ${tripLen(t)}</span></a>`).join(""));
}
function startPick(text, cb){
  pickCb=cb; $("#pickText").textContent=text; $("#pickBanner").classList.add("show"); $("#map").classList.add("picking");
  hidePopup(); if(location.hash!=="#map") { location.hash="map"; }
}
function endPick(){ pickCb=null; $("#pickBanner").classList.remove("show"); $("#map").classList.remove("picking"); if(endPick.after){ const f=endPick.after; endPick.after=null; f(); } }
$("#pickCancel").onclick=()=>{ pickCb=null; $("#pickBanner").classList.remove("show"); $("#map").classList.remove("picking"); if(endPick.after){ const f=endPick.after; endPick.after=null; f(); } };

/* ---------------- Side panel ---------------- */
function renderSide(){
  const trips=filteredTrips();
  const countries=new Set(), cities=new Set(); let days=0, cost=0;
  trips.forEach(t=>{ tripCountries(t).forEach(c=>countries.add(c)); (t.cities||[]).forEach(c=>cities.add(c.name)); days+=tripDays(t); cost+=tripCost(t).total; });
  const abroad=[...countries].filter(c=>c!=="410").length;
  $("#kpis").innerHTML=`
    <div class="kpi"><b>${abroad}</b><span>다녀온 나라 (해외)</span></div>
    <div class="kpi"><b>${cities.size}</b><span>다녀온 도시</span></div>
    <div class="kpi"><b>${trips.length}</b><span>여행 횟수 · 총 ${days}일</span></div>
    <div class="kpi"><b>${wonShort(cost)}</b><span>총 여행 경비</span></div>`;
  const cnt={}; trips.forEach(t=>tripCountries(t).forEach(c=>cnt[c]=(cnt[c]||0)+1));
  const ids=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
  $("#countryChips").innerHTML= ids.length ? ids.map(id=>`<span class="chip" data-country="${id}">${esc(cname(id))} ${cnt[id]>1?"×"+cnt[id]:""}</span>`).join("") : `<div class="empty">여행을 추가하면 나라가 지도에 색칠돼요.</div>`;
  const recent=[...trips].sort((a,b)=>(b.start||"").localeCompare(a.start||"")).slice(0,5);
  $("#recentTrips").innerHTML = recent.length ? recent.map(miniTrip).join("") : `<div class="empty">아직 기록이 없어요. 오른쪽 위 <b>+ 여행 추가</b>로 첫 여행을 남겨 보세요.</div>`;
  const ws=Store.wishes;
  $("#wishList").innerHTML = ws.length ? ws.map(w=>`<div class="wish-item"><span>☆ <b>${esc(w.name)}</b> <span class="note">${esc(cname(w.cid))}</span></span><button class="btn small ghost" data-wish-go="${esc(w.id)}">보기</button></div>`).join("") : `<div class="empty">지도 위 <b>☆ 가고 싶은 곳</b>으로 다음 여행지를 찍어 두세요.</div>`;
}
function miniTrip(t){ return `<div class="mini-trip" data-trip="${esc(t.id)}"><div class="t">${esc(t.title||"제목 없음")}</div><div class="m">${tripCountries(t).map(cname).join(", ")} · ${fmtDate(t.start)} · ${tripLen(t)} · ${wonShort(tripCost(t).total)}</div></div>`; }

/* ---------------- Trips view ---------------- */
function renderTrips(){
  const q=$("#q").value.trim().toLowerCase(), y=$("#fYear").value, c=$("#fCountry").value, s=$("#fSort").value;
  let ts=Store.trips.filter(t=>{
    if(y && tripYear(t)!==y) return false;
    if(c && !tripCountries(t).includes(c)) return false;
    if(q){ const hay=[t.title,t.memo,t.with,(t.tags||[]).join(" "),(t.cities||[]).map(x=>x.name).join(" "),(t.hotels||[]).map(h=>h.name).join(" "),tripCountries(t).map(cname).join(" ")].join(" ").toLowerCase(); if(!hay.includes(q)) return false; }
    return true;
  });
  const cmp={new:(a,b)=>(b.start||"").localeCompare(a.start||""),old:(a,b)=>(a.start||"").localeCompare(b.start||""),cost:(a,b)=>tripCost(b).total-tripCost(a).total,rating:(a,b)=>(b.rating||0)-(a.rating||0)}[s];
  ts.sort(cmp);
  $("#tripGrid").innerHTML = ts.length ? ts.map(t=>{
    const cv=coverUrl(t);
    return `<div class="tcard" data-trip="${esc(t.id)}">
      <div class="cover" style="${cv?`background-image:url('${cv}')`:""}"><span class="days">${tripLen(t)||"날짜 미정"}</span><span class="ctry">${esc(tripCountries(t).map(cname).join(" · "))}</span></div>
      <div class="body"><h3>${esc(t.title||"제목 없음")}</h3>
      <div class="meta">${fmtDate(t.start)}${t.end?" – "+fmtDate(t.end):""}${t.with?" · "+esc(t.with):""}</div>
      <div class="meta">${esc((t.cities||[]).map(x=>x.name).join(" → "))}</div>
      <div class="foot"><span class="stars">${stars(t.rating||0)}</span><b>${won(tripCost(t).total)}</b></div></div></div>`;
  }).join("") : `<div class="empty">${Store.trips.length?"조건에 맞는 여행이 없어요.":"아직 기록이 없어요. <b>+ 여행 추가</b>로 시작해 보세요."}</div>`;
}
function fillFilters(){
  const years=[...new Set(Store.trips.map(tripYear).filter(Boolean))].sort().reverse();
  for(const sel of ["#yearFilter","#fYear"]){ const el=$(sel), v=el.value; el.innerHTML=`<option value="">전체 연도</option>`+years.map(y=>`<option ${y===v?"selected":""}>${y}</option>`).join(""); }
  const cs=[...new Set(Store.trips.flatMap(tripCountries))].sort((a,b)=>cname(a).localeCompare(cname(b),"ko"));
  const el=$("#fCountry"), v=el.value; el.innerHTML=`<option value="">전체 나라</option>`+cs.map(c=>`<option value="${c}" ${c===v?"selected":""}>${esc(cname(c))}</option>`).join("");
}

/* ---------------- Stats ---------------- */
function bars(el, rows, fmt=wonShort, colorOf){
  const max=Math.max(1,...rows.map(r=>r[1]));
  el.innerHTML = rows.length ? rows.map(([k,v,extra])=>`<div class="bar-row"><span>${esc(k)}</span><div class="track"><div class="fill" style="width:${(v/max*100).toFixed(1)}%;${colorOf?`background:${colorOf(k)}`:""}"></div></div><span class="val">${fmt(v)}${extra?` <span class="note">${extra}</span>`:""}</span></div>`).join("") : `<div class="empty">데이터가 없어요</div>`;
}
function renderStats(){
  const ts=Store.trips;
  let total=0, days=0; const byYear={}, byCat={}, byC={}; const countries=new Set(); const cities=new Set();
  ts.forEach(t=>{ const c=tripCost(t); total+=c.total; days+=tripDays(t); const y=tripYear(t)||"미정"; byYear[y]=(byYear[y]||0)+c.total;
    Object.entries(c.byCat).forEach(([k,v])=>byCat[k]=(byCat[k]||0)+v);
    tripCountries(t).forEach(x=>{ countries.add(x); byC[x]=(byC[x]||0)+1; }); (t.cities||[]).forEach(x=>cities.add(x.name)); });
  const hotels=ts.flatMap(t=>(t.hotels||[]).map(h=>({...h,trip:t,nights:Math.max(1,daysBetween(h.checkIn,h.checkOut)),krw:toKRW(t,h.price,h.currency)})));
  const nights=hotels.reduce((s,h)=>s+(h.checkIn&&h.checkOut?h.nights:0),0);
  const abroad=[...countries].filter(c=>c!=="410").length;
  $("#statKpis").innerHTML=[
    [abroad,"다녀온 나라 (해외)"],[cities.size,"다녀온 도시"],[ts.length,"여행 횟수"],[days+"일","여행한 날"],
    [wonShort(total),"총 경비"],[days?wonShort(total/days):"-","하루 평균"],[ts.length?wonShort(total/ts.length):"-","여행당 평균"],[nights+"박","호텔 숙박"]
  ].map(([b,s])=>`<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join("");
  bars($("#byYear"), Object.entries(byYear).sort((a,b)=>a[0].localeCompare(b[0])));
  bars($("#byCat"), Object.entries(byCat).sort((a,b)=>b[1]-a[1]), wonShort, k=>CAT_COLORS[k]||"#9c968a");
  bars($("#byCountry"), Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[cname(k),v]), v=>v+"번", ()=>"var(--pin)");
  bars($("#perDay"), ts.filter(t=>tripDays(t)).map(t=>[t.title||"제목 없음", tripCost(t).total/tripDays(t)]).sort((a,b)=>b[1]-a[1]).slice(0,10));
  const hs=[...hotels].sort((a,b)=>(b.rating||0)-(a.rating||0)||(b.trip.start||"").localeCompare(a.trip.start||""));
  $("#hotelStats").innerHTML = hs.length ? `<table><tr><th>호텔</th><th>도시</th><th class="num">박</th><th class="num">1박 평균</th><th>별점</th></tr>`+
    hs.slice(0,15).map(h=>`<tr><td>${esc(h.name)}</td><td>${esc(h.city||"")}</td><td class="num">${h.checkIn&&h.checkOut?h.nights:"-"}</td><td class="num">${h.krw?wonShort(h.krw/h.nights):"-"}</td><td class="stars">${stars(+h.rating||0)}</td></tr>`).join("")+`</table>` : `<div class="empty">숙소 기록이 없어요</div>`;
  const tl=[...ts].sort((a,b)=>(b.start||"").localeCompare(a.start||""));
  $("#timeline").innerHTML = tl.length ? tl.map(t=>`<div class="tl-item" data-trip="${esc(t.id)}"><div class="y">${fmtDate(t.start)} · ${tripLen(t)}</div><b>${esc(t.title||"제목 없음")}</b> <span class="note">${esc(tripCountries(t).map(cname).join(", "))}</span></div>`).join("") : `<div class="empty">아직 기록이 없어요</div>`;
}

/* ---------------- Detail ---------------- */
let currentTrip=null;
function openDetail(id){
  const t=Store.trips.find(x=>x.id===id); if(!t) return; currentTrip=t; hidePopup();
  const c=tripCost(t); const cv=coverUrl(t);
  const hotelRows=(t.hotels||[]).map(h=>`<tr><td><b>${esc(h.name)}</b>${h.memo?`<br><span class="note">${esc(h.memo)}</span>`:""}</td><td>${esc(h.city||"")}</td><td>${fmtDate(h.checkIn)} – ${fmtDate(h.checkOut)}</td><td class="num">${h.price?(+h.price).toLocaleString("ko-KR")+" "+esc(h.currency||""):""}</td><td class="num">${won(toKRW(t,h.price,h.currency))}</td><td class="stars">${stars(+h.rating||0)}</td></tr>`).join("");
  const exps=[...(t.expenses||[])].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const expRows=exps.map(e=>`<tr><td>${fmtDate(e.date)}</td><td><span class="tag" style="background:${CAT_COLORS[e.category]||"#ddd"}22">${esc(e.category||"기타")}</span></td><td>${esc(e.desc||"")}</td><td class="num">${(+e.amount||0).toLocaleString("ko-KR")} ${esc(e.currency||"")}</td><td class="num">${won(toKRW(t,e.amount,e.currency))}</td></tr>`).join("");
  const catBars=Object.entries(c.byCat).sort((a,b)=>b[1]-a[1]);
  const days=tripDays(t);
  $("#detailBody").innerHTML=`
    <div class="d-hero" style="${cv?`background-image:linear-gradient(transparent 40%,rgba(0,0,0,.55)),url('${cv}')`:""}">
      <div class="note" style="color:#fffd">${esc(tripCountries(t).map(cname).join(" · "))}</div>
      <h2>${esc(t.title||"제목 없음")}</h2>
      <div>${fmtDate(t.start)}${t.end?" – "+fmtDate(t.end):""} · ${tripLen(t)}${t.with?" · "+esc(t.with):""} <span class="stars">${stars(t.rating||0)}</span></div>
    </div>
    <div class="stat-grid">
      <div class="kpi"><b>${won(c.total)}</b><span>총 경비</span></div>
      <div class="kpi"><b>${days?wonShort(c.total/days):"-"}</b><span>하루 평균</span></div>
      <div class="kpi"><b>${(t.cities||[]).length}</b><span>도시</span></div>
      <div class="kpi"><b>${(t.hotels||[]).length}</b><span>숙소</span></div>
    </div>
    ${(t.cities||[]).length?`<div class="panel"><h2>경로</h2>${esc(t.cities.map(x=>x.name).join(" → "))}</div>`:""}
    ${t.memo||(t.tags||[]).length?`<div class="panel"><h2>메모</h2>${(t.tags||[]).map(x=>`<span class="tag">#${esc(x)}</span>`).join("")}<p style="white-space:pre-wrap;margin:6px 0 0">${esc(t.memo||"")}</p></div>`:""}
    ${hotelRows?`<div class="panel"><h2>숙소</h2><div style="overflow:auto"><table><tr><th>호텔</th><th>도시</th><th>기간</th><th class="num">금액</th><th class="num">원화</th><th>별점</th></tr>${hotelRows}</table></div></div>`:""}
    ${catBars.length?`<div class="panel"><h2>경비 구성</h2><div id="dCat"></div>${t.currency&&t.currency!=="KRW"?`<div class="note">환율: 1 ${esc(t.currency)} = ${esc(t.rate)}원</div>`:""}</div>`:""}
    ${expRows?`<div class="panel"><h2>경비 내역</h2><div style="overflow:auto"><table><tr><th>날짜</th><th>항목</th><th>내용</th><th class="num">금액</th><th class="num">원화</th></tr>${expRows}</table></div></div>`:""}
    ${(t.photos||[]).length?`<div class="panel"><h2>사진</h2><div class="photos">${t.photos.map(p=>`<div class="ph"><img src="${Store.photoUrl(p.id)}" alt="" loading="lazy"></div>`).join("")}</div></div>`:""}`;
  if(catBars.length) bars($("#dCat"),catBars,won,k=>CAT_COLORS[k]||"#9c968a");
  const del=$("#delTrip"); del.classList.remove("armed"); del.textContent="삭제";
  $("#detailBg").classList.add("show");
}
$("#delTrip").onclick=async()=>{
  const b=$("#delTrip");
  if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent="한 번 더 누르면 삭제"; setTimeout(()=>{b.classList.remove("armed"); b.textContent="삭제";},3000); return; }
  try{ await Store.remove("trips",currentTrip.id); $("#detailBg").classList.remove("show"); toast("삭제했어요"); }catch(e){}
};
$("#editTrip").onclick=()=>{ $("#detailBg").classList.remove("show"); openEditor(currentTrip); };
$("#showOnMap").onclick=()=>{
  const t=currentTrip; $("#detailBg").classList.remove("show"); $("#yearFilter").value=""; location.hash="map";
  setTimeout(()=>{ renderMap(); const pts=(t.cities||[]).map(c=>[c.lng,c.lat]); if(pts.length) zoomToPoints(pts); },60);
};

/* ---------------- Editor ---------------- */
let draft=null;
function blankTrip(){ return {title:"",start:"",end:"",with:"",rating:0,tags:[],memo:"",cities:[],hotels:[],expenses:[],photos:[],currency:"KRW",rate:1}; }
function openEditor(t, presetCountry){
  draft = t ? JSON.parse(JSON.stringify(t)) : blankTrip();
  $("#editTitle").textContent = t ? "여행 수정" : "여행 추가";
  $("#e_title").value=draft.title||""; $("#e_start").value=draft.start||""; $("#e_end").value=draft.end||"";
  $("#e_with").value=draft.with||""; $("#e_rating").value=draft.rating||0; $("#e_tags").value=(draft.tags||[]).join(", "); $("#e_memo").value=draft.memo||"";
  $("#e_cur").innerHTML=CURRENCIES.map(c=>`<option ${c===draft.currency?"selected":""}>${c}</option>`).join("");
  $("#e_rate").value=draft.rate ?? 1;
  if(presetCountry && CUR_BY_COUNTRY[presetCountry]) setCurrency(CUR_BY_COUNTRY[presetCountry]);
  renderCityRows(); renderHotelRows(); renderExpRows(); renderPhotos();
  $("#editBg").classList.add("show");
}
function readBasics(){
  draft.title=$("#e_title").value.trim(); draft.start=$("#e_start").value; draft.end=$("#e_end").value;
  draft.with=$("#e_with").value.trim(); draft.rating=+$("#e_rating").value; draft.tags=$("#e_tags").value.split(",").map(s=>s.trim()).filter(Boolean);
  draft.memo=$("#e_memo").value; draft.currency=$("#e_cur").value; draft.rate=+$("#e_rate").value||0;
}
function setCurrency(c){ draft.currency=c; $("#e_cur").value=c; draft.rate=RATE_HINT[c]||1; $("#e_rate").value=draft.rate; }
$("#e_cur").onchange=()=>{ const prev=draft.currency; setCurrency($("#e_cur").value);
  // 기존 현지통화 항목도 새 통화로 맞춤
  [...draft.hotels,...draft.expenses].forEach(x=>{ if(x.currency===prev && prev!=="KRW") x.currency=draft.currency; });
  renderHotelRows(); renderExpRows(); };
$("#e_rate").oninput=()=>{ draft.rate=+$("#e_rate").value||0; renderExpSum(); };
function curOptions(sel){ const opts=[...new Set(["KRW",draft.currency,...CURRENCIES])]; return opts.map(c=>`<option ${c===sel?"selected":""}>${c}</option>`).join(""); }
function bindRows(container, arr, rerender){
  container.querySelectorAll("[data-f]").forEach(inp=>{
    inp.oninput=inp.onchange=()=>{ const i=+inp.closest(".row").dataset.i; arr[i][inp.dataset.f]=inp.type==="number"?(inp.value===""?"":+inp.value):inp.value; renderExpSum(); };
  });
  container.querySelectorAll(".x").forEach(b=>b.onclick=()=>{ arr.splice(+b.closest(".row").dataset.i,1); rerender(); renderExpSum(); });
}
function renderCityRows(){
  const el=$("#cityRows");
  el.innerHTML = draft.cities.map((c,i)=>`<div class="row city" data-i="${i}"><input data-f="name" value="${esc(c.name)}"><select data-f="cid">${countryOptions(c.cid)}</select><input type="number" step="any" data-f="lat" value="${c.lat??""}"><input type="number" step="any" data-f="lng" value="${c.lng??""}"><button class="x" title="삭제">×</button></div>`).join("") || `<div class="note">아직 도시가 없어요.</div>`;
  bindRows(el, draft.cities, renderCityRows);
}
function countryOptions(sel){
  const ids=[...new Set([...Object.keys(KO), ...(sel?[sel]:[])])].filter(id=>countryNameEn[id]||KO[id]).sort((a,b)=>cname(a).localeCompare(cname(b),"ko"));
  return `<option value="">-</option>`+ids.map(id=>`<option value="${id}" ${id===sel?"selected":""}>${esc(cname(id))}</option>`).join("");
}
function addCity(c){
  draft.cities.push(c); renderCityRows();
  if(draft.currency==="KRW" && c.cid && CUR_BY_COUNTRY[c.cid] && CUR_BY_COUNTRY[c.cid]!=="KRW"){ setCurrency(CUR_BY_COUNTRY[c.cid]); renderHotelRows(); renderExpRows(); }
}
function renderHotelRows(){
  const el=$("#hotelRows");
  el.innerHTML = draft.hotels.map((h,i)=>`<div class="row hotel" data-i="${i}">
    <input data-f="name" placeholder="호텔 이름" value="${esc(h.name)}">
    <input data-f="city" placeholder="도시" value="${esc(h.city||"")}" list="cityList">
    <input type="date" data-f="checkIn" value="${esc(h.checkIn||"")}">
    <input type="date" data-f="checkOut" value="${esc(h.checkOut||"")}">
    <input type="number" step="any" data-f="price" placeholder="금액" value="${h.price??""}">
    <select data-f="currency">${curOptions(h.currency)}</select>
    <select data-f="rating"><option value="0">-</option>${[5,4,3,2,1].map(n=>`<option value="${n}" ${+h.rating===n?"selected":""}>${n}★</option>`).join("")}</select>
    <button class="x" title="삭제">×</button>
    <input data-f="memo" placeholder="메모 (위치, 조식, 다시 묵을지…)" value="${esc(h.memo||"")}" style="grid-column:1/-1">
  </div>`).join("");
  bindRows(el, draft.hotels, renderHotelRows);
}
function renderExpRows(){
  const el=$("#expRows");
  el.innerHTML = draft.expenses.map((e,i)=>`<div class="row exp" data-i="${i}">
    <input type="date" data-f="date" value="${esc(e.date||"")}">
    <select data-f="category">${CATS.map(c=>`<option ${c===e.category?"selected":""}>${c}</option>`).join("")}</select>
    <input data-f="desc" placeholder="내용" value="${esc(e.desc||"")}">
    <input type="number" step="any" data-f="amount" placeholder="금액" value="${e.amount??""}">
    <select data-f="currency">${curOptions(e.currency)}</select>
    <button class="x" title="삭제">×</button></div>`).join("");
  bindRows(el, draft.expenses, renderExpRows); renderExpSum();
}
function renderExpSum(){
  if(!draft) return; const c=tripCost(draft);
  $("#expSum").innerHTML = c.total ? `<span>합계 <b>${won(c.total)}</b></span>`+Object.entries(c.byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span>${esc(k)} <b>${wonShort(v)}</b></span>`).join("") : "";
}
$("#addHotel").onclick=()=>{ const lastCity=draft.cities.length?draft.cities[draft.cities.length-1].name:""; draft.hotels.push({name:"",city:lastCity,checkIn:$("#e_start").value,checkOut:$("#e_end").value,price:"",currency:draft.currency,rating:0,memo:""}); renderHotelRows(); };
$("#addExp").onclick=()=>{ const last=draft.expenses[draft.expenses.length-1]; draft.expenses.push({date:last?.date||$("#e_start").value,category:last?"식비":"항공",desc:"",amount:"",currency:last?last.currency:"KRW"}); renderExpRows(); const ins=$$("#expRows input[data-f=desc]"); ins[ins.length-1]?.focus(); };

/* city search */
function setupSuggest(input, box, onPick){
  let hl=-1, items=[];
  const render=()=>{ const q=input.value.trim(); if(!q){ box.style.display="none"; return; }
    items=CITIES.filter(c=>c[0].includes(q)||cname(c[3]).includes(q)).slice(0,12);
    box.innerHTML = items.map((c,i)=>`<div data-i="${i}" class="${i===hl?"hl":""}">${esc(c[0])} <span class="note">${esc(cname(c[3]))}</span></div>`).join("") || `<div class="note" style="cursor:default">목록에 없어요 — ‘지도에서 찍기’로 추가하세요</div>`;
    box.style.display="block"; };
  input.addEventListener("input",()=>{ hl=-1; render(); });
  input.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"){ hl=Math.min(hl+1,items.length-1); render(); e.preventDefault(); }
    else if(e.key==="ArrowUp"){ hl=Math.max(hl-1,0); render(); e.preventDefault(); }
    else if(e.key==="Enter"){ const c=items[hl>=0?hl:0]; if(c){ pick(c); } e.preventDefault(); }
    else if(e.key==="Escape"){ box.style.display="none"; }
  });
  input.addEventListener("blur",()=>setTimeout(()=>box.style.display="none",150));
  box.addEventListener("mousedown",e=>{ const d=e.target.closest("[data-i]"); if(d) pick(items[+d.dataset.i]); });
  function pick(c){ onPick({name:c[0],lat:c[1],lng:c[2],cid:c[3]}); input.value=""; box.style.display="none"; }
}
setupSuggest($("#cityInput"), $("#citySuggest"), addCity);
$("#cityPickBtn").onclick=()=>{
  readBasics(); const name=$("#cityInput").value.trim()||"새 장소";
  $("#editBg").classList.remove("show");
  endPick.after=()=>$("#editBg").classList.add("show");
  startPick(`‘${name}’ 위치를 지도에서 클릭하세요 (확대해서 찍으면 정확해요)`,(lat,lng)=>{ addCity({name,lat,lng,cid:countryFor(lat,lng)}); $("#cityInput").value=""; });
};

/* photos */
function renderPhotos(){
  $("#photoGrid").innerHTML=(draft.photos||[]).map((p,i)=>`<div class="ph"><img src="${Store.photoUrl(p.id)}" alt=""><button data-pdel="${i}" title="빼기">×</button><button class="cov" data-pcov="${esc(p.id)}">${(draft.cover?draft.cover===p.id:i===0)?"★ 대표":"대표로"}</button></div>`).join("");
}
$("#photoGrid").addEventListener("click",e=>{
  const d=e.target.closest("[data-pdel]"); if(d){ const p=draft.photos.splice(+d.dataset.pdel,1)[0]; if(draft.cover===p.id) draft.cover=""; renderPhotos(); return; }
  const c=e.target.closest("[data-pcov]"); if(c){ draft.cover=c.dataset.pcov; renderPhotos(); }
});
async function shrink(file){
  try{
    const bmp=await createImageBitmap(file); const max=1800; const s=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const cv=document.createElement("canvas"); cv.width=Math.round(bmp.width*s); cv.height=Math.round(bmp.height*s);
    cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);
    return await new Promise(r=>cv.toBlob(b=>r(b||file),"image/jpeg",0.85));
  }catch(e){ return file; }
}
$("#photoInput").onchange=async e=>{
  const files=[...e.target.files]; e.target.value=""; if(!files.length) return;
  $("#saveTrip").disabled=true; let n=0;
  for(const f of files){
    toast(`사진 올리는 중… (${++n}/${files.length})`);
    try{ const blob=await shrink(f); const id=await Store.addPhoto(blob); draft.photos.push({id}); renderPhotos(); }
    catch(err){ toast("사진을 올리지 못했어요"); }
  }
  $("#saveTrip").disabled=false; toast("사진을 추가했어요");
};

$("#saveTrip").onclick=async()=>{
  readBasics();
  if(!draft.title){ draft.title = draft.cities.length ? draft.cities.map(c=>c.name).slice(0,3).join("·")+" 여행" : ""; }
  if(!draft.title && !draft.cities.length){ toast("제목이나 도시를 하나 이상 입력해 주세요"); return; }
  if(draft.start && draft.end && draft.end<draft.start){ toast("귀국일이 출발일보다 빨라요"); return; }
  draft.cities=draft.cities.map(c=>({...c,lat:c.lat===""?null:+c.lat,lng:c.lng===""?null:+c.lng}));
  draft.hotels=draft.hotels.filter(h=>h.name||h.price);
  draft.expenses=draft.expenses.filter(e=>e.amount!==""&&e.amount!=null||e.desc);
  if(!draft.createdAt) draft.createdAt=new Date().toISOString();
  const btn=$("#saveTrip"); btn.disabled=true;
  try{ await Store.save("trips",draft); await Store.cleanupPhotos(); $("#editBg").classList.remove("show"); toast("저장했어요 ✈️"); draft=null; }
  catch(e){} finally{ btn.disabled=false; }
};

/* ---------------- Wish ---------------- */
let wishDraft=null;
function openWish(){ wishDraft=null; $("#wishChosen").textContent="선택된 곳 없음"; $("#wishMemo").value=""; $("#wishInput").value=""; $("#wishBg").classList.add("show"); }
function setWish(c){ wishDraft=c; $("#wishChosen").innerHTML=`선택: <b>${esc(c.name)}</b> (${esc(cname(c.cid))})`; }
setupSuggest($("#wishInput"), $("#wishSuggest"), setWish);
$("#wishPickBtn").onclick=()=>{
  const name=$("#wishInput").value.trim()||"가고 싶은 곳"; const memo=$("#wishMemo").value;
  $("#wishBg").classList.remove("show");
  endPick.after=()=>{ $("#wishBg").classList.add("show"); $("#wishMemo").value=memo; };
  startPick(`‘${name}’ 위치를 클릭하세요`,(lat,lng)=>setWish({name,lat,lng,cid:countryFor(lat,lng)}));
};
$("#saveWish").onclick=async()=>{
  if(!wishDraft){ toast("장소를 먼저 골라 주세요"); return; }
  try{ await Store.save("wishes",{...wishDraft,memo:$("#wishMemo").value.trim(),createdAt:new Date().toISOString()}); $("#wishBg").classList.remove("show"); toast("가고 싶은 곳에 추가했어요"); }catch(e){}
};
$("#addWishBtn").onclick=openWish;

/* ---------------- Backup ---------------- */
$("#backupBtn").onclick=()=>{ $("#backupText").classList.add("hidden"); $("#backupBg").classList.add("show"); };
$("#exportBtn").onclick=async()=>{
  const btn=$("#exportBtn"); btn.disabled=true;
  try{
    const json=await Store.exportJSON($("#withPhotos").checked);
    const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
    const a=document.createElement("a"); a.href=url; a.download=`travel-map-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
    toast("백업 파일을 저장했어요");
  }catch(e){ toast("백업 파일을 만들지 못했어요"); }
  finally{ btn.disabled=false; }
};
$("#copyBtn").onclick=async()=>{
  const ta=$("#backupText"); ta.value=await Store.exportJSON(false); ta.classList.remove("hidden");
  try{ await navigator.clipboard.writeText(ta.value); toast("복사했어요 (사진 제외)"); }
  catch(e){ ta.select(); toast("아래 내용을 전체 선택해 복사하세요"); }
};
$("#importInput").onchange=async e=>{
  const f=e.target.files[0]; e.target.value=""; if(!f) return;
  try{ const n=await Store.importJSON(await f.text()); toast(`${n}개 여행을 복원했어요`); $("#backupBg").classList.remove("show"); }
  catch(err){ console.error(err); toast("파일을 읽지 못했어요"); }
};

/* ---------------- 잠금 화면 (Supabase, 비밀번호만 입력) ---------------- */
function showAuth(){
  $("#authEmail").value=(window.TRAVEL_MAP_CONFIG||{}).ownerEmail||"";
  $("#authBg").classList.add("show"); $("#logoutBtn").classList.add("hidden"); hideBanner();
  if(!$("#authEmail").value) $("#authErr").textContent="js/config.js에 ownerEmail(내 계정 이메일)을 넣어 주세요.";
  setTimeout(()=>$("#authPw").focus(),50);
}
function hideAuth(){ $("#authBg").classList.remove("show"); }
function updateUserUI(){
  const on = Store.mode==="cloud" && Store.user;
  $("#logoutBtn").classList.toggle("hidden",!on);
}
$("#authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("#authBtn"); btn.disabled=true; $("#authErr").textContent="";
  try{ await Store.signIn($("#authEmail").value.trim(), $("#authPw").value); hideAuth(); $("#authPw").value=""; updateUserUI(); }
  catch(err){ $("#authErr").textContent = /invalid/i.test(err.message||"") ? "비밀번호가 맞지 않아요." : "열지 못했어요: "+(err.message||err); }
  finally{ btn.disabled=false; }
});
$("#logoutBtn").onclick=async()=>{ await Store.signOut(); };

/* ---------------- Global events & routing ---------------- */
document.addEventListener("click",async e=>{
  const cl=e.target.closest("[data-close]"); if(cl){ $("#"+cl.dataset.close).classList.remove("show"); return; }
  const tr=e.target.closest("[data-trip]"); if(tr){ openDetail(tr.dataset.trip); return; }
  const ni=e.target.closest("[data-new-in]"); if(ni){ hidePopup(); openEditor(null, ni.dataset.newIn); return; }
  const ch=e.target.closest("[data-country]"); if(ch){ $("#fCountry").value=ch.dataset.country; location.hash="trips"; renderTrips(); return; }
  const wg=e.target.closest("[data-wish-go]"); if(wg){ const w=Store.wishes.find(x=>x.id===wg.dataset.wishGo); if(w) zoomToPoints([[w.lng,w.lat]]); return; }
  const wd=e.target.closest("[data-wish-del]"); if(wd){ hidePopup(); try{ await Store.remove("wishes",wd.dataset.wishDel); toast("삭제했어요"); }catch(_){} return; }
  const wn=e.target.closest("[data-wish-done]"); if(wn){ hidePopup(); const w=Store.wishes.find(x=>x.id===wn.dataset.wishDone); if(w){ openEditor(null); addCity({name:w.name,lat:w.lat,lng:w.lng,cid:w.cid}); draft._fromWish=w.id; } return; }
  const img=e.target.closest(".photos img"); if(img && !e.target.closest("#editBg")){ $("#lightImg").src=img.src; $("#lightbox").classList.add("show"); return; }
  const zb=e.target.closest("[data-zoom]"); if(zb){ zoomTo(zb.dataset.zoom); return; }
});
$("#lightbox").onclick=()=>$("#lightbox").classList.remove("show");
$$(".modal-bg:not([data-locked])").forEach(bg=>bg.addEventListener("mousedown",e=>{ if(e.target===bg) bg.classList.remove("show"); }));
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ $$(".modal-bg.show:not([data-locked])").forEach(m=>m.classList.remove("show")); $("#lightbox").classList.remove("show"); hidePopup(); } });
$("#addTripBtn").onclick=()=>openEditor(null);
$("#yearFilter").onchange=()=>{ renderMap(); renderSide(); };
["#q","#fYear","#fCountry","#fSort"].forEach(s=>$(s).addEventListener("input",renderTrips));

// remove a wish after saving a trip created from it
const _origSave=Store.save.bind(Store);
Store.save=async function(kind,obj){ const fromWish=obj._fromWish; if(fromWish) delete obj._fromWish; const id=await _origSave(kind,obj); if(kind==="trips"&&fromWish){ try{ await Store.remove("wishes",fromWish); }catch(e){} } return id; };

function route(){
  const v=(location.hash||"#map").slice(1); const view=["map","trips","stats"].includes(v)?v:"map";
  $$(".view").forEach(s=>s.classList.toggle("on", s.id===view+"View"));
  $$("nav a").forEach(a=>a.classList.toggle("on", a.dataset.v===view));
  if(view==="map" && projection){ resizeMap(); gCountries.selectAll("path").attr("d",path); renderPins(); }
  if(view==="trips") renderTrips();
  if(view==="stats") renderStats();
}
window.addEventListener("hashchange",route);

function renderAll(){ fillFilters(); renderMap(); renderSide(); renderTrips(); renderStats(); }
Store.onChange(renderAll);

/* dataset for hotel city autocomplete */
const dl=document.createElement("datalist"); dl.id="cityList"; dl.innerHTML=CITIES.map(c=>`<option value="${esc(c[0])}">`).join(""); document.body.appendChild(dl);

(async()=>{
  route();
  try{ await initMap(); }catch(e){ showBanner("지도 데이터를 불러오지 못했어요."); }
  renderAll();
  let firstZoom=true;
  Store.onChange(()=>{ if(firstZoom && Store.trips.length){ firstZoom=false; zoomTo("mine",false); } });
  await Store.init();
  updateUserUI();
  if(Store.mode==="local") showBanner("로컬 모드: 이 브라우저에만 저장돼요. 여러 기기에서 쓰려면 <code>js/config.js</code>에 Supabase 정보를 넣으세요.");
})();
