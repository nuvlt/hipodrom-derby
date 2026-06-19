/* ==================================================================
   ORTAK OYUN MODÜLÜ
   Hem Tekli Yarış hem 6'lı Ganyan bu sabitleri/bileşenleri paylaşır.
   ================================================================== */

export const TICK_MS = 880
export const PLACE_N = 2 // 7 atta plase = ilk 2

export const BET_TYPES = {
  kazanan: { key: 'kazanan', label: 'Kazanan', hint: '1. gelsin', payout: 6.5 },
  plase: { key: 'plase', label: 'Plase', hint: 'İlk 2', payout: 3.25 },
}

export const MODES = {
  renk: { key: 'renk', label: 'Renkli Zar', desc: '3 renk · 24 adım', faces: [1, 1, 2, 2, 3, 3], track: 24 },
  sayi: { key: 'sayi', label: 'Sayılı Zar', desc: '1-6 · 42 adım', faces: [1, 2, 3, 4, 5, 6], track: 42 },
  top: { key: 'top', label: 'Top At', desc: '5 delik · 36 adım', faces: [1, 2, 3, 4, 5], track: 36, ball: true, holes: [5, 4, 3, 2, 1] },
}

export const HOLE_COLORS = { 1: '#3D7BE8', 2: '#29B8C9', 3: '#2EC27E', 4: '#F2742C', 5: '#E2484A' }
export const STEP_COLORS = { 1: '#3D7BE8', 2: '#E8B64C', 3: '#E2484A' }
export const STEP_NAMES = { 1: 'MAVİ', 2: 'SARI', 3: 'KIRMIZI' }
export const SILKS = ['#E2484A', '#3D7BE8', '#E8B64C', '#9B5DE5', '#2EC27E', '#F2742C', '#29B8C9']
export const CHIPS = [10, 25, 50, 100, 250]

const ROSTER = [
  { name: 'ŞİMŞEK', fg: 88, fs: 84 }, { name: 'POYRAZ', fg: 82, fs: 86 },
  { name: 'FIRTINA', fg: 90, fs: 81 }, { name: 'KARAYEL', fg: 79, fs: 88 },
  { name: 'RÜZGÂR', fg: 85, fs: 83 }, { name: 'YILDIZ', fg: 91, fs: 87 },
  { name: 'LODOS', fg: 77, fs: 90 }, { name: 'ALEV', fg: 86, fs: 79 },
  { name: 'KASIRGA', fg: 83, fs: 85 }, { name: 'BORA', fg: 80, fs: 82 },
  { name: 'TUFAN', fg: 89, fs: 78 }, { name: 'ZEYBEK', fg: 84, fs: 88 },
  { name: 'ÇAĞLA', fg: 78, fs: 86 }, { name: 'ESRA', fg: 82, fs: 80 },
  { name: 'YÜCEL', fg: 90, fs: 89 }, { name: 'ONUR', fg: 81, fs: 84 },
  { name: 'ERDİ', fg: 87, fs: 82 }, { name: 'EMRAH', fg: 85, fs: 87 },
  { name: 'FUAT', fg: 83, fs: 85 }, { name: 'MEVLÜT', fg: 88, fs: 80 },
  { name: 'UFUK', fg: 79, fs: 89 }, { name: 'METİN', fg: 86, fs: 84 },
  { name: 'BATU', fg: 84, fs: 81 }, { name: 'ERKAN', fg: 80, fs: 87 },
]

export const fmt = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
export const rollFace = (faces) => faces[Math.floor(Math.random() * faces.length)]

/* 24 attan 7'sini rastgele seç, kulvar rengini ata */
export function pickLineup() {
  const arr = [...ROSTER]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, 7).map((h, i) => ({ ...h, silk: SILKS[i] }))
}

/* bitiş anındaki konumlara göre sıralama; eşitlik rastgele çözülür (simetri korunur) */
export function rankOrder(positions) {
  return positions
    .map((p, i) => ({ p, i, r: Math.random() }))
    .sort((a, b) => b.p - a.p || b.r - a.r)
    .map((o) => o.i)
}

/* ==================================================================
   OLASILIK / ORAN MODELİ (Faz 1.5)
   Atlara gerçek (farklı) kazanma olasılığı verir; oranları Monte Carlo
   ile ölçüp RTP'yi sabit tutar. Zar/top mekaniği korunur — sadece güçlü
   atlar yüksek yüzleri daha sık atar.
   ================================================================== */

export const TARGET_RTP = 0.929 // mevcut RTP korunur
const DRIVE_K = 0.20            // güç → olasılık yayılımı (kalibre edildi)

const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length

/* bir atın "drive" değerine göre yüz olasılıkları (softmax eğimi) */
export function faceWeights(faces, drive) {
  const m = avg(faces)
  const sd = Math.sqrt(avg(faces.map((v) => (v - m) * (v - m)))) || 1
  const w = faces.map((v) => Math.exp(drive * (v - m) / sd))
  const s = w.reduce((a, b) => a + b, 0)
  return w.map((x) => x / s)
}

/* ağırlıklı yüz çekimi */
export function weightedPick(faces, weights) {
  let r = Math.random()
  for (let i = 0; i < faces.length; i++) { r -= weights[i]; if (r <= 0) return faces[i] }
  return faces[faces.length - 1]
}

/* alan içi göreli ratinglerden drive üret (favori + eşek doğal oluşur) */
export function drivesFromRatings(ratings, K = DRIVE_K) {
  const m = avg(ratings)
  return ratings.map((r) => K * (r - m) / 8)
}

/* Monte Carlo: kazanma ve plase (ilk 3) olasılıkları (canlı yarışla aynı mekanik) */
export function simulateField(weightsPerHorse, faces, trackLen, N = 3000) {
  const n = weightsPerHorse.length
  const wins = Array(n).fill(0)
  const place = Array(n).fill(0)
  for (let s = 0; s < N; s++) {
    const pos = Array(n).fill(0)
    while (!pos.some((p) => p >= trackLen)) {
      for (let i = 0; i < n; i++) pos[i] += weightedPick(faces, weightsPerHorse[i])
    }
    const ord = rankOrder(pos)
    wins[ord[0]]++
    for (let k = 0; k < PLACE_N; k++) place[ord[k]]++
  }
  return { pWin: wins.map((w) => w / N), pPlace: place.map((t) => t / N) }
}

export function oddsFromProb(p, target = TARGET_RTP, cap = 99) {
  if (p <= 0) return cap
  return Math.min(cap, Math.max(1.05, (1 / p) * target))
}

/* ==================================================================
   ŞİMŞEK ÇARPANI — Kazanan/Plase içine gömülü, ÇOKLU şimşek
   Yarış başına ~3 ata çarpar (hepsine değil), her ata bir çarpan (γ)
   düşer. γ bir KAT SAYIdır: bazen 0.8x bazen 3x — yani illa kazandırmaz.
   Nadiren aynı ata 2. kez çarpıp çarpanı büyütür. Ödeme(tutan bahis) =
   baz_oran * γ. Baz oran = LIGHTNING_BETA * fair. Monte Carlo ile RTP
   üniform %92.9'a kalibre. Ödeme tavanı 1000x.
   ================================================================== */
export const LIGHTNING_CAP = 1000
export const LIGHTNING_BETA = 0.79
const LG = {
  Kv: [4, 5, 6], Kw: [0.22, 0.46, 0.32], restrikeP: 0.10, gcap: 25,
  Bv: [0.5, 0.7, 0.9, 1.1, 1.5, 2.0, 3.0, 5], Bw: [0.22, 0.22, 0.16, 0.11, 0.09, 0.08, 0.06, 0.06],
  Gv: [1.4, 1.8, 2.5], Gw: [0.45, 0.35, 0.20],
}
function wsel(items, weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}
export function genLightning(n = 7) {
  const K = wsel(LG.Kv, LG.Kw)
  const times = Array.from({ length: K }, () => 0.08 + Math.random() * 0.78).sort((a, b) => a - b)
  const G = Array(n).fill(0)
  const lit = []
  const strikes = times.map((t) => {
    let horse
    const restrike = lit.length > 0 && Math.random() < LG.restrikeP
    if (restrike) {
      horse = lit[Math.floor(Math.random() * lit.length)]
      G[horse] = Math.min(LG.gcap, +(G[horse] * wsel(LG.Gv, LG.Gw)).toFixed(2))
    } else {
      const free = []
      for (let i = 0; i < n; i++) if (G[i] === 0) free.push(i)
      if (free.length === 0) { horse = Math.floor(Math.random() * n); G[horse] = Math.min(LG.gcap, +(G[horse] * wsel(LG.Gv, LG.Gw)).toFixed(2)) }
      else { horse = free[Math.floor(Math.random() * free.length)]; G[horse] = wsel(LG.Bv, LG.Bw); lit.push(horse) }
    }
    return { horse, atProgress: t, gamma: G[horse] }
  })
  return { strikes, finalG: G.slice() }
}

/* alanı kur: ratingler + mod → drive, ağırlık, olasılık, oran */
export function buildField(ratings, mode, N = 3000) {
  const drives = drivesFromRatings(ratings)
  const weights = drives.map((d) => faceWeights(mode.faces, d))
  const { pWin, pPlace } = simulateField(weights, mode.faces, mode.track, N)
  const oddsWin = pWin.map((p) => oddsFromProb(p))
  const oddsPlase = pPlace.map((p) => oddsFromProb(p))
  let donkeyIdx = 0
  for (let i = 1; i < pWin.length; i++) if (pWin[i] < pWin[donkeyIdx]) donkeyIdx = i
  return { drives, weights, pWin, pPlace, oddsWin, oddsPlase, donkeyIdx }
}

/* ------------------------------------------------------------------ */
/*  AT — yarış atı silüeti (sağa bakar)                                */
/* ------------------------------------------------------------------ */

export function Horse({ silk, number, running, won }) {
  return (
    <svg className={`horse ${running ? 'running' : ''} ${won ? 'won' : ''}`} viewBox="0 0 104 68" width="72" height="47" aria-hidden="true">
      <g className="horse-body-group">
        <path d="M22 31 C11 31 6 43 8 55 C12 47 16 39 25 38 Z" fill="#3a2614" />
        <rect className="leg leg-b1" x="27" y="39" width="4" height="23" rx="2" fill="#4a3119" />
        <rect className="leg leg-f1" x="64" y="39" width="4" height="23" rx="2" fill="#4a3119" />
        <ellipse cx="32" cy="33" rx="13" ry="12" fill="#6e4b2a" />
        <ellipse cx="52" cy="35" rx="22" ry="10.5" fill="#6e4b2a" />
        <ellipse cx="69" cy="34" rx="9.5" ry="11" fill="#6e4b2a" />
        <path d="M65 25 L80 14 L84 20 L73 34 Z" fill="#6e4b2a" />
        <path d="M78 14 L88 11 L94 16 L92 21 L83 21 L79 18 Z" fill="#6e4b2a" />
        <path d="M84 12 L86 5 L89 12 Z" fill="#5e3f23" />
        <path d="M65 24 L79 13 L81 16 L70 30 Z" fill="#3a2614" />
        <circle cx="87" cy="15.5" r="1.2" fill="#160d05" />
        <circle cx="91.5" cy="18" r="0.9" fill="#160d05" />
        <rect className="leg leg-b2" x="31" y="39" width="4" height="22" rx="2" fill="#5f4126" />
        <rect className="leg leg-f2" x="68" y="39" width="4" height="22" rx="2" fill="#5f4126" />
        <rect x="46" y="29" width="14" height="9" rx="2" fill={silk} />
        <path d="M50 30 C49 22 52 18 55 19 C58 20 56 26 56 30 Z" fill={silk} />
        <circle cx="53.5" cy="15" r="3" fill={silk} />
        <circle cx="55.5" cy="17.5" r="2" fill="#E8C9A0" />
        <text x="53" y="36.2" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{number}</text>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  ZAR                                                                */
/* ------------------------------------------------------------------ */

export function Die({ mode, value, size = 'lg' }) {
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
/*  TOP TAHTASI                                                        */
/* ------------------------------------------------------------------ */

export function BallBoard({ holes, value, tick, auto, disabled, done, onThrow }) {
  const Tag = auto ? 'div' : 'button'
  const props = auto ? {} : { onClick: onThrow, disabled }
  return (
    <Tag className={`ball-board ${auto ? 'auto' : ''}`} {...props}>
      <div className="ball-chute">
        {holes.map((h) => (
          <div key={h} className="hole-row" style={{ '--hc': HOLE_COLORS[h] }}>
            <span className="hole-val">+{h}</span>
            <div className={`hole ${value === h ? 'active' : ''}`}>
              {value === h && <span className="ball" key={tick} />}
            </div>
          </div>
        ))}
      </div>
      <span className="dice-cta">{auto ? 'OTOMATİK' : done ? 'BİTTİ' : 'TOP AT'}</span>
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/*  PİST — kulvarlar + atlar (her iki mod da kullanır)                 */
/* ------------------------------------------------------------------ */

/* Noto bulutu (Apache lisanslı, googlefonts/noto-emoji) — birden çok kez kullanılır */
function CloudShape({ variant }) {
  return (
    <svg className={`cloud ${variant}`} viewBox="2 16 122 92" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d="M23.45 62.3c.72-.72-1.27-9.29 7.6-15.91s14.92-2.67 15.77-2.96c.84-.28 4.79-17.6 21.4-22.1s33.93 3.94 38.01 18.02c3.73 12.87.84 21.54 1.27 22.1c.42.56 8.45.28 13.09 7.74s2.96 12.11 2.96 12.11l-29.56 9.15h-47.3S5.02 79.47 4.6 77.5c-.42-1.97.53-8.37 7.32-12.25c5.9-3.37 10.26-1.68 11.53-2.95z" fill="#e4eaee" />
      <path d="M35.16 92.84s-15.78 3.3-26.45-4.96C2.29 82.9 4.63 74.83 4.63 74.83s4.6 4.65 13.89 5.91c9.29 1.27 19.71.84 19.71.84s2.6 4.44 12.39 6.48c12.27 2.55 18.74-3.73 18.74-3.73s3.36 4.02 15.19 4.3c11.83.28 18.46-7.98 19.57-8.17c.56-.09 3.82 2.87 10.28 1.83c6.15-.99 9.39-3.66 9.39-3.66s.89 6.62-5.3 10.7c-4.83 3.18-13.23 3.52-13.23 3.52s-1.28 4.91-7.05 8.48c-5.36 3.33-14.6 4.44-21.44 2.4c-8.59-2.56-10.72-6.47-10.72-6.47s-6.4 3.75-16.4 2.48c-9.45-1.18-14.49-6.9-14.49-6.9z" fill="#bacdd2" />
    </svg>
  )
}

export function RaceTrack({ theme, lineup, positions, trackLen, modeKey, lastRolls, tick, mineIdxs = [], winnerIdx, placeIdxs = [], lightM = [], struck, running, betOdds = [], showOdds = false }) {
  return (
    <div className={`track theme-${theme}`}>
      <div className={`sky ${struck ? 'sky-flash' : ''}`} key={struck ? `sky${struck.id}` : 'sky'}>
        <CloudShape variant="cloud-2" />
        <CloudShape variant="cloud-main" />
        <CloudShape variant="cloud-3" />
        <span className="sky-label">⚡ ŞİMŞEK ALANI</span>
      </div>

      <div className="lanes-wrap">
        <svg className="bolt-fx" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {struck && (
            <g key={`b${struck.id}`} className="bolt-group">
              <polyline className="bolt-line glow" points={struck.bolt} />
              <polyline className="bolt-line core" points={struck.bolt} />
              <circle className="bolt-hit" cx={struck.tx} cy={struck.ty} r="5" />
            </g>
          )}
        </svg>

        {lineup.map((h, i) => {
          const pct = Math.min(positions[i] / trackLen, 1)
          const m = lightM[i] || 0
          const zap = struck && struck.horse === i
          return (
            <div key={i} className={`lane ${mineIdxs.includes(i) ? 'lane-mine' : ''} ${winnerIdx === i ? 'lane-winner' : ''} ${placeIdxs.includes(i) ? 'lane-place' : ''}`}>
              <div className="lane-no" style={{ background: h.silk }}>{i + 1}</div>
              <div className="lane-run">
                <div className="lane-marks"><i /><i /><i /></div>
                <div className={`runner ${zap ? 'zapped' : ''}`} key={zap ? `z${struck.id}` : `r${i}`} style={{ '--p': pct }}>
                  {m > 0 && <span className={`lit-badge ${m < 1 ? 'low' : ''} ${zap ? 'flash' : ''}`}>⚡×{m}</span>}
                  {showOdds && betOdds[i] != null && <span className="odds-badge">×{betOdds[i].toFixed(2)}</span>}
                  <Horse silk={h.silk} number={i + 1} running={running} won={winnerIdx === i} />
                  {running && lastRolls[i] && (
                    <span className="roll-pop" key={tick} style={{ background: modeKey === 'renk' ? STEP_COLORS[lastRolls[i]] : 'var(--ivory)', color: modeKey === 'renk' ? '#fff' : '#1b1b1b' }}>+{lastRolls[i]}</span>
                  )}
                </div>
              </div>
              <div className="finish-strip" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
