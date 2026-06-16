import { useEffect, useState } from 'react'
import * as sfx from './sound'
import {
  MODES, BET_TYPES, STEP_NAMES, SILKS, CHIPS, STEP_COLORS, TICK_MS,
  fmt, pickLineup, Die, BallBoard, RaceTrack,
} from './game'

const BET_COUNTDOWN = 10
const START_BALANCE = 1000

export default function SingleRace() {
  const [balance, setBalance] = useState(START_BALANCE)
  const [phase, setPhase] = useState('betting')
  const [modeKey, setModeKey] = useState('sayi')
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
    const rolls = lineup.map(() => MODES[modeKey].faces[Math.floor(Math.random() * MODES[modeKey].faces.length)])
    const next = positions.map((p, i) => p + rolls[i])
    setLastRolls(rolls)
    setPositions(next)
    setTick((k) => k + 1)
    setRolling(true)
    setTimeout(() => setRolling(false), TICK_MS)
    sfx.hoof()
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

        <RaceTrack
          theme={theme} lineup={lineup} positions={positions} trackLen={trackLen}
          modeKey={modeKey} lastRolls={lastRolls} tick={tick}
          mineIdx={selected} winnerIdx={winner}
          placeIdx={phase === 'result' ? order[1] : null} running={phase === 'racing'}
        />

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
          <div className="set-label">Oyun Modu</div>
          <div className="seg modes">
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
              {mode.ball ? (
                <BallBoard holes={mode.holes} value={lastRolls[selected]} tick={tick} auto={playMode === 'auto'} disabled={rolling || winner !== null} done={winner !== null} onThrow={manualStep} />
              ) : playMode === 'manual' ? (
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
                <div><span className="bs-label">{mode.ball ? 'SON TOP' : 'SON ZAR'}</span><span className="bs-value sm">{lastRolls[selected] ? (modeKey === 'renk' ? `${STEP_NAMES[lastRolls[selected]]} +${lastRolls[selected]}` : `+${lastRolls[selected]}`) : '—'}</span></div>
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
