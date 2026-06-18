import { useEffect, useMemo, useState } from 'react'
import * as sfx from './sound'
import {
  MODES, BET_TYPES, STEP_NAMES, SILKS, CHIPS, STEP_COLORS, TICK_MS, PLACE_N,
  fmt, pickLineup, buildField, weightedPick, genLightning, Die, BallBoard, RaceTrack,
} from './game'

const START_BALANCE = 1000

export default function SingleRace() {
  const [balance, setBalance] = useState(START_BALANCE)
  const [phase, setPhase] = useState('betting') // betting | racing | result
  const [modeKey, setModeKey] = useState('sayi')
  const [playMode, setPlayMode] = useState('auto')
  const [theme, setTheme] = useState('grass')
  const [muted, setMutedState] = useState(false)
  const [lineup, setLineup] = useState(() => pickLineup())

  // bahis fişi (çoklu)
  const [bets, setBets] = useState([])
  const [pickHorse, setPickHorse] = useState(null)
  const [pickType, setPickType] = useState('kazanan')
  const [pickAmount, setPickAmount] = useState(50)

  // yarış
  const [positions, setPositions] = useState(Array(10).fill(0))
  const [lastRolls, setLastRolls] = useState(Array(10).fill(null))
  const [winner, setWinner] = useState(null)
  const [order, setOrder] = useState([])
  const [history, setHistory] = useState([])
  const [tick, setTick] = useState(0)
  const [rolling, setRolling] = useState(false)

  // şimşek
  const [lightning, setLightning] = useState(null)
  const [lightM, setLightM] = useState(Array(10).fill(0))
  const [firedCount, setFiredCount] = useState(0)
  const [struck, setStruck] = useState(null)

  const [betResults, setBetResults] = useState([])

  const mode = MODES[modeKey]
  const trackLen = mode.track
  const betting = phase === 'betting'

  const field = useMemo(() => {
    const ratings = lineup.map((h) => (theme === 'grass' ? h.fg : h.fs))
    return buildField(ratings, MODES[modeKey])
  }, [lineup, modeKey, theme])

  const totalStake = bets.reduce((s, b) => s + b.amount, 0)
  const mineIdxs = betting ? (pickHorse !== null ? [pickHorse] : []) : bets.map((b) => b.horse)
  const pickOdds = pickHorse === null ? null : pickType === 'kazanan' ? field.oddsWin[pickHorse] : pickType === 'plase' ? field.oddsPlase[pickHorse] : null
  const canStart = bets.length > 0 && totalStake <= balance

  useEffect(() => {
    if (phase !== 'racing' || playMode !== 'auto' || winner !== null) return
    const t = setTimeout(step, TICK_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, positions, playMode, winner])

  function fireStrikes(next) {
    if (!lightning) return
    const prog = Math.max(...next) / trackLen
    let fc = firedCount
    const nm = [...lightM]
    let last = null
    while (fc < lightning.strikes.length && lightning.strikes[fc].atProgress <= prog) {
      const st = lightning.strikes[fc]; nm[st.horse] = st.M; last = { horse: st.horse, M: st.M, id: fc }; fc++
    }
    if (last) { setLightM(nm); setFiredCount(fc); setStruck(last); sfx.zap?.() }
  }

  function settle(next) {
    if (!next.some((p) => p >= trackLen)) return
    const ord = next.map((p, i) => ({ p, i, r: Math.random() })).sort((a, b) => b.p - a.p || b.r - a.r).map((o) => o.i)
    const fM = lightning ? lightning.finalM : Array(10).fill(0)
    setLightM(fM)
    setOrder(ord); setWinner(ord[0]); setHistory((h) => [ord[0], ...h].slice(0, 10))
    const results = bets.map((b) => {
      let hit = false, win = 0, mult = b.odds
      if (b.type === 'kazanan') { hit = ord[0] === b.horse; win = hit ? b.amount * b.odds : 0 }
      else if (b.type === 'plase') { hit = ord.slice(0, PLACE_N).includes(b.horse); win = hit ? b.amount * b.odds : 0 }
      else { mult = fM[b.horse]; hit = mult > 0; win = mult > 0 ? b.amount * mult : 0 }
      return { ...b, hit, win, mult }
    })
    setBetResults(results)
    const totalWin = results.reduce((s, r) => s + r.win, 0)
    if (totalWin > 0) { setBalance((bal) => bal + totalWin); sfx.win() } else sfx.lose()
    setTimeout(() => setPhase('result'), 800)
  }

  function step() {
    const rolls = lineup.map((_, i) => weightedPick(MODES[modeKey].faces, field.weights[i]))
    const next = positions.map((p, i) => p + rolls[i])
    setLastRolls(rolls); setPositions(next); setTick((k) => k + 1)
    setRolling(true); setTimeout(() => setRolling(false), TICK_MS)
    sfx.hoof()
    fireStrikes(next)
    settle(next)
  }

  function manualStep() { if (phase !== 'racing' || winner !== null || rolling) return; step() }

  function addBet() {
    if (pickHorse === null || pickAmount <= 0) return
    const odds = pickType === 'kazanan' ? field.oddsWin[pickHorse] : pickType === 'plase' ? field.oddsPlase[pickHorse] : 0
    setBets((bs) => [...bs, { horse: pickHorse, type: pickType, amount: pickAmount, odds }])
    sfx.bet()
  }
  function removeBet(i) { setBets((bs) => bs.filter((_, k) => k !== i)) }

  function startRace() {
    if (!canStart) return
    sfx.start()
    setBalance((b) => b - totalStake)
    setLightning(genLightning(10)); setLightM(Array(10).fill(0)); setFiredCount(0); setStruck(null)
    setPositions(Array(10).fill(0)); setLastRolls(Array(10).fill(null))
    setWinner(null); setOrder([]); setTick(0); setRolling(false)
    setPhase('racing')
  }

  function newRound() {
    setLineup(pickLineup())
    setBets([]); setPickHorse(null); setPickAmount(50)
    setPositions(Array(10).fill(0)); setLastRolls(Array(10).fill(null))
    setWinner(null); setOrder([]); setBetResults([])
    setLightning(null); setLightM(Array(10).fill(0)); setFiredCount(0); setStruck(null)
    setPhase('betting')
    if (balance <= 0) setBalance(START_BALANCE)
  }

  function toggleSound() { const m = !muted; setMutedState(m); sfx.setMuted(m); if (!m) sfx.unlock() }
  function addChip(c) { setPickAmount((a) => Math.min(a + c, balance)) }
  function setCustom(v) { setPickAmount(Math.max(0, Math.min(parseInt(v || '0', 10) || 0, balance))) }

  const max = Math.max(...positions)
  const leaderIdx = max === 0 ? null : positions.indexOf(max)
  const placeIdxs = phase === 'result' ? [order[1], order[2]] : []
  const totalWin = betResults.reduce((s, r) => s + r.win, 0)
  const netResult = totalWin - totalStake
  const topMult = Math.max(0, ...lightM)

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
            {phase === 'racing' && (<><span className="live-dot" /> {tick}. TUR · {mode.label.toUpperCase()}{topMult > 0 ? ` · EN YÜKSEK ⚡${topMult}x` : ''}</>)}
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
              <button className={theme === 'grass' ? 'active' : ''} disabled={!betting} onClick={() => setTheme('grass')}>Çim</button>
              <button className={theme === 'sand' ? 'active' : ''} disabled={!betting} onClick={() => setTheme('sand')}>Kum</button>
            </div>
          </div>
        </div>

        <RaceTrack
          theme={theme} lineup={lineup} positions={positions} trackLen={trackLen}
          modeKey={modeKey} lastRolls={lastRolls} tick={tick}
          mineIdxs={mineIdxs} winnerIdx={winner} placeIdxs={placeIdxs}
          lightM={lightM} struck={struck} running={phase === 'racing'}
        />

        {phase === 'result' && winner !== null && (
          <div className="result-overlay">
            <div className={`result-card ${netResult >= 0 ? 'win' : 'lose'}`}>
              <div className="result-eyebrow">FOTO FİNİŞ</div>
              <div className="result-horse">
                <span className="history-dot big" style={{ background: SILKS[winner] }}>{winner + 1}</span>
                {lineup[winner].name}
              </div>
              <div className="podium">
                <span className="pod pod-1"><b>1.</b> {lineup[order[0]].name}</span>
                <span className="pod pod-2"><b>2.</b> {lineup[order[1]].name}</span>
                <span className="pod pod-3"><b>3.</b> {lineup[order[2]].name}</span>
              </div>

              {betResults.length > 0 && (
                <div className="slip-results">
                  {betResults.map((r, i) => (
                    <div key={i} className={`sr-row ${r.hit ? 'ok' : 'no'}`}>
                      <span className="sr-silk" style={{ background: lineup[r.horse].silk }}>{r.horse + 1}</span>
                      <span className="sr-name">{lineup[r.horse].name}</span>
                      <span className="sr-type">{BET_TYPES[r.type].label}{r.type === 'simsek' && r.hit ? ` ⚡${r.mult}x` : ''}</span>
                      <span className="sr-amt">{fmt(r.amount)}</span>
                      <span className="sr-win">{r.hit ? `+${fmt(r.win)}` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="result-payline">
                {netResult >= 0
                  ? <>Toplam kazanç <strong>+{fmt(totalWin)}</strong> · net <strong>{netResult >= 0 ? '+' : ''}{fmt(netResult)}</strong></>
                  : <>Toplam kazanç {fmt(totalWin)} · net <strong>−{fmt(Math.abs(netResult))}</strong></>}
              </div>
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
            {lineup.map((h, i) => {
              const myBets = bets.filter((b) => b.horse === i).length
              return (
                <button key={i} className={`horse-row ${pickHorse === i ? 'active' : ''} ${leaderIdx === i && phase === 'racing' ? 'leading' : ''}`} disabled={!betting} onClick={() => betting && setPickHorse(i)}>
                  <span className="silk" style={{ background: h.silk }}>{i + 1}</span>
                  <span className="hcol">
                    <span className="hname">{h.name}{myBets > 0 && <em className="mybet-tag">{myBets} bahis</em>}</span>
                    <span className="hform2"><b className={theme === 'grass' ? 'on' : ''}>ÇİM {h.fg}</b><b className={theme === 'sand' ? 'on' : ''}>KUM {h.fs}</b></span>
                  </span>
                  {betting ? (
                    <span className="row-odds">{field.oddsWin[i].toFixed(2)}<small>x</small></span>
                  ) : (
                    <span className="hsteps">{lightM[i] > 0 ? <b className="lit-mini">⚡{lightM[i]}x</b> : `${Math.min(positions[i], trackLen)}/${trackLen}`}</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="form-note">Oranlar gerçek kazanma şansını yansıtır (zemin/form etkiler). Şimşek bahsi bitiş sırasından bağımsızdır.</p>
        </div>

        <div className="card card-bet">
          <div className="card-title">BAHİS {betting && pickHorse !== null && <span className="odds-tag">{pickType === 'simsek' ? 'ŞİMŞEK ⚡' : `${pickOdds.toFixed(2)}x`}</span>}</div>
          {betting && (
            <>
              <div className="set-label">Bahis Türü</div>
              <div className="seg seg3">
                {Object.values(BET_TYPES).map((t) => (
                  <button key={t.key} className={pickType === t.key ? 'active' : ''} onClick={() => setPickType(t.key)}>
                    <b>{t.label}</b>
                    <small>{t.key === 'simsek' ? 'Çarpan' : pickHorse !== null ? `${(t.key === 'kazanan' ? field.oddsWin[pickHorse] : field.oddsPlase[pickHorse]).toFixed(2)}x` : t.hint}</small>
                  </button>
                ))}
              </div>
              <div className="chip-row">
                {CHIPS.map((c) => (<button key={c} className="chip" onClick={() => addChip(c)}>+{c}</button>))}
                <button className="chip chip-clear" disabled={pickAmount === 0} onClick={() => setPickAmount(0)}>SİL</button>
                <input className="stake-input" type="number" min="0" value={pickAmount || ''} onChange={(e) => setCustom(e.target.value)} placeholder="0" />
              </div>
              <button className="btn btn-add" disabled={pickHorse === null || pickAmount <= 0} onClick={addBet}>
                {pickHorse === null ? 'ÖNCE AT SEÇ' : pickAmount <= 0 ? 'MİKTAR GİR' : `FİŞE EKLE · ${lineup[pickHorse].name} ${BET_TYPES[pickType].label} ${fmt(pickAmount)}`}
              </button>

              <div className="set-label slip-label">BAHİS FİŞİ {bets.length > 0 && `(${bets.length})`}</div>
              {bets.length === 0 ? (
                <p className="slip-empty">Henüz bahis yok. At seç, tür ve miktar belirle, “Fişe Ekle”.</p>
              ) : (
                <div className="slip">
                  {bets.map((b, i) => (
                    <div key={i} className="slip-row">
                      <span className="sr-silk" style={{ background: lineup[b.horse].silk }}>{b.horse + 1}</span>
                      <span className="sr-name">{lineup[b.horse].name}</span>
                      <span className="sr-type">{BET_TYPES[b.type].label}</span>
                      <span className="sr-amt">{fmt(b.amount)}</span>
                      <span className="sr-pot">{b.type === 'simsek' ? '⚡?' : `→ ${fmt(b.amount * b.odds)}`}</span>
                      <button className="sr-x" onClick={() => removeBet(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="bet-summary">
                <div><span className="bs-label">TOPLAM BAHİS</span><span className="bs-value">{fmt(totalStake)}</span></div>
                <div><span className="bs-label">KALAN BAKİYE</span><span className="bs-value">{fmt(balance - totalStake)}</span></div>
              </div>
              <button className="btn btn-gold wide" disabled={!canStart} onClick={startRace}>
                {bets.length === 0 ? 'FİŞE BAHİS EKLE' : totalStake > balance ? 'BAKİYE YETMİYOR' : `YARIŞI BAŞLAT · ${fmt(totalStake)}`}
              </button>
            </>
          )}
          {phase === 'racing' && (
            <div className="race-box">
              {mode.ball ? (
                <BallBoard holes={mode.holes} value={lastRolls[leaderIdx]} tick={tick} auto={playMode === 'auto'} disabled={rolling || winner !== null} done={winner !== null} onThrow={manualStep} />
              ) : playMode === 'manual' ? (
                <button className="dice-action" onClick={manualStep} disabled={rolling || winner !== null}>
                  <Die mode={modeKey} value={lastRolls[leaderIdx]} size="lg" key={tick} />
                  <span className="dice-cta">{winner !== null ? 'BİTTİ' : 'ZAR AT'}</span>
                </button>
              ) : (
                <div className="dice-action auto">
                  <Die mode={modeKey} value={lastRolls[leaderIdx]} size="lg" key={tick} />
                  <span className="dice-cta">OTOMATİK</span>
                </div>
              )}
              <div className="race-info">
                <div><span className="bs-label">BAHİSLERİN</span><span className="bs-value sm">{bets.length} bahis · {fmt(totalStake)}</span></div>
                <div><span className="bs-label">EN YÜKSEK ÇARPAN</span><span className="bs-value sm">{topMult > 0 ? `⚡${topMult}x` : '—'}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="fineprint">
        10 at · Kazanan (1.) ve Plase (ilk 3) oranları gerçek kazanma şansına göre · Şimşek: yarışta ata biriken çarpan kadar öder, bitiş sırasından bağımsız ·
        Tüm bahislerde teorik RTP %92.9 · Çarpan tavanı 1000x · Demo kredisi gerçek para değildir.
      </p>
    </div>
  )
}
