import { useEffect, useMemo, useState } from 'react'

/* ------------------------------------------------------------------ */
/*  OYUN AYARLARI — ileride backend/JSON config'e taşınabilir          */
/* ------------------------------------------------------------------ */

const PAYOUT = 6.5 // 7 at, eşit şans → adil oran 7.00x, ödeme 6.50x → RTP ≈ %92.9
const TICK_MS = 880 // her zar turu arası süre (animasyon temposu)
const BET_COUNTDOWN = 10 // bahis kapanış sayacı (saniye)
const START_BALANCE = 1000

const MODES = {
  renk: {
    key: 'renk',
    label: 'Renkli Zar',
    desc: '3 renk · 1-2-3 adım · 24 adımlık pist',
    faces: [1, 1, 2, 2, 3, 3], // mavi, mavi, sarı, sarı, kırmızı, kırmızı
    track: 24,
  },
  sayi: {
    key: 'sayi',
    label: 'Sayılı Zar',
    desc: '1-6 arası · 42 adımlık pist',
    faces: [1, 2, 3, 4, 5, 6],
    track: 42,
  },
}

const STEP_COLORS = { 1: '#3D7BE8', 2: '#E8B64C', 3: '#E2484A' } // mavi, sarı, kırmızı
const STEP_NAMES = { 1: 'MAVİ', 2: 'SARI', 3: 'KIRMIZI' }

const HORSES = [
  { name: 'ŞİMŞEK', silk: '#E2484A' },
  { name: 'POYRAZ', silk: '#3D7BE8' },
  { name: 'FIRTINA', silk: '#E8B64C' },
  { name: 'KARAYEL', silk: '#9B5DE5' },
  { name: 'RÜZGÂR', silk: '#2EC27E' },
  { name: 'YILDIZ', silk: '#F2742C' },
  { name: 'LODOS', silk: '#29B8C9' },
]

const CHIPS = [10, 25, 50, 100, 250]

const fmt = (n) =>
  n.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

const rollFace = (faces) => faces[Math.floor(Math.random() * faces.length)]

/* ------------------------------------------------------------------ */
/*  AT — SVG silüet + dörtnal animasyonu                               */
/* ------------------------------------------------------------------ */

function Horse({ silk, number, running, won }) {
  return (
    <svg
      className={`horse ${running ? 'running' : ''} ${won ? 'won' : ''}`}
      viewBox="0 0 76 52"
      width="76"
      height="52"
      aria-hidden="true"
    >
      <g className="horse-body-group">
        {/* kuyruk */}
        <path
          d="M16 22 C8 20 5 28 8 35 C10 30 12 27 18 27 Z"
          fill="#241A12"
        />
        {/* arka bacaklar */}
        <rect className="leg leg-b1" x="21" y="29" width="3.4" height="18" rx="1.6" fill="#33251A" />
        <rect className="leg leg-b2" x="27" y="30" width="3.4" height="17" rx="1.6" fill="#241A12" />
        {/* ön bacaklar */}
        <rect className="leg leg-f1" x="44" y="30" width="3.4" height="17" rx="1.6" fill="#241A12" />
        <rect className="leg leg-f2" x="50" y="29" width="3.4" height="18" rx="1.6" fill="#33251A" />
        {/* gövde */}
        <ellipse cx="36" cy="26" rx="18" ry="9" fill="#3B2A1E" />
        {/* boyun + baş */}
        <path d="M48 24 L58 8 L65 11 L68 16 L63 17 L55 30 Z" fill="#3B2A1E" />
        <path d="M58 8 L61 3 L63.5 9 Z" fill="#33251A" />
        {/* yele */}
        <path d="M50 22 L59 9 L62 11 L53 25 Z" fill="#241A12" />
        {/* eyer örtüsü — forma rengi + numara */}
        <rect x="29" y="19" width="14" height="11" rx="2" fill={silk} />
        <text
          x="36"
          y="27.5"
          textAnchor="middle"
          fontSize="9"
          fontWeight="800"
          fill="#fff"
          fontFamily="'Barlow Condensed', sans-serif"
        >
          {number}
        </text>
        {/* jokey */}
        <path d="M33 14 C33 10 41 10 41 14 L40 19 L34 19 Z" fill={silk} />
        <circle cx="37" cy="9.5" r="3.6" fill="#E8C9A0" />
        <path d="M33.2 8.5 A 4 4 0 0 1 40.8 8.5 L 41.5 9.5 L 32.5 9.5 Z" fill={silk} />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  ZAR                                                                */
/* ------------------------------------------------------------------ */

function Die({ mode, value, rolling, size = 'lg' }) {
  const colored = mode === 'renk'
  const bg = colored && value ? STEP_COLORS[value] : 'var(--ivory)'
  const pipColor = colored ? '#ffffff' : '#1b1b1b'
  const pips = value || 0
  const grid = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  }
  return (
    <div
      className={`die die-${size} ${rolling ? 'rolling' : ''}`}
      style={{ background: bg }}
    >
      {value ? (
        <svg viewBox="0 0 60 60" width="100%" height="100%">
          {grid[pips].map(([r, c], i) => (
            <circle key={i} cx={14 + c * 16} cy={14 + r * 16} r="5.2" fill={pipColor} />
          ))}
        </svg>
      ) : (
        <span className="die-q">?</span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ANA OYUN                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const [balance, setBalance] = useState(START_BALANCE)
  const [phase, setPhase] = useState('betting') // betting | countdown | racing | result
  const [modeKey, setModeKey] = useState('renk')
  const [selected, setSelected] = useState(null)
  const [bet, setBet] = useState(0)
  const [countdown, setCountdown] = useState(BET_COUNTDOWN)
  const [positions, setPositions] = useState(Array(7).fill(0))
  const [lastRolls, setLastRolls] = useState(Array(7).fill(null))
  const [winner, setWinner] = useState(null)
  const [history, setHistory] = useState([])
  const [tick, setTick] = useState(0)

  const mode = MODES[modeKey]
  const trackLen = mode.track
  const betting = phase === 'betting' || phase === 'countdown'

  /* ---- bahis sayacı ---- */
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      startRace()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown])

  /* ---- yarış döngüsü: her tick'te 7 at da kendi zarını atar ---- */
  useEffect(() => {
    if (phase !== 'racing') return
    const t = setTimeout(() => {
      const rolls = HORSES.map(() => rollFace(mode.faces))
      const next = positions.map((p, i) => p + rolls[i])
      setLastRolls(rolls)
      setPositions(next)
      setTick((k) => k + 1)

      const finishers = next
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p >= trackLen)

      if (finishers.length > 0) {
        // foto finiş: en ileride olan kazanır, tam eşitlikte rastgele seçilir
        const best = Math.max(...finishers.map((f) => f.p))
        const leaders = finishers.filter((f) => f.p === best)
        const win = leaders[Math.floor(Math.random() * leaders.length)].i
        setWinner(win)
        setHistory((h) => [win, ...h].slice(0, 12))
        if (win === selected) {
          setBalance((b) => b + bet * PAYOUT)
        }
        setTimeout(() => setPhase('result'), 700)
      }
    }, TICK_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, positions])

  function placeBet() {
    if (selected === null || bet <= 0 || bet > balance) return
    setBalance((b) => b - bet)
    setCountdown(BET_COUNTDOWN)
    setPhase('countdown')
  }

  function cancelBet() {
    setBalance((b) => b + bet)
    setPhase('betting')
  }

  function startRace() {
    setPositions(Array(7).fill(0))
    setLastRolls(Array(7).fill(null))
    setWinner(null)
    setTick(0)
    setPhase('racing')
  }

  function newRound() {
    setPositions(Array(7).fill(0))
    setLastRolls(Array(7).fill(null))
    setWinner(null)
    setSelected(null)
    setBet(0)
    setPhase('betting')
    if (balance <= 0) setBalance(START_BALANCE) // demo: bakiye yenile
  }

  const playerWon = winner !== null && winner === selected
  const leaderIdx = useMemo(() => {
    const max = Math.max(...positions)
    if (max === 0) return null
    return positions.indexOf(max)
  }, [positions])

  return (
    <div className="app">
      {/* ---------- ÜST BAR ---------- */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-flag" />
          <h1>
            HİPODROM <em>DERBY</em>
          </h1>
          <span className="demo-badge">DEMO</span>
        </div>
        <div className="balance">
          <span className="balance-label">BAKİYE</span>
          <span className="balance-value">{fmt(balance)}</span>
        </div>
      </header>

      <main className="layout">
        {/* ---------- PİST ---------- */}
        <section className="track-panel">
          <div className="track-head">
            <div className="track-title">
              {phase === 'racing' && (
                <>
                  <span className="live-dot" /> {tick}. TUR · {mode.label.toUpperCase()}
                </>
              )}
              {phase === 'countdown' && <>BAHİSLER KAPANIYOR — {countdown} SN</>}
              {phase === 'betting' && <>BAHİSLER AÇIK · {mode.label.toUpperCase()} · {trackLen} ADIM</>}
              {phase === 'result' && <>YARIŞ TAMAMLANDI</>}
            </div>
            {history.length > 0 && (
              <div className="history" title="Son kazananlar">
                {history.map((h, i) => (
                  <span key={i} className="history-dot" style={{ background: HORSES[h].silk }}>
                    {h + 1}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="track">
            {HORSES.map((h, i) => {
              const pct = Math.min(positions[i] / trackLen, 1)
              return (
                <div
                  key={h.name}
                  className={`lane ${selected === i ? 'lane-mine' : ''} ${
                    winner === i ? 'lane-winner' : ''
                  }`}
                >
                  <div className="lane-no" style={{ background: h.silk }}>
                    {i + 1}
                  </div>
                  <div className="lane-run">
                    <div className="lane-marks">
                      <i /><i /><i />
                    </div>
                    <div className="runner" style={{ '--p': pct }}>
                      <Horse
                        silk={h.silk}
                        number={i + 1}
                        running={phase === 'racing'}
                        won={winner === i}
                      />
                      {phase === 'racing' && lastRolls[i] && (
                        <span
                          className="roll-pop"
                          key={tick}
                          style={{
                            background:
                              modeKey === 'renk' ? STEP_COLORS[lastRolls[i]] : 'var(--ivory)',
                            color: modeKey === 'renk' ? '#fff' : '#1b1b1b',
                          }}
                        >
                          +{lastRolls[i]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="finish-strip" />
                </div>
              )
            })}
          </div>

          {/* ---------- SONUÇ ---------- */}
          {phase === 'result' && winner !== null && (
            <div className="result-overlay">
              <div className={`result-card ${playerWon ? 'win' : 'lose'}`}>
                <div className="result-eyebrow">FOTO FİNİŞ</div>
                <div className="result-horse">
                  <span className="history-dot big" style={{ background: HORSES[winner].silk }}>
                    {winner + 1}
                  </span>
                  {HORSES[winner].name}
                </div>
                {selected !== null && (
                  <div className="result-payline">
                    {playerWon ? (
                      <>KAZANDINIZ · <strong>+{fmt(bet * PAYOUT)}</strong></>
                    ) : (
                      <>Atınız {HORSES[selected].name} kazanamadı · −{fmt(bet)}</>
                    )}
                  </div>
                )}
                <button className="btn btn-gold" onClick={newRound}>
                  YENİ TUR
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ---------- BAHİS PANELİ ---------- */}
        <aside className="side">
          {/* zar modu */}
          <div className="card">
            <div className="card-title">ZAR MODU</div>
            <div className="mode-row">
              {Object.values(MODES).map((m) => (
                <button
                  key={m.key}
                  className={`mode-btn ${modeKey === m.key ? 'active' : ''}`}
                  disabled={phase !== 'betting'}
                  onClick={() => setModeKey(m.key)}
                >
                  <span className="mode-name">{m.label}</span>
                  <span className="mode-desc">{m.desc}</span>
                  {m.key === 'renk' && (
                    <span className="mode-swatches">
                      <i style={{ background: STEP_COLORS[1] }} />
                      <i style={{ background: STEP_COLORS[2] }} />
                      <i style={{ background: STEP_COLORS[3] }} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            {modeKey === 'renk' && (
              <div className="legend">
                <span><i style={{ background: STEP_COLORS[1] }} /> Mavi = 1 adım</span>
                <span><i style={{ background: STEP_COLORS[2] }} /> Sarı = 2 adım</span>
                <span><i style={{ background: STEP_COLORS[3] }} /> Kırmızı = 3 adım</span>
              </div>
            )}
          </div>

          {/* at seçimi */}
          <div className="card">
            <div className="card-title">
              ATINI SEÇ <span className="odds-tag">ORAN {PAYOUT.toFixed(2)}x</span>
            </div>
            <div className="horse-list">
              {HORSES.map((h, i) => (
                <button
                  key={h.name}
                  className={`horse-row ${selected === i ? 'active' : ''} ${
                    leaderIdx === i && phase === 'racing' ? 'leading' : ''
                  }`}
                  disabled={!betting}
                  onClick={() => betting && setSelected(i)}
                >
                  <span className="silk" style={{ background: h.silk }}>{i + 1}</span>
                  <span className="hname">{h.name}</span>
                  {phase === 'racing' || phase === 'result' ? (
                    <span className="hsteps">{Math.min(positions[i], trackLen)}/{trackLen}</span>
                  ) : (
                    <span className="hsteps dim">1/7</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* bahis */}
          <div className="card">
            <div className="card-title">BAHİS</div>
            <div className="chip-row">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  className="chip"
                  disabled={!betting || phase === 'countdown'}
                  onClick={() => setBet((b) => Math.min(b + c, balance))}
                >
                  +{c}
                </button>
              ))}
              <button
                className="chip chip-clear"
                disabled={!betting || phase === 'countdown' || bet === 0}
                onClick={() => setBet(0)}
              >
                SİL
              </button>
            </div>
            <div className="bet-summary">
              <div>
                <span className="bs-label">BAHİS</span>
                <span className="bs-value">{fmt(bet)}</span>
              </div>
              <div>
                <span className="bs-label">OLASI KAZANÇ</span>
                <span className="bs-value gold">{fmt(bet * PAYOUT)}</span>
              </div>
            </div>

            {phase === 'betting' && (
              <button
                className="btn btn-gold wide"
                disabled={selected === null || bet <= 0 || bet > balance}
                onClick={placeBet}
              >
                {selected === null
                  ? 'ÖNCE AT SEÇ'
                  : bet <= 0
                  ? 'BAHİS MİKTARI SEÇ'
                  : `${HORSES[selected].name} İÇİN BAHSİ YATIR`}
              </button>
            )}

            {phase === 'countdown' && (
              <div className="countdown-box">
                <div className="cd-ring">
                  <span>{countdown}</span>
                </div>
                <div className="cd-actions">
                  <button className="btn btn-gold" onClick={startRace}>
                    HEMEN BAŞLAT
                  </button>
                  <button className="btn btn-ghost" onClick={cancelBet}>
                    BAHSİ İPTAL ET
                  </button>
                </div>
              </div>
            )}

            {phase === 'racing' && selected !== null && (
              <div className="my-roll">
                <Die mode={modeKey} value={lastRolls[selected]} rolling size="lg" />
                <div className="my-roll-info">
                  <span className="bs-label">ATINIZIN SON ZARI</span>
                  <span className="bs-value">
                    {lastRolls[selected]
                      ? modeKey === 'renk'
                        ? `${STEP_NAMES[lastRolls[selected]]} · +${lastRolls[selected]}`
                        : `+${lastRolls[selected]} ADIM`
                      : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="fineprint">
            7 at, eşit şans (1/7) · Ödeme {PAYOUT.toFixed(2)}x · Teorik RTP %
            {((PAYOUT / 7) * 100).toFixed(1)} · Demo kredisi gerçek para değildir.
          </p>
        </aside>
      </main>
    </div>
  )
}
