import { useEffect, useState } from 'react'
import * as sfx from './sound'

/* ------------------------------------------------------------------ */
/*  OYUN AYARLARI                                                      */
/* ------------------------------------------------------------------ */

const TICK_MS = 880
const BET_COUNTDOWN = 10
const START_BALANCE = 1000

const BET_TYPES = {
  kazanan: { key: 'kazanan', label: 'Kazanan', hint: '1. gelsin', payout: 6.5 },
  plase: { key: 'plase', label: 'Plase', hint: 'İlk 2', payout: 3.25 },
}

const MODES = {
  renk: { key: 'renk', label: 'Renkli Zar', desc: '3 renk · 1-2-3 adım · 24 adım', faces: [1, 1, 2, 2, 3, 3], track: 24 },
  sayi: { key: 'sayi', label: 'Sayılı Zar', desc: '1-6 arası · 42 adım', faces: [1, 2, 3, 4, 5, 6], track: 42 },
}

const STEP_COLORS = { 1: '#3D7BE8', 2: '#E8B64C', 3: '#E2484A' }
const STEP_NAMES = { 1: 'MAVİ', 2: 'SARI', 3: 'KIRMIZI' }

const SILKS = ['#E2484A', '#3D7BE8', '#E8B64C', '#9B5DE5', '#2EC27E', '#F2742C', '#29B8C9']

const ROSTER = [
  { name: 'ŞİMŞEK', fg: 88, fs: 84 }, { name: 'POYRAZ', fg: 82, fs: 86 },
  { name: 'FIRTINA', fg: 90, fs: 81 }, { name: 'KARAYEL', fg: 79, fs: 88 },
  { name: 'RÜZGÂR', fg: 85, fs: 83 }, { name: 'YILDIZ', fg: 91, fs: 87 },
  { name: 'LODOS', fg: 77, fs: 90 }, { name: 'ALEV', fg: 86, fs: 79 },
  { name: 'KASIRGA', fg: 83, fs: 85 }, { name: 'BORA', fg: 80, fs: 82 },
  { name: 'TUFAN', fg: 89, fs: 78 }, { name: 'ZEYBEK', fg: 84, fs: 88 },
  { name: 'YAĞIZ', fg: 78, fs: 86 }, { name: 'DORU', fg: 82, fs: 80 },
  { name: 'KÜHEYLAN', fg: 90, fs: 89 }, { name: 'AKINCI', fg: 81, fs: 84 },
  { name: 'CEYLAN', fg: 87, fs: 82 }, { name: 'ŞAHİN', fg: 85, fs: 87 },
  { name: 'DOĞAN', fg: 83, fs: 85 }, { name: 'KARTAL', fg: 88, fs: 80 },
  { name: 'ATMACA', fg: 79, fs: 89 }, { name: 'PARS', fg: 86, fs: 84 },
  { name: 'ATEŞ', fg: 84, fs: 81 }, { name: 'TOROS', fg: 80, fs: 87 },
]

const fmt = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
const rollFace = (faces) => faces[Math.floor(Math.random() * faces.length)]

function pickLineup() {
  const arr = [...ROSTER]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, 7).map((h, i) => ({ ...h, silk: SILKS[i] }))
}

const CHIPS = [10, 25, 50, 100, 250]

/* ------------------------------------------------------------------ */
/*  AT — yeniden çizilmiş yarış atı silüeti (sağa bakar)               */
/* ------------------------------------------------------------------ */

function Horse({ silk, number, running, won }) {
  return (
    <svg className={`horse ${running ? 'running' : ''} ${won ? 'won' : ''}`} viewBox="0 0 104 68" width="72" height="47" aria-hidden="true">
      <g className="horse-body-group">
        {/* kuyruk */}
        <path d="M22 31 C11 31 6 43 8 55 C12 47 16 39 25 38 Z" fill="#3a2614" />
        {/* uzak bacaklar (gövdenin arkasında, daha koyu) */}
        <rect className="leg leg-b1" x="27" y="39" width="4" height="23" rx="2" fill="#4a3119" />
        <rect className="leg leg-f1" x="64" y="39" width="4" height="23" rx="2" fill="#4a3119" />
        {/* gövde: sağrı + karın + omuz (düz sırt çizgisi) */}
        <ellipse cx="32" cy="33" rx="13" ry="12" fill="#6e4b2a" />
        <ellipse cx="52" cy="35" rx="22" ry="10.5" fill="#6e4b2a" />
        <ellipse cx="69" cy="34" rx="9.5" ry="11" fill="#6e4b2a" />
        {/* boyun: kısa, öne-yukarı doğal açı */}
        <path d="M65 25 L80 14 L84 20 L73 34 Z" fill="#6e4b2a" />
        {/* baş + burun */}
        <path d="M78 14 L88 11 L94 16 L92 21 L83 21 L79 18 Z" fill="#6e4b2a" />
        {/* kulak */}
        <path d="M84 12 L86 5 L89 12 Z" fill="#5e3f23" />
        {/* yele */}
        <path d="M65 24 L79 13 L81 16 L70 30 Z" fill="#3a2614" />
        {/* göz + burun deliği */}
        <circle cx="87" cy="15.5" r="1.2" fill="#160d05" />
        <circle cx="91.5" cy="18" r="0.9" fill="#160d05" />
        {/* yakın bacaklar (gövdenin önünde) */}
        <rect className="leg leg-b2" x="31" y="39" width="4" height="22" rx="2" fill="#5f4126" />
        <rect className="leg leg-f2" x="68" y="39" width="4" height="22" rx="2" fill="#5f4126" />
        {/* eyer örtüsü + numara */}
        <rect x="35" y="27" width="15" height="9.5" rx="2" fill={silk} />
        <text x="42.5" y="34.6" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{number}</text>
        {/* jokey: dik biniş pozisyonu */}
        <path d="M50 30 C49 22 52 18 55 19 C58 20 56 26 56 30 Z" fill={silk} />
        <circle cx="53.5" cy="15" r="3" fill={silk} />
        <circle cx="55.5" cy="17.5" r="2" fill="#E8C9A0" />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  ZAR                                                                */
/* ------------------------------------------------------------------ */

function Die({ mode, value, size = 'lg' }) {
  const colored = mode === 'renk'
  const bg = colored && value ? STEP_COLORS[value] : 'var(--ivory)'
  const pipColor = colored ? '#ffffff' : '#1b1b1b'
  const pips = value || 0
  const grid = {
    1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]], 5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  }
  return (
    <div className={`die die-${size}`} style={{ background: bg }}>
      {value ? (
        <svg viewBox="0 0 60 60" width="100%" height="100%">
          {grid[pips].map(([r, c], i) => (<circle key={i} cx={14 + c * 16} cy={14 + r * 16} r="5.2" fill={pipColor} />))}
        </svg>
      ) : (<span className="die-q">?</span>)}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ANA OYUN                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const [balance, setBalance] = useState(START_BALANCE)
  const [phase, setPhase] = useState('betting')
  const [modeKey, setModeKey] = useState('renk')
  const [playMode, setPlayMode] = useState('manual')
  const [betType, setBetType] = useState('kazanan')
  const [theme, setTheme] = useState('grass')
  const [muted, setMutedState] = useState(false)
  const [lineup, setLineup] = useState(() => pickLineup())
  const [selected, setSelected] = useState(null)
  const [bet, setBet] = useState(0)
  const [countdown, setCountdown] = useState(BET_COUNTDOWN)
  const [positions, setPositions] = useState(Array(7).fill(0))
  const [lastRolls, setLastRolls] = useState(Array(7).fill(null))
  const [winner, setWinner] = useState(null)
  const [order, setOrder] = useState([])
  const [history, setHistory] = useState([])
  const [tick, setTick] = useState(0)
  const [rolling, setRolling] = useState(false)

  const mode = MODES[modeKey]
  const trackLen = mode.track
  const betting = phase === 'betting'
  const payout = BET_TYPES[betType].payout

  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) { startRace(); return }
    const t = setTimeout(() => {
      if (countdown <= 5) sfx.tick()
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown])

  useEffect(() => {
    if (phase !== 'racing' || playMode !== 'auto' || winner !== null) return
    const t = setTimeout(step, TICK_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, positions, playMode, winner])

  function settle(next) {
    if (!next.some((p) => p >= trackLen)) return
    const ord = next
      .map((p, i) => ({ p, i, r: Math.random() }))
      .sort((a, b) => b.p - a.p || b.r - a.r)
      .map((o) => o.i)
    const win = ord[0]
    setOrder(ord)
    setWinner(win)
    setHistory((h) => [win, ...h].slice(0, 10))
    const placed = betType === 'kazanan' ? selected === win : ord[0] === selected || ord[1] === selected
    if (placed) {
      setBalance((b) => b + bet * payout)
      sfx.win()
    } else {
      sfx.lose()
    }
    setTimeout(() => setPhase('result'), 700)
  }

  function step() {
    const rolls = lineup.map(() => rollFace(mode.faces))
    const next = positions.map((p, i) => p + rolls[i])
    setLastRolls(rolls)
    setPositions(next)
    setTick((k) => k + 1)
    setRolling(true)
    setTimeout(() => setRolling(false), TICK_MS)
    sfx.roll(selected !== null ? rolls[selected] : rolls[0])
    settle(next)
  }

  function manualStep() {
    if (phase !== 'racing' || winner !== null || rolling) return
    step()
  }

  function placeBet() {
    if (selected === null || bet <= 0 || bet > balance) return
    sfx.bet()
    setBalance((b) => b - bet)
    setCountdown(BET_COUNTDOWN)
    setPhase('countdown')
  }

  function cancelBet() { setBalance((b) => b + bet); setPhase('betting') }

  function startRace() {
    sfx.start()
    setPositions(Array(7).fill(0)); setLastRolls(Array(7).fill(null))
    setWinner(null); setOrder([]); setTick(0); setRolling(false); setPhase('racing')
  }

  function newRound() {
    setLineup(pickLineup())
    setPositions(Array(7).fill(0)); setLastRolls(Array(7).fill(null))
    setWinner(null); setOrder([]); setSelected(null); setBet(0); setPhase('betting')
    if (balance <= 0) setBalance(START_BALANCE)
  }

  function toggleSound() {
    const m = !muted
    setMutedState(m)
    sfx.setMuted(m)
    if (!m) sfx.unlock()
  }

  const winBet = betType === 'kazanan'
  const placedWin = winner !== null && (winBet ? winner === selected : order[0] === selected || order[1] === selected)
  const myRank = selected !== null && order.length ? order.indexOf(selected) + 1 : null
  const max = Math.max(...positions)
  const leaderIdx = max === 0 ? null : positions.indexOf(max)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-flag" />
          <h1>HİPODROM <em>DERBY</em></h1>
          <span className="demo-badge">DEMO</span>
        </div>
        <div className="balance">
          <span className="balance-label">BAKİYE</span>
          <span className="balance-value">{fmt(balance)}</span>
        </div>
      </header>

      <section className="track-panel">
        <div className="track-head">
          <div className="track-title">
            {phase === 'racing' && (<><span className="live-dot" /> {tick}. TUR · {mode.label.toUpperCase()}</>)}
            {phase === 'countdown' && <>BAHİSLER KAPANIYOR — {countdown} SN</>}
            {phase === 'betting' && <>BAHİSLER AÇIK · {trackLen} ADIMLIK PİST</>}
            {phase === 'result' && <>YARIŞ TAMAMLANDI</>}
          </div>
          <div className="head-right">
            {history.length > 0 && (
              <div className="history" title="Son kazanan kulvarlar">
                {history.map((h, i) => (<span key={i} className="history-dot" style={{ background: SILKS[h] }}>{h + 1}</span>))}
              </div>
            )}
            <button className={`icon-btn ${muted ? 'muted' : ''}`} onClick={toggleSound} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'} aria-pressed={!muted}>
              {muted ? (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor" /><path d="M15.5 8.5a5 5 0 010 7M18 6a8 8 0 010 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              )}
            </button>
            <div className="theme-toggle" role="group" aria-label="Pist zemini">
              <button className={theme === 'grass' ? 'active' : ''} onClick={() => setTheme('grass')}>Çim</button>
              <button className={theme === 'sand' ? 'active' : ''} onClick={() => setTheme('sand')}>Kum</button>
            </div>
          </div>
        </div>

        <div className={`track theme-${theme}`}>
          {lineup.map((h, i) => {
            const pct = Math.min(positions[i] / trackLen, 1)
            return (
              <div key={i} className={`lane ${selected === i ? 'lane-mine' : ''} ${winner === i ? 'lane-winner' : ''} ${phase === 'result' && order[1] === i ? 'lane-place' : ''}`}>
                <div className="lane-no" style={{ background: h.silk }}>{i + 1}</div>
                <div className="lane-run">
                  <div className="lane-marks"><i /><i /><i /></div>
                  <div className="runner" style={{ '--p': pct }}>
                    <Horse silk={h.silk} number={i + 1} running={phase === 'racing'} won={winner === i} />
                    {phase === 'racing' && lastRolls[i] && (
                      <span className="roll-pop" key={tick} style={{ background: modeKey === 'renk' ? STEP_COLORS[lastRolls[i]] : 'var(--ivory)', color: modeKey === 'renk' ? '#fff' : '#1b1b1b' }}>+{lastRolls[i]}</span>
                    )}
                  </div>
                </div>
                <div className="finish-strip" />
              </div>
            )
          })}
        </div>

        {phase === 'result' && winner !== null && (
          <div className="result-overlay">
            <div className={`result-card ${placedWin ? 'win' : 'lose'}`}>
              <div className="result-eyebrow">FOTO FİNİŞ</div>
              <div className="result-horse">
                <span className="history-dot big" style={{ background: SILKS[winner] }}>{winner + 1}</span>
                {lineup[winner].name}
              </div>
              <div className="podium">
                <span className="pod pod-1"><b>1.</b> {lineup[order[0]].name}</span>
                <span className="pod pod-2"><b>2.</b> {lineup[order[1]].name}</span>
              </div>
              {selected !== null && (
                <div className="result-payline">
                  {placedWin ? (<>{winBet ? 'KAZANDINIZ' : 'PLASE!'} · <strong>+{fmt(bet * payout)}</strong></>) : (<>Atınız {lineup[selected].name} {myRank}. oldu · −{fmt(bet)}</>)}
                </div>
              )}
              <button className="btn btn-gold" onClick={newRound}>YENİ TUR</button>
            </div>
          </div>
        )}
      </section>

      <div className="deck">
        <div className="card">
          <div className="card-title">AYARLAR</div>
          <div className="set-label">Zar Modu</div>
          <div className="seg">
            {Object.values(MODES).map((m) => (
              <button key={m.key} className={modeKey === m.key ? 'active' : ''} disabled={!betting} onClick={() => setModeKey(m.key)}><b>{m.label}</b><small>{m.desc}</small></button>
            ))}
          </div>
          <div className="set-label">Oyun Şekli</div>
          <div className="seg">
            <button className={playMode === 'manual' ? 'active' : ''} disabled={!betting} onClick={() => setPlayMode('manual')}><b>Tek Tek</b><small>Zarı sen atarsın</small></button>
            <button className={playMode === 'auto' ? 'active' : ''} disabled={!betting} onClick={() => setPlayMode('auto')}><b>Otomatik</b><small>Kendi koşar</small></button>
          </div>
          {modeKey === 'renk' && (
            <div className="legend">
              <span><i style={{ background: STEP_COLORS[1] }} />Mavi=1</span>
              <span><i style={{ background: STEP_COLORS[2] }} />Sarı=2</span>
              <span><i style={{ background: STEP_COLORS[3] }} />Kırmızı=3</span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">ATINI SEÇ <span className="surface-tag">{theme === 'grass' ? 'ÇİM' : 'KUM'} ZEMİN</span></div>
          <div className="horse-list">
            {lineup.map((h, i) => (
              <button key={i} className={`horse-row ${selected === i ? 'active' : ''} ${leaderIdx === i && phase === 'racing' ? 'leading' : ''}`} disabled={!betting} onClick={() => betting && setSelected(i)}>
                <span className="silk" style={{ background: h.silk }}>{i + 1}</span>
                <span className="hname">{h.name}</span>
                {betting ? (
                  <span className="form"><b className={theme === 'grass' ? 'on' : ''}>ÇİM {h.fg}</b><b className={theme === 'sand' ? 'on' : ''}>KUM {h.fs}</b></span>
                ) : (<span className="hsteps">{Math.min(positions[i], trackLen)}/{trackLen}</span>)}
              </button>
            ))}
          </div>
          <p className="form-note">Form değerleri bilgi amaçlıdır, sonucu etkilemez.</p>
        </div>

        <div className="card card-bet">
          <div className="card-title">BAHİS <span className="odds-tag">ORAN {payout.toFixed(2)}x</span></div>
          {betting && (
            <>
              <div className="set-label">Bahis Türü</div>
              <div className="seg">
                {Object.values(BET_TYPES).map((t) => (
                  <button key={t.key} className={betType === t.key ? 'active' : ''} onClick={() => setBetType(t.key)}><b>{t.label}</b><small>{t.hint} · {t.payout}x</small></button>
                ))}
              </div>
              <div className="chip-row">
                {CHIPS.map((c) => (<button key={c} className="chip" onClick={() => setBet((b) => Math.min(b + c, balance))}>+{c}</button>))}
                <button className="chip chip-clear" disabled={bet === 0} onClick={() => setBet(0)}>SİL</button>
              </div>
              <div className="bet-summary">
                <div><span className="bs-label">BAHİS</span><span className="bs-value">{fmt(bet)}</span></div>
                <div><span className="bs-label">OLASI KAZANÇ</span><span className="bs-value gold">{fmt(bet * payout)}</span></div>
              </div>
              <button className="btn btn-gold wide" disabled={selected === null || bet <= 0 || bet > balance} onClick={placeBet}>
                {selected === null ? 'ÖNCE AT SEÇ' : bet <= 0 ? 'BAHİS MİKTARI SEÇ' : `${lineup[selected].name} · ${BET_TYPES[betType].label.toUpperCase()}`}
              </button>
            </>
          )}
          {phase === 'countdown' && (
            <div className="countdown-box">
              <div className="cd-ring"><span>{countdown}</span></div>
              <div className="cd-actions">
                <button className="btn btn-gold" onClick={startRace}>HEMEN BAŞLAT</button>
                <button className="btn btn-ghost" onClick={cancelBet}>BAHSİ İPTAL ET</button>
              </div>
            </div>
          )}
          {phase === 'racing' && (
            <div className="race-box">
              {playMode === 'manual' ? (
                <button className="dice-action" onClick={manualStep} disabled={rolling || winner !== null}>
                  <Die mode={modeKey} value={lastRolls[selected]} size="lg" key={tick} />
                  <span className="dice-cta">{winner !== null ? 'BİTTİ' : 'ZAR AT'}</span>
                </button>
              ) : (
                <div className="dice-action auto">
                  <Die mode={modeKey} value={lastRolls[selected]} size="lg" key={tick} />
                  <span className="dice-cta">OTOMATİK</span>
                </div>
              )}
              <div className="race-info">
                <div><span className="bs-label">ATINIZ · {BET_TYPES[betType].label.toUpperCase()}</span><span className="bs-value sm">{selected !== null ? lineup[selected].name : '—'}</span></div>
                <div><span className="bs-label">SON ZAR</span><span className="bs-value sm">{lastRolls[selected] ? (modeKey === 'renk' ? `${STEP_NAMES[lastRolls[selected]]} +${lastRolls[selected]}` : `+${lastRolls[selected]}`) : '—'}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="fineprint">
        7 at · Kazanan 1/7 → 6.50x · Plase ilk 2 → 3.25x · İkisinde de teorik RTP %92.9 ·
        Form göstergeleri ve pist zemini sonucu etkilemez · Demo kredisi gerçek para değildir.
      </p>
    </div>
  )
}
