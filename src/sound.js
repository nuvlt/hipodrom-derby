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
