import { useEffect, useMemo, useState } from 'react'
import * as sfx from './sound'
import {
  MODES, TICK_MS, rankOrder, pickGanyanLineup, pickNames, DISTANCES,
  buildField, weightedPick, raceOnce, genBots, botNick, RaceTrack,
} from './game'

const LEGS = 6
const GAP_SEC = 7            // ayaklar arası karar penceresi (çok oyuncuda 30 sn olacak)
const START_BAL = 1000       // demo bakiye (TL)
const CHIPS = [10, 25, 50, 100, 250]
const MODE = MODES.sayi      // ganyan arkada hep Sayılı Zar ile koşar

function buildCoupon() {
  const names = pickNames(LEGS)
  return names.map((name, i) => ({ name, dist: DISTANCES[i % DISTANCES.length], lineup: pickGanyanLineup() }))
}

function legRatings(leg, theme) {
  return leg.lineup.map((h) => {
    const form = h.form.key === 'formda' ? 4 : h.form.key === 'yukselen' ? 2 : -3
    const surf = ((theme === 'grass' ? h.fg : h.fs) - 82) * 0.7 // zemin (çim/kum formu) oranı etkiler
    return h.genel + form + surf
  })
}

const STREAK_STEP = 5      // her 5 doğru ayakta bir bonus
const STREAK_BONUS = 50    // sadık oyuncu bonusu (TL)

const BADGES = [
  { id: 'first', icon: '🎟️', label: 'İlk Adım', desc: 'İlk etabını oyna' },
  { id: 'cashout', icon: '💰', label: 'Bozdurucu', desc: 'İlk kez bozdur' },
  { id: 'mult10', icon: '🚀', label: 'Yüksek Uçuş', desc: '10x+ çarpanda kazan' },
  { id: 'perfect', icon: '🏆', label: 'Tam Kupon', desc: '6/6 tuttur' },
  { id: 'donkey', icon: '🫏', label: 'Eşek Avcısı', desc: 'Kazanan eşek atı tuttur' },
  { id: 'streak10', icon: '🔥', label: 'Seri Ustası', desc: '10 ayaklık seri yakala' },
  { id: 'bigwin', icon: '💎', label: 'Büyük Vurgun', desc: 'Tek seferde 1000+ TL kazan' },
  { id: 'highroller', icon: '🎰', label: 'Cesur Yürek', desc: '250+ TL bahis yatır' },
]

function earnedThisStage(ctx) {
  const e = ['first']
  if (ctx.settled === 'cashed') e.push('cashout')
  if ((ctx.settled === 'cashed' || ctx.settled === 'won') && ctx.multiplier >= 10) e.push('mult10')
  if (ctx.settled === 'won') e.push('perfect')
  if (ctx.donkeyHit) e.push('donkey')
  if (ctx.newStreak >= 10) e.push('streak10')
  if (ctx.payout >= 1000) e.push('bigwin')
  if (ctx.placedStake >= 250) e.push('highroller')
  return e
}

const ls = {
  get(k, d) { try { return localStorage.getItem(k) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* gizli mod */ } },
}

function loadIdentity() {
  let id = ls.get('hd_uid')
  if (!id) { id = 'u' + Math.random().toString(36).slice(2, 9); ls.set('hd_uid', id) }
  let nick = ls.get('hd_nick')
  if (!nick) { nick = botNick(Math.floor(Math.random() * 990)); ls.set('hd_nick', nick) }
  return { id, nick }
}

const today = () => new Date().toISOString().slice(0, 10)
const fmtN = (n) => Math.round(n).toLocaleString('tr-TR')

/* bir botun etap sonucu: hedef ayağa kadar tutarsa bozdurur, yoksa yanar */
function botOutcome(pk, stake, target, results, fields) {
  let hits = 0
  for (let l = 0; l < results.length; l++) { if (pk[l] === results[l].winner) hits++; else break }
  if (hits >= target) {
    let m = 1
    for (let l = 0; l < target; l++) m *= fields[l].oddsWin[pk[l]]
    const win = stake * m
    return { net: win - stake, win, mult: m, cashed: true }
  }
  return { net: -stake, win: 0, mult: 0, cashed: false }
}

/* o ayakta bozduran / elenen botlardan canlı akış için örnek olaylar */
function genLegFeed(bots, fields, results, L) {
  const cashed = [], busted = []
  const { picks, stakes, targets } = bots
  for (let b = 0; b < picks.length; b++) {
    const pk = picks[b]
    let okBefore = true
    for (let l = 0; l < L; l++) { if (pk[l] !== results[l].winner) { okBefore = false; break } }
    if (!okBefore) continue
    const hitL = pk[L] === results[L].winner
    if (hitL && targets[b] === L + 1) {
      let m = 1; for (let l = 0; l <= L; l++) m *= fields[l].oddsWin[pk[l]]
      cashed.push({ nick: botNick(b), mult: m, win: stakes[b] * m })
    } else if (!hitL && targets[b] > L) {
      busted.push(botNick(b))
    }
  }
  const take = (arr, k) => { const c = [...arr], out = []; for (let i = 0; i < k && c.length; i++) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return out }
  const ev = []
  take(cashed, 2).forEach((c) => ev.push({ type: 'cash', nick: c.nick, text: `${c.mult.toFixed(2)}x'te bozdurdu · +${fmtN(c.win)} TL` }))
  take(busted, 2).forEach((n) => ev.push({ type: 'bust', nick: n, text: 'elendi' }))
  return ev
}

/* tek bir ayağı otomatik koşturur, bitince onFinish(sıralama) çağırır */
function RaceRunner({ lineup, theme, mineIdx, weights, onFinish }) {
  const [positions, setPositions] = useState(Array(7).fill(0))
  const [lastRolls, setLastRolls] = useState(Array(7).fill(null))
  const [tick, setTick] = useState(0)
  const [order, setOrder] = useState(null)
  const trackLen = MODE.track
  const done = order !== null

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => {
      const rolls = lineup.map((_, i) => weightedPick(MODE.faces, weights[i]))
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
        modeKey={MODE.key} lastRolls={lastRolls} tick={tick}
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
  const [coupon, setCoupon] = useState(() => buildCoupon())
  const [picks, setPicks] = useState(Array(LEGS).fill(null))
  const [activeLeg, setActiveLeg] = useState(0)
  const [legIndex, setLegIndex] = useState(0)
  const [between, setBetween] = useState(false)
  const [gap, setGap] = useState(GAP_SEC)
  const [results, setResults] = useState([])
  const [identity, setIdentity] = useState(loadIdentity)
  const [playerCount, setPlayerCount] = useState(() => 400 + Math.floor(Math.random() * 1600))
  const [feed, setFeed] = useState([])

  // bahis
  const [balance, setBalance] = useState(START_BAL)
  const [stake, setStake] = useState(50)
  const [placedStake, setPlacedStake] = useState(0)
  const [multiplier, setMultiplier] = useState(1)
  const [settled, setSettled] = useState('riding') // riding | cashed | busted | won
  const [payout, setPayout] = useState(0)
  const [bestWin, setBestWin] = useState(0)
  const [cashLeg, setCashLeg] = useState(0)
  const [badges, setBadges] = useState(() => new Set(JSON.parse(ls.get('hd_badges', '[]'))))
  const [streak, setStreak] = useState(() => parseInt(ls.get('hd_streak', '0'), 10) || 0)
  const [showBadges, setShowBadges] = useState(false)
  const [reward, setReward] = useState(null)

  const fields = useMemo(() => coupon.map((leg) => buildField(legRatings(leg, theme), MODE)), [coupon, theme])
  const bots = useMemo(() => (online ? genBots(fields, playerCount) : null), [online, fields, playerCount])

  const allPicked = picks.every((p) => p !== null)
  const potential = allPicked ? picks.reduce((m, p, l) => m * fields[l].oddsWin[p], 1) : 0

  const botsAlive = useMemo(() => {
    if (!bots || results.length === 0) return playerCount
    return bots.picks.reduce((acc, pk) => acc + (results.every((r, l) => pk[l] === r.winner) ? 1 : 0), 0)
  }, [bots, results, playerCount])

  /* ayaklar arası geri sayım — oyuncu sürüyorsa otomatik geçmez, karar bekler */
  useEffect(() => {
    if (stage !== 'racing' || !between) return
    if (gap <= 0) { advance(); return }
    const t = setTimeout(() => { sfx.tick(); setGap((g) => g - 1) }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, between, gap])

  function advance() {
    if (legIndex + 1 < LEGS) { setLegIndex((i) => i + 1); setBetween(false); setGap(GAP_SEC) }
    else setStage('result')
  }

  function pick(leg, idx) {
    if (stage !== 'coupon') return
    sfx.tick()
    setPicks((p) => { const n = [...p]; n[leg] = idx; return n })
    if (leg < LEGS - 1) setTimeout(() => setActiveLeg(leg + 1), 260)
  }

  const canPlay = allPicked && stake > 0 && stake <= balance

  function playCoupon() {
    if (!canPlay) return
    sfx.start()
    setBalance((b) => b - stake)
    setPlacedStake(stake); setMultiplier(1); setSettled('riding'); setPayout(0)
    setResults([]); setFeed([]); setLegIndex(0); setBetween(false); setGap(GAP_SEC)
    setStage('racing')
  }

  function bumpBestWin(win) {
    const key = 'hd_bestwin_' + today()
    const prev = parseInt(ls.get(key, '0'), 10) || 0
    const nb = Math.max(prev, Math.round(win))
    if (nb !== prev) ls.set(key, String(nb))
    setBestWin((x) => Math.max(x, nb))
  }

  function onLegFinish(order) {
    const correct = order[0] === picks[legIndex]
    const newResults = [...results, { winner: order[0], correct }]
    setResults(newResults)

    if (settled === 'riding') {
      if (!correct) {
        setSettled('busted'); sfx.lose()
      } else {
        let m = 1
        for (let l = 0; l <= legIndex; l++) { if (newResults[l].correct) m *= fields[l].oddsWin[picks[l]]; else break }
        setMultiplier(m); sfx.win()
        if (legIndex === LEGS - 1) {
          const win = placedStake * m
          setSettled('won'); setPayout(win); setBalance((b) => b + win); bumpBestWin(win)
        }
      }
    }

    if (online && bots) setFeed((f) => [...genLegFeed(bots, fields, newResults, legIndex), ...f].slice(0, 8))
    setBetween(true); setGap(GAP_SEC)
  }

  function cashOut() {
    if (settled !== 'riding') return
    const win = placedStake * multiplier
    setSettled('cashed'); setPayout(win); setBalance((b) => b + win); setCashLeg(results.length); bumpBestWin(win)
    sfx.win()
  }

  function skipToEnd() {
    const r = [...results]
    for (let l = r.length; l < LEGS; l++) {
      const ord = raceOnce(fields[l].weights, MODE)
      r.push({ winner: ord[0], correct: picks[l] === ord[0] })
    }
    setResults(r); setStage('result')
  }

  function newStage() {
    setCoupon(buildCoupon())
    setPicks(Array(LEGS).fill(null)); setActiveLeg(0)
    setLegIndex(0); setBetween(false); setGap(GAP_SEC); setResults([]); setFeed([])
    setPlayerCount(400 + Math.floor(Math.random() * 1600))
    setMultiplier(1); setSettled('riding'); setPayout(0)
    setStage('coupon')
  }

  function toggleSound() {
    const m = !muted; setMutedState(m); sfx.setMuted(m); if (!m) sfx.unlock()
  }

  function changeNick() {
    const n = window.prompt('Takma adın:', identity.nick)
    if (n && n.trim()) { const v = n.trim().slice(0, 16); ls.set('hd_nick', v); setIdentity((m) => ({ ...m, nick: v })) }
  }

  function addChip(c) { setStake((s) => Math.min(s + c, balance)) }
  function setCustom(v) { const n = Math.max(0, Math.min(parseInt(v || '0', 10) || 0, balance)); setStake(n) }

  // skor / sıralama
  const myNet = settled === 'busted' ? -placedStake : payout - placedStake
  const leaderboard = useMemo(() => {
    if (!online || !bots || stage !== 'result') return null
    const rows = bots.picks.map((pk, i) => ({ nick: botNick(i), net: botOutcome(pk, bots.stakes[i], bots.targets[i], results, fields).net, me: false }))
    rows.push({ nick: identity.nick, net: myNet, me: true })
    rows.sort((a, b) => b.net - a.net)
    const rank = rows.findIndex((r) => r.me) + 1
    return { top: rows.slice(0, 10), rank, total: rows.length, pct: Math.max(1, Math.round((rank / rows.length) * 100)) }
  }, [online, bots, stage, results, fields, myNet, identity.nick])

  const correctCount = results.filter((r) => r.correct).length
  const liveStreak = (() => { let s = 0; for (const r of results) { if (r.correct) s++; else break } return s })()
  const stillAlive = settled === 'riding'

  // etap sonu: seri güncelle + bonus + rozet değerlendir
  useEffect(() => {
    if (stage !== 'result') return
    const legsHit = settled === 'won' ? LEGS : settled === 'cashed' ? cashLeg : liveStreak
    const prev = parseInt(ls.get('hd_streak', '0'), 10) || 0
    let newStreak = 0, bonus = 0
    if (settled !== 'busted') {
      newStreak = prev + legsHit
      const milestones = Math.floor(newStreak / STREAK_STEP) - Math.floor(prev / STREAK_STEP)
      if (milestones > 0) { bonus = milestones * STREAK_BONUS; setBalance((b) => b + bonus) }
    }
    ls.set('hd_streak', String(newStreak)); setStreak(newStreak)

    let donkeyHit = false
    for (let l = 0; l < legsHit; l++) { if (picks[l] === fields[l].donkeyIdx) { donkeyHit = true; break } }

    const earned = earnedThisStage({ settled, multiplier, payout, placedStake, newStreak, donkeyHit })
    const owned = new Set(JSON.parse(ls.get('hd_badges', '[]')))
    const fresh = earned.filter((id) => !owned.has(id))
    fresh.forEach((id) => owned.add(id))
    ls.set('hd_badges', JSON.stringify([...owned])); setBadges(owned)
    setReward({ streak: newStreak, bonus, newBadges: fresh })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

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
          {streak > 0 && <span className="streak-chip" title="Doğru ayak serisi">🔥 {streak}</span>}
          <button className="icon-btn badge-btn" onClick={() => setShowBadges(true)} title="Rozetler" aria-label="Rozetler">🏅</button>
          <div className="bal-chip"><span className="bal-lbl">BAKİYE</span><b>{fmtN(balance)} TL</b></div>
          <button className={`icon-btn ${muted ? 'muted' : ''}`} onClick={toggleSound} aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}>
            {muted ? (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor" /><path d="M15.5 8.5a5 5 0 010 7M18 6a8 8 0 010 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            )}
          </button>
          <div className="theme-toggle" role="group" aria-label="Pist zemini">
            <button className={theme === 'grass' ? 'active' : ''} disabled={stage !== 'coupon'} onClick={() => setTheme('grass')}>Çim</button>
            <button className={theme === 'sand' ? 'active' : ''} disabled={stage !== 'coupon'} onClick={() => setTheme('sand')}>Kum</button>
          </div>
        </div>
      </header>

      {showBadges && (
        <div className="modal-back" onClick={() => setShowBadges(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><span>ROZETLER · {badges.size}/{BADGES.length}</span><button className="modal-x" onClick={() => setShowBadges(false)}>✕</button></div>
            <div className="badge-grid">
              {BADGES.map((b) => (
                <div key={b.id} className={`badge ${badges.has(b.id) ? 'on' : ''}`}>
                  <span className="badge-ic">{b.icon}</span>
                  <span className="badge-lb">{b.label}</span>
                  <span className="badge-ds">{b.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- KUPON KURMA ---------------- */}
      {stage === 'coupon' && (
        <>
          <div className="gan-bar">
            <div className="gan-bar-left">
              <div>
                <div className="gan-bar-title">KUPONUNU KUR</div>
                <div className="gan-bar-sub">{online ? `👥 ${fmtN(playerCount)} oyuncu bu etapta` : 'Her ayaktan bir at seç'}</div>
              </div>
            </div>
            <div className="gan-bar-right">
              <button className="btn btn-gold" disabled={!canPlay} onClick={playCoupon}>
                {!allPicked ? `${picks.filter((p) => p !== null).length}/6 SEÇ` : stake <= 0 ? 'BAHİS GİR' : stake > balance ? 'BAKİYE YETMİYOR' : `OYNA · ${fmtN(stake)} TL`}
              </button>
            </div>
          </div>

          <div className="bet-bar">
            <div className="bet-stake">
              <span className="bs-label">BAHİS (TL)</span>
              <div className="stake-row">
                {CHIPS.map((c) => (<button key={c} className="chip" onClick={() => addChip(c)}>+{c}</button>))}
                <button className="chip chip-clear" disabled={stake === 0} onClick={() => setStake(0)}>SİL</button>
                <input className="stake-input" type="number" min="0" value={stake || ''} onChange={(e) => setCustom(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="bet-pot">
              <span className="bs-label">TÜM AYAKLAR TUTARSA</span>
              <span className="bs-value gold">{allPicked && stake > 0 ? `${fmtN(stake * potential)} TL` : '—'}</span>
              {allPicked && <span className="pot-mult">{potential.toFixed(2)}x</span>}
            </div>
          </div>

          <div className="leg-tabs" role="tablist">
            {coupon.map((leg, li) => (
              <button key={li} role="tab" aria-selected={activeLeg === li} className={`leg-tab ${activeLeg === li ? 'active' : ''} ${picks[li] !== null ? 'done' : ''}`} onClick={() => setActiveLeg(li)}>
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
                    <button key={hi} className={`gan-horse ${picks[li] === hi ? 'sel' : ''}`} onClick={() => pick(li, hi)}>
                      <span className="silk" style={{ background: h.silk }}>{hi + 1}</span>
                      <span className="gh-main">
                        <span className="gh-top">
                          <span className="hname">{h.name}</span>
                          <span className="form-badge" style={{ '--fc': h.form.color }}>{h.form.label}</span>
                        </span>
                        <span className="gh-stats">HIZ {h.hiz} · GÜÇ {h.guc} · {h.kilo}KG · GENEL {h.genel}</span>
                        <span className="gh-surface"><b className={theme === 'grass' ? 'on' : ''}>ÇİM {h.fg}</b><b className={theme === 'sand' ? 'on' : ''}>KUM {h.fs}</b></span>
                        {online && bots && (() => {
                          const c = bots.counts[li][hi]; const pct = (c / playerCount) * 100
                          return <span className="gh-share">👥 %{pct >= 1 ? Math.round(pct) : c > 0 ? '<1' : '0'} oyuncu seçti</span>
                        })()}
                      </span>
                      <span className="gh-odds">
                        <b>{fields[li].oddsWin[hi].toFixed(2)}<small>x</small></b>
                        {fields[li].donkeyIdx === hi && <em className="donkey-tag">EŞEK</em>}
                      </span>
                      {picks[li] === hi && <span className="gh-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
          <p className="fineprint">İstatistik ve form atın oranını belirler · Çarpan tutan ayakların oranlarıyla büyür, ayaklar arası bozdurabilirsin · Teorik RTP %92.9 · Demo bakiye gerçek para değildir.</p>
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
                <span className={`mult-pill ${settled === 'busted' ? 'dead' : ''}`}>
                  {settled === 'busted' ? 'YANDI' : settled === 'cashed' ? `BOZDURULDU · ${fmtN(payout)} TL` : `${multiplier.toFixed(2)}x · ${fmtN(placedStake * multiplier)} TL`}
                </span>
              </div>
            </div>

            {!between ? (
              <RaceRunner key={legIndex} lineup={coupon[legIndex].lineup} theme={theme} mineIdx={picks[legIndex]} weights={fields[legIndex].weights} onFinish={onLegFinish} />
            ) : (
              <div className="gap-screen">
                <div className="cd-ring"><span>{gap}</span></div>
                <div className="gap-info">
                  <div className="gap-title">
                    {settled === 'busted' ? 'ELENDİN' : settled === 'cashed' ? 'BOZDURDUN ✓' : results[results.length - 1].correct ? 'TUTTU!' : '—'}
                  </div>
                  <div className="gap-sub">Kazanan: {coupon[legIndex].lineup[results[results.length - 1].winner].name}</div>
                  {online && bots && (() => {
                    const before = results.length <= 1 ? playerCount : bots.picks.reduce((a, pk) => a + (results.slice(0, -1).every((r, l) => pk[l] === r.winner) ? 1 : 0), 0)
                    const elimPct = before > 0 ? Math.round(((before - botsAlive) / before) * 100) : 0
                    return <div className="gap-elim">Bu ayakta <b>%{elimPct}</b> oyuncu elendi · {fmtN(botsAlive)} kişi devam ediyor</div>
                  })()}
                </div>
                <div className="gap-actions">
                  {stillAlive ? (
                    <>
                      <button className="btn btn-cash" onClick={cashOut}>BOZDUR · {fmtN(placedStake * multiplier)} TL</button>
                      <button className="btn btn-ghost" onClick={() => setGap(0)}>DEVAM ({gap})</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-gold" onClick={skipToEnd}>SONUCA GEÇ</button>
                      <button className="btn btn-ghost" onClick={() => setGap(0)}>SONRAKİ AYAK</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

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

          {online && feed.length > 0 && (
            <div className="feed">
              <div className="feed-title">CANLI</div>
              {feed.map((e, i) => (
                <div key={i} className={`feed-row ${e.type}`}>
                  <span className="feed-nick">{e.nick}</span> {e.text}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------------- SONUÇ ---------------- */}
      {stage === 'result' && (
        <section className="track-panel gan-result-panel">
          <div className={`gan-result ${settled === 'won' ? 'perfect' : settled === 'cashed' ? 'win' : 'lose'}`}>
            <div className="result-eyebrow">ETAP SONUCU</div>
            {settled === 'won' && <><div className="gan-score">TAM KUPON!</div><div className="gan-points">6/6 · {multiplier.toFixed(2)}x → <em>+{fmtN(payout)} TL</em></div></>}
            {settled === 'cashed' && <><div className="gan-score sm">BOZDURDUN</div><div className="gan-points">{multiplier.toFixed(2)}x → <em>+{fmtN(payout)} TL</em></div></>}
            {settled === 'busted' && <><div className="gan-score sm lose">ELENDİN</div><div className="gan-points">−{fmtN(placedStake)} TL</div></>}

            <div className="gan-best">Bakiye: <b>{fmtN(balance)} TL</b>{online ? ` · Bugünkü en iyi kazanç: ${fmtN(bestWin)} TL` : ''}</div>

            {reward && (
              <div className="rewards">
                <span className="rw-streak">🔥 Seri: <b>{reward.streak}</b> ayak{reward.bonus > 0 && <em> · Seri bonusu +{reward.bonus} TL</em>}</span>
                {reward.newBadges.length > 0 && (
                  <span className="rw-badges">
                    Yeni rozet: {reward.newBadges.map((id) => { const bd = BADGES.find((x) => x.id === id); return <i key={id} title={bd.label}>{bd.icon}</i> })}
                  </span>
                )}
              </div>
            )}

            {online && leaderboard && (
              <>
                <div className="gan-rank">Net: <b className={myNet >= 0 ? 'pos' : 'neg'}>{myNet >= 0 ? '+' : '−'}{fmtN(Math.abs(myNet))} TL</b> · sıralama {fmtN(leaderboard.rank)}/{fmtN(leaderboard.total)} · üst %{leaderboard.pct}</div>
                <div className="leaderboard">
                  <div className="lb-title">LİDERLİK · EN ÇOK KAZANAN (ETAP)</div>
                  {leaderboard.top.map((row, i) => (
                    <div key={i} className={`lb-row ${row.me ? 'me' : ''}`}>
                      <span className="lb-rank">{i + 1}</span>
                      <span className="lb-nick">{row.nick}{row.me && <em>SEN</em>}</span>
                      <span className={`lb-pts ${row.net >= 0 ? 'pos' : 'neg'}`}>{row.net >= 0 ? '+' : '−'}{fmtN(Math.abs(row.net))}</span>
                    </div>
                  ))}
                  {leaderboard.rank > 10 && (
                    <div className="lb-row me lb-sep">
                      <span className="lb-rank">{fmtN(leaderboard.rank)}</span>
                      <span className="lb-nick">{identity.nick}<em>SEN</em></span>
                      <span className={`lb-pts ${myNet >= 0 ? 'pos' : 'neg'}`}>{myNet >= 0 ? '+' : '−'}{fmtN(Math.abs(myNet))}</span>
                    </div>
                  )}
                </div>
              </>
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
                    <span className="rr-pick"><i className="silk" style={{ background: myPick.silk }}>{picks[li] + 1}</i>{myPick.name}</span>
                    <span className="rr-arrow">→</span>
                    <span className="rr-win">{winHorse ? winHorse.name : '—'}</span>
                    <span className="rr-mark">{res?.correct ? '✓' : '✕'}</span>
                  </div>
                )
              })}
            </div>

            <div className="result-actions">
              <button className="btn btn-gold" onClick={newStage}>YENİ ETAP</button>
              {balance <= 0 && <button className="btn btn-ghost" onClick={() => setBalance(START_BAL)}>BAKİYE YÜKLE (1000 TL)</button>}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
