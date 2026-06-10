/* Basit ses efektleri — Web Audio API ile sentezlenir, hiç ses dosyası yok.
   Tarayıcı autoplay kuralları gereği ses bağlamı ilk kullanıcı etkileşiminde açılır. */

let ctx = null
let muted = false

export function setMuted(m) { muted = m }
export function isMuted() { return muted }

function ac() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch (e) {
    return null
  }
}

/* ilk tıklamada bağlamı uyandırmak için */
export function unlock() { ac() }

/* kısa bantlı gürültü patlaması — nal "klop"u */
function clop(start, { vol = 0.1, freq = 1500, dur = 0.045 } = {}) {
  const c = ac()
  if (!c) return
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = 1.5
  const g = c.createGain()
  g.gain.setValueAtTime(vol, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  src.connect(bp)
  bp.connect(g)
  g.connect(c.destination)
  src.start(start)
  src.stop(start + dur)
}

/* alçak "tok" — frekansı hızla düşen vuruş */
function thud(start, { freq = 210, to = 95, vol = 0.12, dur = 0.07 } = {}) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq, start)
  o.frequency.exponentialRampToValueAtTime(to, start + dur)
  g.gain.setValueAtTime(vol, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(start)
  o.stop(start + dur + 0.02)
}

/* nal sesi — her hamlede iki vuruşlu gallop ritmi (ta-dam) */
export function hoof() {
  if (muted) return
  const c = ac()
  if (!c) return
  const t = c.currentTime
  thud(t, { freq: 220, to: 100, vol: 0.11, dur: 0.06 })
  clop(t, { vol: 0.08, freq: 1650 })
  thud(t + 0.12, { freq: 190, to: 90, vol: 0.10, dur: 0.07 })
  clop(t + 0.12, { vol: 0.07, freq: 1400 })
}

function tone(freq, start, dur, { type = 'sine', vol = 0.18, glideTo = null } = {}) {
  const c = ac()
  if (!c) return
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(vol, start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(start)
  o.stop(start + dur + 0.03)
}

/* zar atışı — renkli modda değere göre tiz/peslik değişir */
export function roll(value) {
  if (muted) return
  const c = ac()
  if (!c) return
  const t = c.currentTime
  const base = value ? 470 + value * 110 : 620
  tone(base, t, 0.06, { type: 'square', vol: 0.10 })
  tone(base * 0.5, t, 0.05, { type: 'triangle', vol: 0.06 })
}

/* geri sayım tıkı */
export function tick() {
  if (muted) return
  const c = ac()
  if (!c) return
  tone(900, c.currentTime, 0.035, { type: 'sine', vol: 0.05 })
}

/* bahis onayı — iki nota yükselen */
export function bet() {
  if (muted) return
  const c = ac()
  if (!c) return
  const t = c.currentTime
  tone(523, t, 0.09, { type: 'sine', vol: 0.14 })
  tone(784, t + 0.08, 0.12, { type: 'sine', vol: 0.14 })
}

/* start düdüğü */
export function start() {
  if (muted) return
  const c = ac()
  if (!c) return
  const t = c.currentTime
  ;[392, 523, 659].forEach((f, i) => tone(f, t + i * 0.09, 0.12, { type: 'triangle', vol: 0.13 }))
}

/* kazanç fanfarı */
export function win() {
  if (muted) return
  const c = ac()
  if (!c) return
  const t = c.currentTime
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.10, 0.16, { type: 'triangle', vol: 0.15 }))
}

/* kayıp — inen iki nota */
export function lose() {
  if (muted) return
  const c = ac()
  if (!c) return
  const t = c.currentTime
  tone(392, t, 0.16, { type: 'sine', vol: 0.12, glideTo: 300 })
  tone(294, t + 0.14, 0.22, { type: 'sine', vol: 0.12, glideTo: 220 })
}
