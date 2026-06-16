/* ==================================================================
   ORTAK OYUN MODÜLÜ
   Hem Tekli Yarış hem 6'lı Ganyan bu sabitleri/bileşenleri paylaşır.
   ================================================================== */

export const TICK_MS = 880

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
  { name: 'YAĞIZ', fg: 78, fs: 86 }, { name: 'DORU', fg: 82, fs: 80 },
  { name: 'KÜHEYLAN', fg: 90, fs: 89 }, { name: 'AKINCI', fg: 81, fs: 84 },
  { name: 'CEYLAN', fg: 87, fs: 82 }, { name: 'ŞAHİN', fg: 85, fs: 87 },
  { name: 'DOĞAN', fg: 83, fs: 85 }, { name: 'KARTAL', fg: 88, fs: 80 },
  { name: 'ATMACA', fg: 79, fs: 89 }, { name: 'PARS', fg: 86, fs: 84 },
  { name: 'ATEŞ', fg: 84, fs: 81 }, { name: 'TOROS', fg: 80, fs: 87 },
]

/* ganyan için ek veriler */
export const RACE_NAMES = [
  'Bahar Kupası', 'Altın Sprint', 'Şampiyonlar Koşusu', 'Gazi Koşusu',
  'Cumhuriyet Kupası', 'Zafer Koşusu', 'Anadolu Derbisi', 'Boğaziçi Kupası',
  'İnci Sprint', 'Yıldızlar Geçidi', 'Ankara Koşusu', 'Fatih Kupası',
]
export const DISTANCES = ['1200m', '1400m', '1600m', '2000m', '1000m', '1800m']

export const FORM_STATES = [
  { key: 'formda', label: 'Formda', color: '#2EC27E' },
  { key: 'yukselen', label: 'Yükselen', color: '#E8B64C' },
  { key: 'formsuz', label: 'Formsuz', color: '#E2484A' },
]

export const fmt = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })
export const rollFace = (faces) => faces[Math.floor(Math.random() * faces.length)]
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1))

/* 24 attan 7'sini rastgele seç, kulvar rengini ata */
export function pickLineup() {
  const arr = [...ROSTER]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, 7).map((h, i) => ({ ...h, silk: SILKS[i] }))
}

/* ganyan kadrosu: kozmetik istatistikler + form durumu ekli (sonucu etkilemez) */
export function pickGanyanLineup() {
  return pickLineup().map((h) => {
    const hiz = rnd(74, 95)
    const guc = rnd(62, 90)
    const kilo = rnd(52, 60)
    const genel = Math.round((hiz + guc) / 2)
    const form = FORM_STATES[Math.floor(Math.random() * FORM_STATES.length)]
    return { ...h, hiz, guc, kilo, genel, form }
  })
}

/* dizilişten n farklı eleman seç */
export function pickNames(n) {
  const arr = [...RACE_NAMES]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
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

/* Monte Carlo: alanın kazanma ve ilk-2 olasılıkları (canlı yarışla aynı mekanik) */
export function simulateField(weightsPerHorse, faces, trackLen, N = 3000) {
  const n = weightsPerHorse.length
  const wins = Array(n).fill(0)
  const top2 = Array(n).fill(0)
  for (let s = 0; s < N; s++) {
    const pos = Array(n).fill(0)
    while (!pos.some((p) => p >= trackLen)) {
      for (let i = 0; i < n; i++) pos[i] += weightedPick(faces, weightsPerHorse[i])
    }
    const ord = rankOrder(pos)
    wins[ord[0]]++
    top2[ord[0]]++; top2[ord[1]]++
  }
  return { pWin: wins.map((w) => w / N), pTop2: top2.map((t) => t / N) }
}

export function oddsFromProb(p, target = TARGET_RTP, cap = 99) {
  if (p <= 0) return cap
  return Math.min(cap, Math.max(1.05, (1 / p) * target))
}

/* alanı kur: ratingler + mod → drive, ağırlık, olasılık, oran, eşek at */
export function buildField(ratings, mode, N = 3000) {
  const drives = drivesFromRatings(ratings)
  const weights = drives.map((d) => faceWeights(mode.faces, d))
  const { pWin, pTop2 } = simulateField(weights, mode.faces, mode.track, N)
  const oddsWin = pWin.map((p) => oddsFromProb(p))
  const oddsPlase = pTop2.map((p) => oddsFromProb(p))
  let donkeyIdx = 0
  for (let i = 1; i < pWin.length; i++) if (pWin[i] < pWin[donkeyIdx]) donkeyIdx = i
  return { drives, weights, pWin, pTop2, oddsWin, oddsPlase, donkeyIdx }
}

/* ==================================================================
   SİMÜLE ÇOK OYUNCULU (Faz 1.8 — botlarla UX prototipi, client-side)
   ================================================================== */

export const NICK_POOL = [
  'AtSever', 'Jokey', 'Ganyancı', 'Sprint', 'Fotofiniş', 'Doludizgin', 'Koşucu',
  'Şahbaz', 'Rüzgâr', 'Nalbant', 'Şanslı', 'Bahisçi', 'PistKralı', 'Derbi',
  'Gözde', 'Favori', 'Sürpriz', 'Tabela', 'KuponCanavarı', 'Handikap', 'Apranti',
  'Safkan', 'Eşekçi', 'Üçlübir', 'Altılı', 'Çıkış', 'Düzlük', 'Viraj', 'Start',
]

export function botNick(i) {
  return NICK_POOL[i % NICK_POOL.length] + (10 + (i * 37) % 990)
}

export function weightedIndex(weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i }
  return weights.length - 1
}

/* botların kupon seçimleri: her ayakta oranlara göre ağırlıklı (favori daha çok seçilir) */
export function genBots(fields, count) {
  const nLegs = fields.length
  const n = fields[0].pWin.length
  const wPerLeg = fields.map((f) => f.pWin.map((p) => Math.pow(p, 0.85) + 0.03))
  const picks = new Array(count)
  const counts = fields.map(() => new Array(n).fill(0))
  for (let b = 0; b < count; b++) {
    const pk = new Array(nLegs)
    for (let l = 0; l < nLegs; l++) { const h = weightedIndex(wPerLeg[l]); pk[l] = h; counts[l][h]++ }
    picks[b] = pk
  }
  return { picks, counts }
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

export function RaceTrack({ theme, lineup, positions, trackLen, modeKey, lastRolls, tick, mineIdx, winnerIdx, placeIdx, running }) {
  return (
    <div className={`track theme-${theme}`}>
      {lineup.map((h, i) => {
        const pct = Math.min(positions[i] / trackLen, 1)
        return (
          <div key={i} className={`lane ${mineIdx === i ? 'lane-mine' : ''} ${winnerIdx === i ? 'lane-winner' : ''} ${placeIdx === i ? 'lane-place' : ''}`}>
            <div className="lane-no" style={{ background: h.silk }}>{i + 1}</div>
            <div className="lane-run">
              <div className="lane-marks"><i /><i /><i /></div>
              <div className="runner" style={{ '--p': pct }}>
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
