import { useState, useEffect, useRef, useCallback } from "react";

const F = { ID:0,NAME:1,MAT:2,YEAR:3,PRES:4,LEN:5,DONG:6,PROJ:7,SCORE:8,GRADE:9,DE:10,TH:11,CO:12,OP:13,ST:14,COLOR:15,EXC:16,PT:17 };

function getColor(s) {
  if (!s) return "#64748B";
  if (s < 120) return "#DC2626";
  if (s < 135) return "#EAB308";
  return "#16A34A";
}

function getBadgeStyle(s) {
  if (!s) return { bg: "rgba(100,116,139,.15)", color: "#64748B", label: "미평가" };
  if (s < 120) return { bg: "rgba(220,38,38,.15)", color: "#EF4444", label: "보통이하" };
  if (s < 135) return { bg: "rgba(234,179,8,.15)", color: "#EAB308", label: "양호(B)" };
  return { bg: "rgba(22,163,74,.15)", color: "#16A34A", label: "우수(A)" };
}

function MapCanvas({ pipes, onSelect, selected }) {
  const canvasRef = useRef(null);
  const [view, setView] = useState({ cx: 128.703, cy: 36.575, scale: 5500 });
  const dragRef = useRef(null);
  const animRef = useRef(null);

  const ll2xy = useCallback((lon, lat, vw, vh, v) => [
    (lon - v.cx) * v.scale + vw / 2,
    -(lat - v.cy) * v.scale * 1.25 + vh / 2
  ], []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pipes.length) return;
    const ctx = canvas.getContext("2d");
    const vw = canvas.width, vh = canvas.height;
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = "#080C14";
    ctx.fillRect(0, 0, vw, vh);
    // 격자
    ctx.strokeStyle = "rgba(30,45,74,0.2)";
    ctx.lineWidth = 0.5;
    for (let lo = 128.4; lo < 128.9; lo += 0.03) {
      const x = ll2xy(lo, view.cy, vw, vh, view)[0];
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, vh); ctx.stroke();
    }
    for (let la = 36.2; la < 36.95; la += 0.03) {
      const y = ll2xy(view.cx, la, vw, vh, view)[1];
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(vw, y); ctx.stroke();
    }
    // 배관
    pipes.forEach(p => {
      const pts = p[F.PT];
      if (!pts || pts.length < 2) return;
      const xys = pts.map(c => ll2xy(c[0], c[1], vw, vh, view));
      const inView = xys.some(([x, y]) => x > -20 && x < vw + 20 && y > -20 && y < vh + 20);
      if (!inView) return;
      const s = p[F.SCORE], col = p[F.COLOR];
      const w = !s ? 1 : s < 120 ? 5 : s < 135 ? 3 : 2;
      const isSel = selected === p;
      ctx.strokeStyle = isSel ? "#fff" : col;
      ctx.lineWidth = isSel ? w + 3 : w;
      ctx.globalAlpha = isSel ? 1 : 0.82;
      ctx.beginPath();
      ctx.moveTo(xys[0][0], xys[0][1]);
      for (let i = 1; i < xys.length; i++) ctx.lineTo(xys[i][0], xys[i][1]);
      ctx.stroke();
      const mid = xys[Math.floor(xys.length / 2)];
      const r = !s ? 2 : s < 120 ? 7 : s >= 135 ? 3 : 4;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = isSel ? "#fff" : col;
      ctx.beginPath(); ctx.arc(mid[0], mid[1], r, 0, Math.PI * 2); ctx.fill();
      if (p[F.EXC]) {
        ctx.strokeStyle = "#F97316"; ctx.lineWidth = 2; ctx.globalAlpha = 0.75;
        ctx.beginPath(); ctx.arc(mid[0], mid[1], r + 5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }, [pipes, view, selected, ll2xy]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  const findPipe = (ex, ey) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const vw = canvas.width, vh = canvas.height;
    let best = null, bd = 16;
    pipes.forEach(p => {
      (p[F.PT] || []).forEach(c => {
        const [x, y] = ll2xy(c[0], c[1], vw, vh, view);
        const d = Math.hypot(x - ex, y - ey);
        if (d < bd) { bd = d; best = p; }
      });
    });
    return best;
  };

  const handleClick = e => {
    if (dragRef.current?.moved) return;
    const r = canvasRef.current.getBoundingClientRect();
    const p = findPipe(e.clientX - r.left, e.clientY - r.top);
    if (p) onSelect(p);
  };

  const handleMouseDown = e => {
    dragRef.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
  };
  const handleMouseMove = e => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x, dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    setView(v => ({ ...v, cx: dragRef.current.cx - dx / v.scale, cy: dragRef.current.cy + dy / (v.scale * 1.25) }));
  };
  const handleMouseUp = () => { dragRef.current = null; };
  const handleWheel = e => {
    e.preventDefault();
    setView(v => ({ ...v, scale: Math.max(1500, Math.min(400000, v.scale * (e.deltaY > 0 ? 0.85 : 1.18))) }));
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  );
}

function ScoreBar({ label, val, max, color }) {
  const pct = val != null ? Math.round(val / max * 100) : 0;
  const c = pct < 50 ? "#EF4444" : pct < 70 ? "#F97316" : "#22C55E";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid #1E2D4A" }}>
      <span style={{ fontSize: 10, color: "#6B7A99", width: 60, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "#1E2D4A", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: c, width: 22, textAlign: "right" }}>{val ?? "-"}</span>
    </div>
  );
}

function AccBlock({ pipe }) {
  const s = pipe[F.SCORE], a = 2025 - pipe[F.YEAR], e = pipe[F.EXC], pr = pipe[F.PRES];
  const blocks = [];
  if (e) blocks.push({
    t: "굴착이력 배관 - 외부충격 손상 위험",
    r: "굴착 진동/충격으로 배관 연결부 이완, 피복 손상, 미세 균열이 잠재합니다. 지반 침하 후 배관 처짐이 발생하면 연결부에 집중 응력이 걸려 점진적 누출로 이어집니다.",
    cases: [
      { y: "2025.06", l: "서울 서초구 교대역", d: "굴착기가 중압배관 직접 타격, 지하철 2,3호선 무정차 통과, 서초대로 전면 통제" },
      { y: "2024 5건", l: "전국", d: "굴착센터 무신고 공사 중 배관 파손 5건. 전건 민형사 책임 부과. 위반시 2년 이하 징역 또는 2천만원 벌금" }
    ]
  });
  if (pipe[F.MAT] === "PLP" && a >= 15) blocks.push({
    t: "PLP 강관 " + a + "년 경과 - 부식/균열 위험",
    r: "피복 노화 시 수분 침투로 강관 외면 부식이 진행됩니다. 20년 이상은 핀홀 누출, 30년 이상은 연결부 이완 및 자연균열 가능성이 높습니다.",
    cases: [
      { y: "2025", l: "전국", d: "PLP관 31년 이상 배관 3,321km(13.8%). 장기사용 시 자연균열 발생 우려 - 에너지신문" },
      { y: "2020~2024", l: "전국", d: "5년간 도시가스 시설미비 사고 연평균 15건. 노후 배관 피복 손상이 주요 원인" }
    ]
  });
  if (pr === "중압") blocks.push({
    t: "중압 배관 - 파열 시 광역 피해",
    r: "중압 배관 파열 시 저압 대비 분출량이 수십배에 달합니다. 인근 반경 수백미터 내 2차 화재 및 건물 붕괴로 이어질 수 있습니다.",
    cases: [
      { y: "1995.04.28", l: "대구 달서구 상인동", d: "무단 천공으로 중압관 파손. 사망 101명(영남중 학생 43명 포함), 부상 202명, 피해액 540억원. 국내 최대 도시가스 사고" },
      { y: "2024", l: "전국", d: "타공사 사고 6건 중 중압 이상 배관 피해 포함. 굴착시 가스안전공사 의무 입회 시행 중" }
    ]
  });
  if (s && s < 120) blocks.push({
    t: "K-CityGas-SPC 보통이하 - 복합 위험 중첩",
    r: "현재 배관은 " + s + "점으로 보통이하 등급입니다. 복수 위험인자가 동시에 낮은 평가를 받은 상태로 즉시 정밀안전진단 및 보완 조치 계획 수립이 필요합니다.",
    cases: [
      { y: "1995.04.28", l: "대구 상인동", d: "복합 위험(매설심도 미달+무단굴착+신고지연) 중첩으로 사망 101명, 부상 202명, 피해액 540억원" },
      { y: "2020~2024", l: "전국", d: "5년간 가스사고 원인: 시설미비 15건, 제품노후 14건, 타공사 6건. 복합위험 배관 사고 발생률 3배 이상" }
    ]
  });
  if (!blocks.length) blocks.push({
    t: "현재 등급 안정 - 정기 모니터링 유지",
    r: "안정적인 상태이지만 외부 환경 변화에 의해 갑작스러운 상태 변화가 발생할 수 있으므로 정기 점검을 지속해야 합니다.",
    cases: [
      { y: "2024", l: "전국", d: "2024년 도시가스 사고 17건. 양호 등급도 굴착공사 등 외부 요인으로 사고 발생 가능" },
      { y: "2020~2024", l: "전국", d: "5년간 도시가스 사고 79건. 정기점검(기밀시험 PE,PLP 15년후 5년마다) 필수" }
    ]
  });

  return (
    <div style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, padding: "11px 12px", marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", marginBottom: 10, paddingBottom: 7, borderBottom: "1px solid rgba(239,68,68,.2)" }}>AI 배관 위험 분석 및 실제 사고사례</div>
      {blocks.map((b, i) => (
        <div key={i} style={{ background: "rgba(0,0,0,.2)", borderRadius: 8, padding: "9px 10px", marginBottom: i < blocks.length - 1 ? 6 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#E8EDF5", marginBottom: 5 }}>{b.t}</div>
          <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.7, marginBottom: 7, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,.06)" }}>{b.r}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#F97316", marginBottom: 5 }}>실제 사고 사례</div>
          {b.cases.map((c, j) => (
            <div key={j} style={{ borderLeft: "2px solid #F97316", paddingLeft: 8, marginBottom: j < b.cases.length - 1 ? 5 : 0 }}>
              <div style={{ fontSize: 10, color: "#F97316", fontWeight: 600 }}>{c.y} - {c.l}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5, marginTop: 1 }}>{c.d}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FlemmiChat({ pipe }) {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(false);
  const msgsRef = useRef(null);

  useEffect(() => {
    setMsgs([{ role: "bot", text: "안녕하세요! 저는 도시가스 안전 전문가 플레미예요. 배관을 선택하거나 궁금한 것을 물어보세요!" }]);
  }, []);

  useEffect(() => {
    if (pipe) {
      const s = pipe[F.SCORE], a = 2025 - pipe[F.YEAR], e = pipe[F.EXC], pr = pipe[F.PRES];
      let msg = "";
      if (s && s < 120) msg = "긴급! " + pipe[F.NAME] + " 배관은 " + s + "점 보통이하예요. 즉시 점검 필요해요!";
      else if (e && pipe[F.MAT] === "PLP" && a >= 20) msg = pipe[F.NAME] + " 배관은 " + a + "년된 PLP 강관에 굴착이력까지 있어요!";
      else if (e) msg = pipe[F.NAME] + " 배관에 굴착이력이 있어요. 연결부 확인 필요해요!";
      else if (pipe[F.MAT] === "PLP" && a >= 30) msg = "무려 " + a + "년된 PLP 강관이에요! 법적 정밀안전진단 대상이에요.";
      else if (pipe[F.MAT] === "PLP" && a >= 20) msg = a + "년 경과 PLP 강관이에요. 방식전위 측정 확인 필요해요!";
      else if (pr === "중압") msg = "중압 배관이에요! 굴착공사 시 반드시 입회해야 해요.";
      else if (s && s >= 135) msg = pipe[F.NAME] + " 배관 " + s + "점 우수(A)! 현재 상태 매우 양호해요.";
      else msg = pipe[F.NAME] + " 배관 분석 완료! 궁금한 점은 물어보세요.";
      setMsgs(prev => [...prev, { role: "bot", text: msg }]);
    }
  }, [pipe]);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [msgs]);

  const getPipeCtx = () => {
    if (!pipe) return "";
    return "현재 선택 배관: 이름=" + pipe[F.NAME] + ", 재질=" + pipe[F.MAT] + ", 설치=" + pipe[F.YEAR] + "년(" + (2025 - pipe[F.YEAR]) + "년경과), 압력=" + pipe[F.PRES] + ", SPC점수=" + (pipe[F.SCORE] || "미평가") + ", 등급=" + (pipe[F.GRADE] || "-") + ", 굴착이력=" + (pipe[F.EXC] ? "있음" : "없음") + ", 설계환경=" + pipe[F.DE] + ", 제3자=" + pipe[F.TH] + ", 부식=" + pipe[F.CO] + ", 운전보수=" + pipe[F.OP] + ", 응력=" + pipe[F.ST];
  };

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setInp("");
    setMsgs(prev => [...prev, { role: "user", text }]);
    setLoading(true);
    const history = msgs.filter(m => m.role !== "loading").map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text }));
    history.push({ role: "user", content: text });
    try {
      const sys = "당신은 도시가스 배관 안전 전문가 '플레미'입니다. 대성청정에너지 안전기획팀 소속이며 K-CityGas-SPC 평가를 담당합니다. 친근하고 전문적인 말투로 200자 이내로 답변하세요." + (pipe ? "\n\n" + getPipeCtx() : "");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: sys, messages: history.slice(-8) })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "죄송해요, 다시 시도해주세요.";
      setMsgs(prev => [...prev, { role: "bot", text: reply }]);
    } catch {
      setMsgs(prev => [...prev, { role: "bot", text: "연결 오류가 발생했어요. 다시 시도해주세요!" }]);
    }
    setLoading(false);
  };

  const hints = ["사고사례 알려줘", "위험도 설명해줘", "점검 방법은?", "이 배관 위험해?"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={msgsRef} style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: m.role === "bot" ? "#1D4ED8" : "#1E2D4A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#E8EDF5", flexShrink: 0 }}>
              {m.role === "bot" ? "F" : "나"}
            </div>
            <div style={{ maxWidth: 200, padding: "7px 10px", borderRadius: m.role === "bot" ? "10px 10px 10px 2px" : "10px 10px 2px 10px", fontSize: 12, lineHeight: 1.6, background: m.role === "bot" ? "#1A2035" : "#1D4ED8", color: "#E8EDF5", border: m.role === "bot" ? "1px solid #1E2D4A" : "none", wordBreak: "break-word" }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#E8EDF5" }}>F</div>
            <div style={{ padding: "7px 10px", borderRadius: "10px 10px 10px 2px", fontSize: 12, color: "#6B7A99", fontStyle: "italic", background: "#1A2035", border: "1px solid #1E2D4A" }}>분석중...</div>
          </div>
        )}
      </div>
      <div style={{ padding: "0 10px 8px", display: "flex", gap: 5, flexWrap: "wrap" }}>
        {hints.map(h => (
          <button key={h} onClick={() => send(h)} style={{ fontSize: 10, background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.3)", borderRadius: 99, padding: "3px 8px", color: "#93C5FD", cursor: "pointer", fontFamily: "inherit" }}>{h}</button>
        ))}
      </div>
      <div style={{ padding: 8, borderTop: "1px solid #1E2D4A", display: "flex", gap: 6 }}>
        <textarea
          value={inp}
          onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(inp); } }}
          placeholder="플레미에게 물어보세요..."
          rows={1}
          style={{ flex: 1, background: "#1A2035", border: "1px solid #1E2D4A", borderRadius: 7, padding: "6px 9px", fontSize: 12, color: "#E8EDF5", outline: "none", fontFamily: "inherit", resize: "none" }}
        />
        <button onClick={() => send(inp)} style={{ width: 32, height: 32, background: "#1D4ED8", border: "none", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [pipes, setPipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("detail");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/pipes.json").then(r => r.json()).then(d => { setPipes(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = pipes.filter(p => {
    if (filter === "danger") return p[F.SCORE] && p[F.SCORE] < 120;
    if (filter === "good") return p[F.SCORE] && p[F.SCORE] >= 120 && p[F.SCORE] < 135;
    if (filter === "best") return p[F.SCORE] && p[F.SCORE] >= 135;
    if (filter === "exc") return p[F.EXC];
    if (filter === "plp") return p[F.MAT] === "PLP";
    return true;
  });

  const stats = {
    danger: pipes.filter(p => p[F.SCORE] && p[F.SCORE] < 120).length,
    good: pipes.filter(p => p[F.SCORE] && p[F.SCORE] >= 120 && p[F.SCORE] < 135).length,
    best: pipes.filter(p => p[F.SCORE] && p[F.SCORE] >= 135).length,
    exc: pipes.filter(p => p[F.EXC]).length,
    total: pipes.length
  };

  const handleSelect = (p) => {
    setSelected(p);
    setTab("detail");
  };

  if (loading) return (
    <div style={{ height: "100vh", background: "#0B0F1A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#E8EDF5", fontFamily: "-apple-system, sans-serif" }}>
      <div style={{ width: 48, height: 48, border: "3px solid #1E2D4A", borderTop: "3px solid #3B82F6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontSize: 15, fontWeight: 500 }}>지도 준비 중...</div>
      <div style={{ fontSize: 12, color: "#6B7A99" }}>배관 데이터를 불러오고 있어요</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0B0F1A", color: "#E8EDF5", fontFamily: "-apple-system, sans-serif", overflow: "hidden" }}>
      {/* 헤더 */}
      <div style={{ height: 52, background: "#131929", borderBottom: "1px solid #1E2D4A", display: "flex", alignItems: "center", padding: "0 14px", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, background: "#1D4ED8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>GIS</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>배관 위험도 GIS</div>
          <div style={{ fontSize: 10, color: "#6B7A99" }}>대성청정에너지(주) · K-CityGas-SPC · {stats.total.toLocaleString()}개 배관</div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {[{k:"danger",c:"#EF4444",l:"보통이하",v:stats.danger},{k:"best",c:"#22C55E",l:"우수",v:stats.best},{k:"exc",c:"#F97316",l:"굴착",v:stats.exc}].map(s => (
            <div key={s.k} style={{ fontSize: 10, background: s.c+"26", color: s.c, padding: "2px 7px", borderRadius: 5, fontWeight: 600 }}>{s.l} {s.v}</div>
          ))}
        </div>
      </div>

      {/* 메인 */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 지도 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          {/* 필터 */}
          <div style={{ position: "absolute", top: 10, left: 10, right: 10, zIndex: 10, display: "flex", gap: 5, overflowX: "auto" }}>
            {[{k:"all",l:"전체"},{k:"danger",l:"보통이하"},{k:"good",l:"양호(B)"},{k:"best",l:"우수(A)"},{k:"exc",l:"굴착이력"},{k:"plp",l:"PLP강관"}].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 500, border: "1px solid", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", background: filter === f.k ? "rgba(59,130,246,.2)" : "rgba(19,25,41,.94)", borderColor: filter === f.k ? "#3B82F6" : "#1E2D4A", color: filter === f.k ? "#3B82F6" : "#6B7A99" }}>{f.l}</button>
            ))}
          </div>
          <MapCanvas pipes={filtered} onSelect={handleSelect} selected={selected} />
          {/* 범례 */}
          <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(19,25,41,.95)", border: "1px solid #1E2D4A", borderRadius: 8, padding: "7px 10px", fontSize: 10 }}>
            {[{c:"#DC2626",l:"보통이하 120점 미만"},{c:"#EAB308",l:"양호(B) 120~134점"},{c:"#16A34A",l:"우수(A) 135점 이상"},{c:"#64748B",l:"미평가"}].map(item => (
              <div key={item.l} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3, color: "#E8EDF5" }}>
                <div style={{ width: 14, height: 3, background: item.c, borderRadius: 2 }} />
                {item.l}
              </div>
            ))}
          </div>
        </div>

        {/* 사이드 패널 */}
        <div style={{ width: 320, background: "#131929", borderLeft: "1px solid #1E2D4A", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* 탭 */}
          <div style={{ display: "flex", borderBottom: "1px solid #1E2D4A", flexShrink: 0 }}>
            {[{k:"detail",l:"상세 분석"},{k:"chat",l:"플레미 채팅"}].map(t => (
              <div key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, padding: "10px 4px", fontSize: 12, fontWeight: 500, textAlign: "center", cursor: "pointer", color: tab === t.k ? "#3B82F6" : "#6B7A99", borderBottom: "2px solid " + (tab === t.k ? "#3B82F6" : "transparent") }}>{t.l}</div>
            ))}
          </div>

          {/* 상세 탭 */}
          {tab === "detail" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {!selected ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#6B7A99", fontSize: 12, gap: 8, padding: 24, textAlign: "center", height: "100%" }}>
                  <svg width="40" height="50" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" style={{ animation: "bob 3s ease-in-out infinite", opacity: 0.7 }}>
                    <defs><radialGradient id="fg1" cx="50%" cy="60%" r="50%"><stop offset="0%" stopColor="#FDE68A"/><stop offset="50%" stopColor="#F97316"/><stop offset="100%" stopColor="#DC2626"/></radialGradient></defs>
                    <path d="M50 110 C20 95 8 75 12 55 C16 38 28 30 32 20 C35 12 34 4 38 2 C40 8 38 16 44 22 C46 14 50 6 54 4 C55 12 52 20 56 26 C60 18 66 12 70 16 C68 26 64 34 68 44 C74 38 80 32 84 36 C82 50 76 62 80 74 C84 80 88 84 88 92 C82 100 70 108 50 110Z" fill="url(#fg1)"/>
                    <ellipse cx="40" cy="58" rx="6" ry="7" fill="#1E3A5F"/><ellipse cx="60" cy="58" rx="6" ry="7" fill="#1E3A5F"/>
                    <circle cx="41.5" cy="56" r="2" fill="white"/><circle cx="61.5" cy="56" r="2" fill="white"/>
                    <path d="M43 70 Q50 76 57 70" stroke="#1E3A5F" strokeWidth="2" fill="none" strokeLinecap="round"/>
                    <ellipse cx="50" cy="36" rx="20" ry="9" fill="#1D4ED8"/><rect x="30" y="36" width="40" height="6" rx="2" fill="#1E40AF"/>
                  </svg>
                  <div>지도에서 배관을 클릭하면<br/>분석 결과가 표시돼요!</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>플레미가 도움을 드려요</div>
                </div>
              ) : (
                <div style={{ padding: 12 }}>
                  {/* 헤더 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{selected[F.NAME]}</div>
                      <div style={{ fontSize: 10, color: "#6B7A99" }}>{selected[F.PROJ]} · {selected[F.MAT]} · {selected[F.DONG]}</div>
                    </div>
                    {(() => { const b = getBadgeStyle(selected[F.SCORE]); return <div style={{ fontSize: 10, fontWeight: 700, background: b.bg, color: b.color, padding: "3px 8px", borderRadius: 6 }}>{b.label}</div>; })()}
                  </div>
                  {/* 점수 */}
                  <div style={{ background: "#1A2035", borderRadius: 9, padding: 11, textAlign: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: getColor(selected[F.SCORE]), lineHeight: 1 }}>{selected[F.SCORE] || "미평가"}</div>
                    <div style={{ fontSize: 10, color: "#6B7A99", marginTop: 3 }}>{selected[F.SCORE] ? "K-CityGas-SPC 총점 - " + selected[F.GRADE] : "K-CityGas-SPC 평가 미수행"}</div>
                  </div>
                  {/* 항목별 바 */}
                  {selected[F.SCORE] && (
                    <div style={{ marginBottom: 10 }}>
                      {[["설계/환경", F.DE, 30], ["제3자", F.TH, 68], ["부식", F.CO, 42], ["운전/보수", F.OP, 30], ["응력결함", F.ST, 22]].map(([l, fi, mx]) => (
                        <ScoreBar key={l} label={l} val={selected[fi]} max={mx} />
                      ))}
                    </div>
                  )}
                  {/* 정보 그리드 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 10 }}>
                    {[["설치연도", selected[F.YEAR] + "년 (" + (2025 - selected[F.YEAR]) + "년)"], ["재질", selected[F.MAT]], ["압력", selected[F.PRES]], ["길이", selected[F.LEN] + "m"], ["행정동", selected[F.DONG] || "-"], ["굴착공사", selected[F.EXC] ? "이력 있음" : "없음"]].map(([l, v]) => (
                      <div key={l} style={{ background: "#1A2035", borderRadius: 7, padding: "6px 8px" }}>
                        <div style={{ fontSize: 10, color: "#6B7A99", marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: l === "굴착공사" ? (selected[F.EXC] ? "#F97316" : "#22C55E") : "#E8EDF5" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {/* 사고사례 */}
                  <AccBlock pipe={selected} />
                  {/* 버튼 */}
                  {(() => {
                    const s = selected[F.SCORE];
                    const [cls, txt] = !s ? ["abg", "미평가"] : s < 120 ? ["abr", "즉시 정밀점검 필요"] : s < 135 ? ["abo", "차기 점검 시 중점 확인"] : ["abg", "정기 모니터링 유지"];
                    const colors = { abr: "#EF4444", abo: "#F97316", abg: "#22C55E" };
                    const col = colors[cls];
                    return <button onClick={() => setTab("chat")} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid " + col + "40", background: col + "18", color: col, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{txt}</button>;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* 채팅 탭 */}
          {tab === "chat" && <FlemmiChat pipe={selected} />}
        </div>
      </div>
      <style>{`
        @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1E2D4A; border-radius: 2px; }
      `}</style>
    </div>
  );
}
