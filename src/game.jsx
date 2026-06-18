/* ==================================================================
   ORTAK OYUN MODÜLÜ
   Hem Tekli Yarış hem 6'lı Ganyan bu sabitleri/bileşenleri paylaşır.
   ================================================================== */

export const TICK_MS = 880
export const PLACE_N = 3 // 10 atta plase = ilk 3

export const BET_TYPES = {
  kazanan: { key: 'kazanan', label: 'Kazanan', hint: '1. gelsin', payout: 6.5 },
  plase: { key: 'plase', label: 'Plase', hint: 'İlk 3', payout: 3.25 },
  simsek: { key: 'simsek', label: 'Şimşek', hint: 'Çarpan yakala', payout: 0 },
}

export const MODES = {
  renk: { key: 'renk', label: 'Renkli Zar', desc: '3 renk · 24 adım', faces: [1, 1, 2, 2, 3, 3], track: 24 },
  sayi: { key: 'sayi', label: 'Sayılı Zar', desc: '1-6 · 42 adım', faces: [1, 2, 3, 4, 5, 6], track: 42 },
  top: { key: 'top', label: 'Top At', desc: '5 delik · 36 adım', faces: [1, 2, 3, 4, 5], track: 36, ball: true, holes: [5, 4, 3, 2, 1] },
}

export const HOLE_COLORS = { 1: '#3D7BE8', 2: '#29B8C9', 3: '#2EC27E', 4: '#F2742C', 5: '#E2484A' }
export const STEP_COLORS = { 1: '#3D7BE8', 2: '#E8B64C', 3: '#E2484A' }
export const STEP_NAMES = { 1: 'MAVİ', 2: 'SARI', 3: 'KIRMIZI' }
export const SILKS = ['#E2484A', '#3D7BE8', '#E8B64C', '#9B5DE5', '#2EC27E', '#F2742C', '#29B8C9', '#E255A0', '#5C6BC0', '#9CCC4E']
export const CHIPS = [10, 25, 50, 100, 250]

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

export const fmt = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
export const rollFace = (faces) => faces[Math.floor(Math.random() * faces.length)]

/* 24 attan 10'unu rastgele seç, kulvar rengini ata */
export function pickLineup() {
  const arr = [...ROSTER]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, 10).map((h, i) => ({ ...h, silk: SILKS[i] }))
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
   ŞİMŞEK ÇARPANI (konumdan bağımsız bahis) — RTP %92.9'a kalibreli
   Yarış boyunca ~2-6 çarpma rastgele atlara düşer; ilk çarpma "base",
   sonrakiler çarpımsal büyütür; tavan 1000x. Monte Carlo ile her atın
   ortalama ödemesi = 0.929 olacak şekilde ayarlandı.
   ================================================================== */
export const LIGHTNING_CAP = 1000
const LB = {
  Kv: [2, 3, 4, 5, 6], Kw: [0.255, 0.34, 0.23, 0.115, 0.06],
  Bv: [2, 3, 4, 5], Bw: [0.525, 0.29, 0.125, 0.06],
  Fv: [1.5, 2, 2.5, 3, 4], Fw: [0.43, 0.315, 0.145, 0.08, 0.03],
}
function wsel(items, weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}
export function genLightning(n = 10) {
  const K = wsel(LB.Kv, LB.Kw)
  const times = Array.from({ length: K }, () => 0.06 + Math.random() * 0.82).sort((a, b) => a - b)
  const M = Array(n).fill(0)
  const strikes = times.map((t) => {
    const horse = Math.floor(Math.random() * n)
    if (M[horse] === 0) M[horse] = wsel(LB.Bv, LB.Bw)
    else M[horse] = Math.min(LIGHTNING_CAP, +(M[horse] * wsel(LB.Fv, LB.Fw)).toFixed(2))
    return { horse, atProgress: t, M: M[horse] }
  })
  return { strikes, finalM: M.slice() }
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

export function RaceTrack({ theme, lineup, positions, trackLen, modeKey, lastRolls, tick, mineIdxs = [], winnerIdx, placeIdxs = [], lightM = [], struck, running }) {
  return (
    <div className={`track theme-${theme}`}>
      <div className={`sky ${struck ? 'sky-flash' : ''}`} key={struck ? `s${struck.id}` : 'none'}>
        <span className="sky-label">⚡ ŞİMŞEK ALANI</span>
        {struck && <span className="sky-bolt" style={{ left: `${8 + struck.horse * 8.2}%` }}>⚡</span>}
      </div>
      {lineup.map((h, i) => {
        const pct = Math.min(positions[i] / trackLen, 1)
        const m = lightM[i] || 0
        return (
          <div key={i} className={`lane ${mineIdxs.includes(i) ? 'lane-mine' : ''} ${winnerIdx === i ? 'lane-winner' : ''} ${placeIdxs.includes(i) ? 'lane-place' : ''}`}>
            <div className="lane-no" style={{ background: h.silk }}>{i + 1}</div>
            <div className="lane-run">
              <div className="lane-marks"><i /><i /><i /></div>
              <div className="runner" style={{ '--p': pct }}>
                {m > 0 && <span className={`lit-badge ${struck && struck.horse === i ? 'flash' : ''}`}>⚡{m}x</span>}
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
  )
}
