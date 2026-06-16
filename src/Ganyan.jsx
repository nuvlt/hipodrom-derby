import { useEffect, useMemo, useState } from 'react'
import * as sfx from './sound'
import {
  MODES, TICK_MS, rollFace, rankOrder, pickGanyanLineup, pickNames, DISTANCES,
  buildField, weightedPick, genBots, botNick, RaceTrack,
} from './game'

const LEGS = 6
const GAP_SEC = 5 // ayaklar arası bekleme (çok oyuncuda 30 sn olacak)
const DONKEY_BONUS = 150 // eşek at tutturma bonusu (puan)

/* ayağın ratingleri: genel + form durumu (form artık sonucu etkiler) */
function legRatings(leg) {
  return leg.lineup.map((h) => h.genel + (h.form.key === 'formda' ? 4 : h.form.key === 'yukselen' ? 2 : -3))
}

const ls = {
  get(k, d) { try { return localStorage.getItem(k) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* gizli mod */ } },
}

/* anonim cihaz kimliği + takma ad */
function loadIdentity() {
  let id = ls.get('hd_uid')
  if (!id) { id = 'u' + Math.random().toString(36).slice(2, 9); ls.set('hd_uid', id) }
  let nick = ls.get('hd_nick')
  if (!nick) { nick = botNick(Math.floor(Math.random() * 990)); ls.set('hd_nick', nick) }
  return { id, nick }
}

const today = () => new Date().toISOString().slice(0, 10)
const fmtN = (n) => n.toLocaleString('tr-TR')

/* bir kupon dizisinin puanı (bot ve oyuncu için ortak) */
function scorePicks(pk, results, fields) {
  let correct = 0, streak = 0, broken = false, donkey = 0
  for (let l = 0; l < results.length; l++) {
    if (pk[l] === results[l].winner) {
      correct++
      if (!broken) streak++
      if (pk[l] === fields[l].donkeyIdx) donkey++
    } else broken = true
  }
  const perfect = correct === LEGS && results.length === LEGS
  return correct * 100 + streak * 50 + donkey * DONKEY_BONUS + (perfect ? 1000 : 0)
}

function buildCoupon() {
  const names = pickNames(LEGS)
  return names.map((name, i) => ({ name, dist: DISTANCES[i % DISTANCES.length], lineup: pickGanyanLineup() }))
}

/* tek bir ayağı otomatik koşturur, bitince onFinish(sıralama) çağırır */
function RaceRunner({ lineup, mode, theme, mineIdx, weights, onFinish }) {
  const [positions, setPositions] = useState(Array(7).fill(0))
  const [lastRolls, setLastRolls] = useState(Array(7).fill(null))
  const [tick, setTick] = useState(0)
  const [order, setOrder] = useState(null)
  const trackLen = mode.track
  const done = order !== null

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => {
      const rolls = lineup.map((_, i) => weightedPick(mode.faces, weights[i]))
      const next = positions.map((p, i) => p + rolls[i])
      setLastRolls(rolls); setPositions(next); setTick((k) => k + 1)
      sfx.hoof()
      if (next.some((p) => p >= trackLen)) {
        const ord = rankOrder(next)
        setOrder(ord)
        setTimeout(() => onFinish(ord), 800)
      }
    }, TICK_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, done])

  const remaining = Math.max(0, trackLen - Math.max(...positions))
  const runPct = Math.round((Math.max(...positions) / trackLen) * 100)

  return (
    <>
      <RaceTrack
        theme={theme} lineup={lineup} positions={positions} trackLen={trackLen}
        modeKey={mode.key} lastRolls={lastRolls} tick={tick}
        mineIdx={mineIdx} winnerIdx={done ? order[0] : null} placeIdx={done ? order[1] : null} running={!done}
      />
      <div className="rem-bar">
        <span className="bs-label">KALAN MESAFE</span>
        <div className="rem-track"><div className="rem-fill" style={{ width: `${runPct}%` }} /></div>
        <b>{remaining} adım</b>
      </div>
    </>
  )
}

export default function Ganyan({ online = false }) {
  const [stage, setStage] = useState('coupon') // coupon | racing | result
  const [theme, setTheme] = useState('grass')
  const [muted, setMutedState] = useState(false)
  const [modeKey, setModeKey] = useState('sayi')
  const [coupon, setCoupon] = useState(() => buildCoupon())
  const [revealed, setRevealed] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [picks, setPicks] = useState(Array(LEGS).fill(null))
  const [activeLeg, setActiveLeg] = useState(0)
  const [legIndex, setLegIndex] = useState(0)
  const [between, setBetween] = useState(false)
  const [gap, setGap] = useState(GAP_SEC)
  const [results, setResults] = useState([]) // her ayak: { winner, correct }
  const [best, setBest] = useState(0)
  const [identity, setIdentity] = useState(loadIdentity)
  const [playerCount, setPlayerCount] = useState(() => 400 + Math.floor(Math.random() * 1600))

  const mode = MODES[modeKey]
  const allPicked = picks.every((p) => p !== null)

  // her ayağın oranları: genel + form -> Monte Carlo (mod değişince yeniden hesaplanır)
  const fields = useMemo(() => coupon.map((leg) => buildField(legRatings(leg), MODES[modeKey])), [coupon, modeKey])

  // simüle rakipler (online): oranlara göre ağırlıklı kuponlar
  const bots = useMemo(() => (online ? genBots(fields, playerCount) : null), [online, fields, playerCount])

  // canlı: kaç bot hâlâ ayakta (tüm tahminleri tutmuş)
  const botsAlive = useMemo(() => {
    if (!bots || results.length === 0) return playerCount
    return bots.picks.reduce((acc, pk) => acc + (results.every((r, l) => pk[l] === r.winner) ? 1 : 0), 0)
  }, [bots, results, playerCount])

  /* ayaklar arası geri sayım */
  useEffect(() => {
    if (stage !== 'racing' || !between) return
    if (gap <= 0) {
      if (legIndex + 1 < LEGS) { setLegIndex((i) => i + 1); setBetween(false); setGap(GAP_SEC) }
      else finishStage()
      return
    }
    const t = setTimeout(() => { sfx.tick(); setGap((g) => g - 1) }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, between, gap])

  function spinWheel() {
    if (spinning || revealed) return
    sfx.start()
    setSpinning(true)
    setTimeout(() => { setSpinning(false); setRevealed(true) }, 1700)
  }

  function pick(leg, idx) {
    if (stage !== 'coupon' || !revealed) return
    sfx.tick()
    setPicks((p) => { const n = [...p]; n[leg] = idx; return n })
    if (leg < LEGS - 1) setTimeout(() => setActiveLeg(leg + 1), 260)
  }

  function playCoupon() {
    if (!allPicked) return
    sfx.start()
    setResults([]); setLegIndex(0); setBetween(false); setGap(GAP_SEC); setStage('racing')
  }

  function onLegFinish(order) {
    const correct = order[0] === picks[legIndex]
    const donkey = correct && picks[legIndex] === fields[legIndex].donkeyIdx
    if (correct) sfx.win(); else sfx.lose()
    setResults((r) => [...r, { winner: order[0], correct, donkey }])
    setBetween(true)
    setGap(GAP_SEC)
  }

  function finishStage() {
    setStage('result')
  }

  function newStage() {
    setCoupon(buildCoupon())
    setRevealed(false); setSpinning(false)
    setPicks(Array(LEGS).fill(null))
    setActiveLeg(0)
    setLegIndex(0); setBetween(false); setGap(GAP_SEC); setResults([])
    setPlayerCount(400 + Math.floor(Math.random() * 1600))
    setStage('coupon')
  }

  function toggleSound() {
    const m = !muted
    setMutedState(m); sfx.setMuted(m); if (!m) sfx.unlock()
  }

  /* skorlama */
  const correctCount = results.filter((r) => r.correct).length
  const donkeyHits = results.filter((r) => r.donkey).length
  let aliveStreak = 0
  for (const r of results) { if (r.correct) aliveStreak++; else break }
  const perfect = correctCount === LEGS && results.length === LEGS
  const points = correctCount * 100 + aliveStreak * 50 + donkeyHits * DONKEY_BONUS + (perfect ? 1000 : 0)

  // online liderlik tablosu (sonuç ekranında)
  const leaderboard = useMemo(() => {
    if (!online || !bots || stage !== 'result') return null
    const rows = bots.picks.map((pk, i) => ({ nick: botNick(i), pts: scorePicks(pk, results, fields), me: false }))
    rows.push({ nick: identity.nick, pts: points, me: true })
    rows.sort((a, b) => b.pts - a.pts)
    const rank = rows.findIndex((r) => r.me) + 1
    return { top: rows.slice(0, 10), rank, total: rows.length, pct: Math.max(1, Math.round((rank / rows.length) * 100)) }
  }, [online, bots, stage, results, fields, points, identity.nick])

  const [dailyBest, setDailyBest] = useState(0)
  useEffect(() => {
    if (stage !== 'result') return
    const key = 'hd_best_' + today()
    const prev = parseInt(ls.get(key, '0'), 10) || 0
    const nb = Math.max(prev, points)
    if (nb !== prev) ls.set(key, String(nb))
    setDailyBest(nb)
    if (points > best) setBest(points)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  function changeNick() {
    const n = window.prompt('Takma adın:', identity.nick)
    if (n && n.trim()) { const v = n.trim().slice(0, 16); ls.set('hd_nick', v); setIdentity((m) => ({ ...m, nick: v })) }
  }

  /* anlık "kaç ayaktır devam" (sıralı doğru) */
  let liveStreak = 0
  for (const r of results) { if (r.correct) liveStreak++; else break }
  const stillAlive = results.every((r) => r.correct)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-flag" />
          <h1>HİPODROM <em>DERBY</em></h1>
          <span className="demo-badge gan">{online ? 'ONLINE · PROTOTİP' : "6'LI GANYAN"}</span>
        </div>
        <div className="head-right">
          {online && (
            <button className="id-chip" onClick={changeNick} title="Takma adını değiştir">
              <span className="id-dot" />{identity.nick}<span className="id-edit">✎</span>
            </button>
          )}
          <button className={`icon-btn ${muted ? 'muted' : ''}`} onClick={toggleSound} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}>
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
      </header>

      {/* ---------------- KUPON KURMA ---------------- */}
      {stage === 'coupon' && (
        <>
          <div className="gan-bar">
            <div className="gan-bar-left">
              <div className="form-wheel-wrap">
                <div className={`form-wheel ${spinning ? 'spin' : ''}`} />
                <div className="form-wheel-pin" />
              </div>
              <div>
                <div className="gan-bar-title">{revealed ? 'FORMLAR BELİRLENDİ' : 'FORM ÇARKI'}</div>
                <div className="gan-bar-sub">{online ? `👥 ${fmtN(playerCount)} oyuncu bu etapta` : revealed ? 'Her ayaktan bir at seç' : 'Atların formunu çark belirler'}</div>
              </div>
            </div>
            <div className="gan-bar-right">
              <div className="seg modes gan-mode">
                {Object.values(MODES).map((m) => (
                  <button key={m.key} className={modeKey === m.key ? 'active' : ''} onClick={() => setModeKey(m.key)}><b>{m.label}</b></button>
                ))}
              </div>
              {!revealed ? (
                <button className="btn btn-gold" onClick={spinWheel} disabled={spinning}>{spinning ? 'ÇEVRİLİYOR…' : 'ÇARKI ÇEVİR'}</button>
              ) : (
                <button className="btn btn-gold" disabled={!allPicked} onClick={playCoupon}>{allPicked ? 'KUPONU OYNAT' : `${picks.filter((p) => p !== null).length}/6 SEÇİLDİ`}</button>
              )}
            </div>
          </div>

          <div className="leg-tabs" role="tablist">
            {coupon.map((leg, li) => (
              <button
                key={li}
                role="tab"
                aria-selected={activeLeg === li}
                className={`leg-tab ${activeLeg === li ? 'active' : ''} ${picks[li] !== null ? 'done' : ''}`}
                onClick={() => setActiveLeg(li)}
              >
                <span className="lt-label">AYAK {li + 1}</span>
                <span className="lt-mark">{picks[li] !== null ? '✓' : '·'}</span>
              </button>
            ))}
          </div>

          {(() => {
            const li = activeLeg
            const leg = coupon[li]
            return (
              <div className={`leg-card solo ${picks[li] !== null ? 'picked' : ''}`}>
                <div className="leg-head">
                  <span className="leg-no">AYAK {li + 1}/{LEGS}</span>
                  <span className="leg-name">{leg.name}</span>
                  <span className="leg-dist">{leg.dist}</span>
                </div>
                <div className="gan-horses">
                  {leg.lineup.map((h, hi) => (
                    <button key={hi} className={`gan-horse ${picks[li] === hi ? 'sel' : ''}`} disabled={!revealed} onClick={() => pick(li, hi)}>
                      <span className="silk" style={{ background: h.silk }}>{hi + 1}</span>
                      <span className="gh-main">
                        <span className="gh-top">
                          <span className="hname">{h.name}</span>
                          {revealed && <span className="form-badge" style={{ '--fc': h.form.color }}>{h.form.label}</span>}
                        </span>
                        <span className="gh-stats">HIZ {h.hiz} · GÜÇ {h.guc} · {h.kilo}KG · GENEL {h.genel}</span>
                        {online && revealed && bots && (() => {
                          const c = bots.counts[li][hi]; const pct = (c / playerCount) * 100
                          return <span className="gh-share">👥 %{pct >= 1 ? Math.round(pct) : c > 0 ? '<1' : '0'} oyuncu seçti</span>
                        })()}
                      </span>
                      {revealed && (
                        <span className="gh-odds">
                          <b>{fields[li].oddsWin[hi].toFixed(2)}<small>x</small></b>
                          {fields[li].donkeyIdx === hi && <em className="donkey-tag">EŞEK</em>}
                        </span>
                      )}
                      {picks[li] === hi && <span className="gh-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
          <p className="fineprint">İstatistikler ve form atın kazanma şansını (oranını) belirler · Eşek at: en düşük şanslı at — tutturursan +{DONKEY_BONUS} bonus puan · Demo.</p>
        </>
      )}

      {/* ---------------- YARIŞ ---------------- */}
      {stage === 'racing' && (
        <>
          <section className="track-panel">
            <div className="track-head">
              <div className="track-title">
                {between ? <>SONRAKİ AYAK — {gap} SN</> : <><span className="live-dot" /> AYAK {legIndex + 1}/{LEGS} · {coupon[legIndex].name.toUpperCase()}</>}
              </div>
              <div className="head-right">
                {online && <span className="alive-pill players">👥 {fmtN(botsAlive)} ayakta</span>}
                <span className={`alive-pill ${results.length > 0 && !stillAlive ? 'dead' : ''}`}>
                  {results.length === 0 ? 'KUPON CANLI' : stillAlive ? `${liveStreak} AYAKTIR DEVAM` : `${correctCount}/${results.length} DOĞRU`}
                </span>
              </div>
            </div>

            {!between ? (
              <RaceRunner key={legIndex} lineup={coupon[legIndex].lineup} mode={mode} theme={theme} mineIdx={picks[legIndex]} weights={fields[legIndex].weights} onFinish={onLegFinish} />
            ) : (
              <div className="gap-screen">
                <div className="cd-ring"><span>{gap}</span></div>
                <div className="gap-info">
                  <div className="gap-title">{results[results.length - 1].correct ? 'TUTTU!' : 'BU AYAĞI KAÇIRDIN'}</div>
                  <div className="gap-sub">Kazanan: {coupon[legIndex].lineup[results[results.length - 1].winner].name}</div>
                  {online && bots && (() => {
                    const before = results.length <= 1
                      ? playerCount
                      : bots.picks.reduce((a, pk) => a + (results.slice(0, -1).every((r, l) => pk[l] === r.winner) ? 1 : 0), 0)
                    const elimPct = before > 0 ? Math.round(((before - botsAlive) / before) * 100) : 0
                    return <div className="gap-elim">Bu ayakta <b>%{elimPct}</b> oyuncu elendi · {fmtN(botsAlive)} kişi devam ediyor</div>
                  })()}
                </div>
                <button className="btn btn-gold" onClick={() => setGap(0)}>SONRAKİ AYAK</button>
              </div>
            )}
          </section>

          {/* kupon takip şeridi */}
          <div className="coupon-strip">
            {coupon.map((leg, li) => {
              const res = results[li]
              const state = res ? (res.correct ? 'ok' : 'fail') : li === legIndex && !between ? 'live' : 'wait'
              const myPick = coupon[li].lineup[picks[li]]
              return (
                <div key={li} className={`coupon-leg ${state}`}>
                  <span className="cl-no">A{li + 1}</span>
                  <span className="cl-silk" style={{ background: myPick.silk }}>{picks[li] + 1}</span>
                  <span className="cl-name">{myPick.name}</span>
                  <span className="cl-state">{state === 'ok' ? '✓' : state === 'fail' ? '✕' : state === 'live' ? '●' : '·'}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ---------------- SONUÇ ---------------- */}
      {stage === 'result' && (
        <section className="track-panel gan-result-panel">
          <div className={`gan-result ${perfect ? 'perfect' : correctCount > 0 ? 'win' : 'lose'}`}>
            <div className="result-eyebrow">ETAP SONUCU</div>
            <div className="gan-score">{correctCount}<span>/6 DOĞRU</span></div>
            <div className="gan-points">+{points} PUAN {perfect && <em>· TAM KUPON BONUSU!</em>}</div>
            {donkeyHits > 0 && <div className="gan-donkey">🫏 {donkeyHits} EŞEK AT TUTTURULDU · +{donkeyHits * DONKEY_BONUS} BONUS</div>}
            {online && leaderboard ? (
              <div className="gan-rank">Sıralaman <b>{fmtN(leaderboard.rank)}</b> / {fmtN(leaderboard.total)} · üst <b>%{leaderboard.pct}</b></div>
            ) : null}
            <div className="gan-best">{online ? `Bugünkü en iyin: ${fmtN(dailyBest)} puan` : `En iyi skorun: ${Math.max(best, points)} puan`}</div>

            {online && leaderboard && (
              <div className="leaderboard">
                <div className="lb-title">LİDERLİK TABLOSU · ETAP</div>
                {leaderboard.top.map((row, i) => (
                  <div key={i} className={`lb-row ${row.me ? 'me' : ''}`}>
                    <span className="lb-rank">{i + 1}</span>
                    <span className="lb-nick">{row.nick}{row.me && <em>SEN</em>}</span>
                    <span className="lb-pts">{fmtN(row.pts)}</span>
                  </div>
                ))}
                {leaderboard.rank > 10 && (
                  <div className="lb-row me lb-sep">
                    <span className="lb-rank">{fmtN(leaderboard.rank)}</span>
                    <span className="lb-nick">{identity.nick}<em>SEN</em></span>
                    <span className="lb-pts">{fmtN(points)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="recap">
              {coupon.map((leg, li) => {
                const res = results[li]
                const myPick = leg.lineup[picks[li]]
                const winHorse = res ? leg.lineup[res.winner] : null
                return (
                  <div key={li} className={`recap-row ${res?.correct ? 'ok' : 'fail'}`}>
                    <span className="rr-leg">A{li + 1}</span>
                    <span className="rr-name">{leg.name}</span>
                    <span className="rr-pick"><i className="silk" style={{ background: myPick.silk }}>{picks[li] + 1}</i>{myPick.name}{res?.donkey && <em className="rr-donkey">EŞEK</em>}</span>
                    <span className="rr-arrow">→</span>
                    <span className="rr-win">{winHorse ? winHorse.name : '—'}</span>
                    <span className="rr-mark">{res?.correct ? '✓' : '✕'}</span>
                  </div>
                )
              })}
            </div>

            <button className="btn btn-gold" onClick={newStage}>YENİ ETAP</button>
          </div>
        </section>
      )}
    </div>
  )
}
