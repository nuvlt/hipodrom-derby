import { useEffect, useMemo, useState } from 'react'
import * as sfx from './sound'
import {
  MODES, BET_TYPES, STEP_NAMES, SILKS, CHIPS, STEP_COLORS, TICK_MS, PLACE_N,
  LIGHTNING_BETA, LIGHTNING_CAP, fmt, pickLineup, buildField, weightedPick, genLightning, Die, BallBoard, RaceTrack,
} from './game'

const START_BALANCE = 1000
const N_HORSES = 7
const fmtMult = (x) => (x >= 10 ? Math.round(x) : +x.toFixed(1))

function jagged(tx, ty) {
  const segs = 5
  const pts = [`${tx.toFixed(1)},0`]
  for (let k = 1; k < segs; k++) { const yy = (ty * k) / segs; const xx = tx + (Math.random() * 7 - 3.5); pts.push(`${xx.toFixed(1)},${yy.toFixed(1)}`) }
  pts.push(`${tx.toFixed(1)},${ty.toFixed(1)}`)
  return pts.join(' ')
}

export default function SingleRace() {
  const [balance, setBalance] = useState(START_BALANCE)
  const [phase, setPhase] = useState('betting') // betting | racing | result
  const [modeKey, setModeKey] = useState('sayi')
  const [playMode, setPlayMode] = useState('auto')
  const [theme, setTheme] = useState('grass')
  const [muted, setMutedState] = useState(false)
  const [lineup, setLineup] = useState(() => pickLineup())

  const [bets, setBets] = useState([])
  const [pickHorse, setPickHorse] = useState(null)
  const [pickType, setPickType] = useState('kazanan')
  const [pickAmount, setPickAmount] = useState(50)

  const [positions, setPositions] = useState(Array(N_HORSES).fill(0))
  const [lastRolls, setLastRolls] = useState(Array(N_HORSES).fill(null))
  const [winner, setWinner] = useState(null)
  const [order, setOrder] = useState([])
  const [history, setHistory] = useState([])
  const [tick, setTick] = useState(0)
  const [rolling, setRolling] = useState(false)

  const [lightning, setLightning] = useState(null)
  const [lightM, setLightM] = useState(Array(N_HORSES).fill(0))
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

  // gösterilen baz oran = fair * BETA (şimşek payını karşılar)
  const baseWin = field.oddsWin.map((o) => o * LIGHTNING_BETA)
  const basePlase = field.oddsPlase.map((o) => o * LIGHTNING_BETA)
  const baseOf = (i, type) => (type === 'kazanan' ? baseWin[i] : basePlase[i])
  const fairOf = (i, type) => (type === 'kazanan' ? field.oddsWin[i] : field.oddsPlase[i])

  const totalStake = bets.reduce((s, b) => s + b.amount, 0)
  const mineIdxs = betting ? (pickHorse !== null ? [pickHorse] : []) : bets.map((b) => b.horse)
  const pickOdds = pickHorse === null ? null : baseOf(pickHorse, pickType)
  const pending = pickHorse !== null && pickAmount > 0 // fişe eklenmemiş, hazır seçim
  const effectiveTotal = totalStake + (pending ? pickAmount : 0)
  const canStart = (bets.length > 0 || pending) && effectiveTotal <= balance

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
      const st = lightning.strikes[fc]
      nm[st.horse] = fmtMult(st.gamma)
      const hp = Math.min(next[st.horse] / trackLen, 1)
      const tx = 8 + hp * 80, ty = ((st.horse + 0.5) / lineup.length) * 100
      last = { horse: st.horse, id: fc, mult: nm[st.horse], tx: +tx.toFixed(1), ty: +ty.toFixed(1), bolt: jagged(tx, ty) }
      fc++
    }
    if (last) { setLightM(nm); setFiredCount(fc); setStruck(last); sfx.zap?.() }
  }

  function settle(next) {
    if (!next.some((p) => p >= trackLen)) return
    const ord = next.map((p, i) => ({ p, i, r: Math.random() })).sort((a, b) => b.p - a.p || b.r - a.r).map((o) => o.i)
    const finalG = lightning ? lightning.finalG : Array(N_HORSES).fill(0)
    // bitişte tüm çarpanları kesinleştir (kat sayı gösterimi)
    setLightM(finalG.map((g) => (g > 0 ? fmtMult(g) : 0)))
    setOrder(ord); setWinner(ord[0]); setHistory((h) => [ord[0], ...h].slice(0, 10))

    const results = bets.map((b) => {
      const g = finalG[b.horse]
      const struckBet = g > 0
      const hit = b.type === 'kazanan' ? ord[0] === b.horse : ord.slice(0, PLACE_N).includes(b.horse)
      let win = 0, payMult = 0, boosted = false
      if (hit) {
        if (struckBet) { payMult = Math.min(LIGHTNING_CAP, b.baseOdds * g); boosted = true }
        else payMult = b.baseOdds
        win = b.amount * payMult
      }
      return { ...b, hit, win, payMult, boosted, factor: g }
    })
    setBetResults(results)
    const totalWin = results.reduce((s, r) => s + r.win, 0)
    if (totalWin > 0) { setBalance((bal) => bal + totalWin); sfx.win() } else sfx.lose()
    setTimeout(() => setPhase('result'), 850)
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

  function makeBet(i, type, amount) {
    return { horse: i, type, amount, baseOdds: baseOf(i, type), fairOdds: fairOf(i, type) }
  }
  function addBet() {
    if (pickHorse === null || pickAmount <= 0) return
    setBets((bs) => [...bs, makeBet(pickHorse, pickType, pickAmount)])
    setPickAmount(0) // eklendi; bekleyen seçim kalmasın
    sfx.bet()
  }
  function removeBet(i) { setBets((bs) => bs.filter((_, k) => k !== i)) }

  function startRace() {
    if (!canStart) return
    const finalBets = pending ? [...bets, makeBet(pickHorse, pickType, pickAmount)] : [...bets]
    if (finalBets.length === 0) return
    const total = finalBets.reduce((s, b) => s + b.amount, 0)
    if (total > balance) return
    sfx.start()
    setBets(finalBets)
    setBalance((b) => b - total)
    setLightning(genLightning(N_HORSES)); setLightM(Array(N_HORSES).fill(0)); setFiredCount(0); setStruck(null)
    setPositions(Array(N_HORSES).fill(0)); setLastRolls(Array(N_HORSES).fill(null))
    setWinner(null); setOrder([]); setTick(0); setRolling(false)
    setPhase('racing')
  }

  function newRound() {
    setLineup(pickLineup())
    setBets([]); setPickHorse(null); setPickAmount(50)
    setPositions(Array(N_HORSES).fill(0)); setLastRolls(Array(N_HORSES).fill(null))
    setWinner(null); setOrder([]); setBetResults([])
    setLightning(null); setLightM(Array(N_HORSES).fill(0)); setFiredCount(0); setStruck(null)
    setPhase('betting')
    if (balance <= 0) setBalance(START_BALANCE)
  }

  function toggleSound() { const m = !muted; setMutedState(m); sfx.setMuted(m); if (!m) sfx.unlock() }
  function addChip(c) { setPickAmount((a) => Math.min(a + c, balance)) }
  function setCustom(v) { setPickAmount(Math.max(0, Math.min(parseInt(v || '0', 10) || 0, balance))) }

  const max = Math.max(...positions)
  const leaderIdx = max === 0 ? null : positions.indexOf(max)
  const placeIdxs = phase === 'result' ? [order[1]] : []
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
            {phase === 'racing' && (<><span className="live-dot" /> {tick}. TUR · {mode.label.toUpperCase()}{topMult > 0 ? ` · EN YÜKSEK ⚡×${topMult}` : ''}</>)}
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
              <div className={`result-status ${netResult > 0 ? 'win' : netResult < 0 ? 'lose' : 'even'}`}>
                <span className="rs-big">{netResult > 0 ? 'KAZANDIN' : netResult < 0 ? 'KAYBETTİN' : 'BAŞA BAŞ'}</span>
                {netResult !== 0 && <span className="rs-amt">{netResult > 0 ? '+' : '−'}{fmt(Math.abs(netResult))} TL</span>}
              </div>

              <div className="result-eyebrow">FOTO FİNİŞ · KAZANAN</div>
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
                <>
                  <div className="res-label">BAHİSLERİN</div>
                  <div className="slip-results">
                    {betResults.map((r, i) => (
                      <div key={i} className={`sr-row ${r.hit ? 'ok' : 'no'} ${r.boosted ? 'boost' : ''}`}>
                        <span className="sr-mark">{r.hit ? '✓' : '✗'}</span>
                        <span className="sr-silk" style={{ background: lineup[r.horse].silk }}>{r.horse + 1}</span>
                        <span className="sr-name">{lineup[r.horse].name}</span>
                        <span className="sr-type">{BET_TYPES[r.type].label}{r.boosted ? <em className="boost-tag">⚡×{fmtMult(r.factor)}</em> : ''}</span>
                        <span className="sr-amt">{fmt(r.amount)}</span>
                        <span className="sr-win">{r.hit ? `+${fmt(r.win)}` : 'kaybetti'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {lightning && lightning.finalG.some((g) => g > 0) && (
                <div className="light-summary">
                  <span className="ls-title">⚡ ÇARPAN ALAN ATLAR</span>
                  <div className="ls-row">
                    {lineup.map((h, i) => {
                      const g = lightning.finalG[i]
                      return (
                        <span key={i} className={`ls-chip ${g > 0 ? (g < 1 ? 'lo' : 'hi') : 'off'}`}>
                          <i style={{ background: h.silk }}>{i + 1}</i>
                          {g > 0 ? `×${fmtMult(g)}` : '—'}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="result-totals">
                <div><span>YATIRDIN</span><b>{fmt(totalStake)}</b></div>
                <div><span>KAZANDIN</span><b className="tw">{fmt(totalWin)}</b></div>
                <div className="net-cell"><span>NET</span><b className={netResult >= 0 ? 'pos' : 'neg'}>{netResult >= 0 ? '+' : '−'}{fmt(Math.abs(netResult))}</b></div>
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
                    <span className="row-odds">{baseWin[i].toFixed(2)}<small>x</small></span>
                  ) : (
                    <span className="hsteps">{lightM[i] > 0 ? <b className="lit-mini">⚡×{lightM[i]}</b> : `${Math.min(positions[i], trackLen)}/${trackLen}`}</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="form-note">Gösterilen oran şimşeksiz kazançtır. Yarışta birkaç ata şimşek çarpıp çarpan (×) verir — bahsin tutarsa oranını bu kat sayıyla çarpar (bazen 3x, bazen 0.8x).</p>
        </div>

        <div className="card card-bet">
          <div className="card-title">BAHİS</div>
          {betting && (
            <>
              {pickHorse === null ? (
                <div className="bet-pick empty">⬑ Önce listeden bir at seç</div>
              ) : (
                <div className="bet-pick">
                  <span className="bp-tag">OYNADIĞIN AT</span>
                  <span className="silk" style={{ background: lineup[pickHorse].silk }}>{pickHorse + 1}</span>
                  <span className="bp-name">{lineup[pickHorse].name}</span>
                  <span className="bp-odds">{pickOdds.toFixed(2)}<small>x</small></span>
                </div>
              )}
              <div className="set-label">Bahis Türü</div>
              <div className="seg">
                {Object.values(BET_TYPES).map((t) => (
                  <button key={t.key} className={pickType === t.key ? 'active' : ''} onClick={() => setPickType(t.key)}>
                    <b>{t.label}</b>
                    <small>{pickHorse !== null ? `${baseOf(pickHorse, t.key).toFixed(2)}x` : t.hint}</small>
                  </button>
                ))}
              </div>
              <div className="chip-row">
                {CHIPS.map((c) => (<button key={c} className="chip" onClick={() => addChip(c)}>+{c}</button>))}
                <button className="chip chip-clear" disabled={pickAmount === 0} onClick={() => setPickAmount(0)}>SİL</button>
                <input className="stake-input" type="number" min="0" value={pickAmount || ''} onChange={(e) => setCustom(e.target.value)} placeholder="0" />
              </div>
              <button className="btn btn-add" disabled={pickHorse === null || pickAmount <= 0} onClick={addBet}>
                {pickHorse === null ? 'ÖNCE AT SEÇ' : pickAmount <= 0 ? 'MİKTAR GİR' : `+ FİŞE EKLE: ${lineup[pickHorse].name} ${BET_TYPES[pickType].label} ${fmt(pickAmount)}`}
              </button>

              <div className="set-label slip-label">BAHİS FİŞİ {bets.length > 0 && `(${bets.length})`}</div>
              {bets.length === 0 ? (
                <p className="slip-empty">Tek bahis için at + tür + miktar seçip aşağıdan <b>Oyna</b>’ya bas. Birden fazla ata oynamak istersen <b>Fişe Ekle</b> ile üst üste ekle.</p>
              ) : (
                <div className="slip">
                  {bets.map((b, i) => (
                    <div key={i} className="slip-row">
                      <span className="sr-silk" style={{ background: lineup[b.horse].silk }}>{b.horse + 1}</span>
                      <span className="sr-name">{lineup[b.horse].name}</span>
                      <span className="sr-type">{BET_TYPES[b.type].label}</span>
                      <span className="sr-amt">{fmt(b.amount)}</span>
                      <span className="sr-pot">→ {fmt(b.amount * b.baseOdds)}</span>
                      <button className="sr-x" onClick={() => removeBet(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="bet-summary">
                <div><span className="bs-label">TOPLAM BAHİS</span><span className="bs-value">{fmt(effectiveTotal)}</span></div>
                <div><span className="bs-label">KALAN BAKİYE</span><span className="bs-value">{fmt(balance - effectiveTotal)}</span></div>
              </div>
              <button className="btn btn-gold wide" disabled={!canStart} onClick={startRace}>
                {!pending && bets.length === 0
                  ? 'AT VE MİKTAR SEÇ'
                  : effectiveTotal > balance
                  ? 'BAKİYE YETMİYOR'
                  : bets.length === 0 && pending
                  ? `OYNA · ${lineup[pickHorse].name} ${BET_TYPES[pickType].label} ${fmt(pickAmount)}`
                  : `YARIŞI BAŞLAT · ${fmt(effectiveTotal)}`}
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
                <div><span className="bs-label">EN YÜKSEK ÇARPAN</span><span className="bs-value sm">{topMult > 0 ? `⚡×${topMult}` : '—'}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="fineprint">
        7 at · Kazanan (1.) ve Plase (ilk 2) · Yarışta birkaç ata şimşek çarpıp çarpan (×) verir; bahsin tutarsa oranını o kat sayıyla çarpar (bazen artırır, bazen 1'in altında) ·
        Teorik RTP %92.9 · Çarpan tavanı 1000x · Demo kredisi gerçek para değildir.
      </p>
    </div>
  )
}
