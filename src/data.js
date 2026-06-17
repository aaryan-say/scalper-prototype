// ═══════════════════════════════════════════════════════════
//  DATA.JS  —  history generation, option chain, price engine
// ═══════════════════════════════════════════════════════════

// ── Seeded PRNG (Mulberry32) — deterministic history ───────
function mkRng(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller standard normal via supplied rng
function randn(rng) {
  let u, v
  do { u = rng() } while (u === 0)
  do { v = rng() } while (v === 0)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ── Instrument definitions ──────────────────────────────────
export const INSTRUMENTS = {
  TATAPOWER:     { name: 'TATAPOWER', type: 'equity', lotSize: 1,  basePrice: 348.50 },
  NIFTY:         { name: 'NIFTY 50',  type: 'index',  lotSize: 50, basePrice: 24186  },
  SENSEX:        { name: 'SENSEX',    type: 'index',  lotSize: 10, basePrice: 79501  },
  OPT_360PE:     { name: '30 Mar 360 PE',    type: 'option', optType: 'PE', strike: 360,   lotSize: 1,  basePrice: 35.20 },
  NIFTY_27500PE: { name: 'NIFTY 27500 PE',   type: 'option', optType: 'PE', strike: 27500, lotSize: 50, basePrice: 320   },
  NIFTY_27500CE: { name: 'NIFTY 27500 CE',   type: 'option', optType: 'CE', strike: 27500, lotSize: 50, basePrice: 350   },
}

// ── Historical OHLCV generator ──────────────────────────────
// Returns `count` × 5-minute candles ending at "now"
export function generateHistory(basePrice, vol, count, seed = 42, drift = 0.00003) {
  const rng  = mkRng(seed)
  const bars = []
  let price  = basePrice

  const nowSec    = Math.floor(Date.now() / 1000)
  const barSec    = 5 * 60  // 5 minutes
  const startTime = nowSec - count * barSec

  for (let i = 0; i < count; i++) {
    const open  = price
    const move  = randn(rng) * vol + drift
    const close = Math.max(open * (1 + move), 0.5)
    const range = Math.abs(randn(rng)) * vol * 0.6
    const high  = Math.max(open, close) * (1 + range)
    const low   = Math.min(open, close) * (1 - range)
    const vol_  = Math.floor(500 + rng() * 9500)

    bars.push({
      time:   startTime + i * barSec,
      open:   +open.toFixed(2),
      high:   +high.toFixed(2),
      low:    +low.toFixed(2),
      close:  +close.toFixed(2),
      volume: vol_,
    })
    price = close
  }
  return bars
}

// ── Black-Scholes Greeks ────────────────────────────────────
// Abramowitz & Stegun normal CDF approximation — accurate to 7 decimal places
function normCDF(x) {
  const neg = x < 0
  x = Math.abs(x)
  const t = 1 / (1 + 0.2316419 * x)
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const p = 1 - 0.3989422803 * Math.exp(-x * x / 2) * poly
  return neg ? 1 - p : p
}

export function calcGreeks(spot, strike, tte, iv, type = 'CE') {
  const minPrice = 0.05
  if (tte <= 0 || iv <= 0) {
    const intrinsic = type === 'CE'
      ? Math.max(spot - strike, 0)
      : Math.max(strike - spot, 0)
    return { price: Math.max(intrinsic, minPrice), delta: intrinsic > 0 ? (type === 'CE' ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0, iv }
  }
  const sqrtT = Math.sqrt(tte)
  const d1    = (Math.log(spot / strike) + (iv * iv / 2) * tte) / (iv * sqrtT)
  const d2    = d1 - iv * sqrtT
  const nd1   = normCDF(d1)
  const nd2   = normCDF(d2)
  const pdf1  = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI)

  if (type === 'CE') {
    const price = Math.max(spot * nd1 - strike * nd2, minPrice)
    return {
      price:  +price.toFixed(2),
      delta:  +nd1.toFixed(4),
      gamma:  +(pdf1 / (spot * iv * sqrtT)).toFixed(6),
      theta:  +(-(spot * pdf1 * iv) / (2 * sqrtT * 365)).toFixed(4),
      vega:   +(spot * pdf1 * sqrtT / 100).toFixed(4),
      iv,
    }
  } else {
    const price = Math.max(strike * normCDF(-d2) - spot * normCDF(-d1), minPrice)
    return {
      price:  +price.toFixed(2),
      delta:  +(nd1 - 1).toFixed(4),
      gamma:  +(pdf1 / (spot * iv * sqrtT)).toFixed(6),
      theta:  +(-(spot * pdf1 * iv) / (2 * sqrtT * 365)).toFixed(4),
      vega:   +(spot * pdf1 * sqrtT / 100).toFixed(4),
      iv,
    }
  }
}

// Generates option history using proper delta-based (Black-Scholes elasticity) movement
function generateOptionHistory(spotHistory, baseOptionPrice, strike, type, seed, tte0 = 0.12, iv = 0.22, idioVol = 0.006) {
  const rng   = mkRng(seed)
  const bars  = []
  let price   = baseOptionPrice
  const nBars = spotHistory.length

  for (let i = 0; i < nBars; i++) {
    const spotBar  = spotHistory[i]
    const spot     = spotBar.close
    const prevSpot = i > 0 ? spotHistory[i - 1].close : spotBar.open
    const spotRet  = (spot - prevSpot) / prevSpot

    // Decay time-to-expiry slightly across the history window
    const tte = Math.max(tte0 - (i / nBars) * 0.03, 0.005)
    const g   = calcGreeks(spot, strike, tte, iv, type)

    // Option elasticity (lambda): % change in option for % change in spot
    const lambda = g.delta * (spot / Math.max(price, 0.01))

    const optRet = lambda * spotRet + randn(rng) * idioVol
    const open   = price
    const close  = Math.max(open * (1 + optRet), 0.05)
    const range  = Math.abs(randn(rng)) * 0.008
    const high   = Math.max(open, close) * (1 + range)
    const low    = Math.min(open, close) * (1 - range)
    bars.push({
      time:   spotBar.time,
      open:   +open.toFixed(2),
      high:   +high.toFixed(2),
      low:    +low.toFixed(2),
      close:  +close.toFixed(2),
      volume: Math.floor(500 + rng() * 9500),
    })
    price = close
  }
  return bars
}

export const SPOT_HISTORY    = generateHistory(1310,  0.005, 200, 11, 0.00030)
export const OPTION_HISTORY  = generateHistory(452,   0.014, 200, 77, 0.00040)
export const SENSEX_HISTORY  = generateHistory(25460, 0.003, 200, 53, 0.00018)

// NIFTY underlying — moderate uptrend with realistic intraday volatility
export const NIFTY_HISTORY     = generateHistory(27820, 0.003, 200, 31, 0.00020)
// CE and PE use proper delta-based (Black-Scholes elasticity) movement
export const NIFTY_CE_HISTORY  = generateOptionHistory(NIFTY_HISTORY, 350, 27500, 'CE', 83, 0.12, 0.22)
export const NIFTY_OPT_HISTORY = generateOptionHistory(NIFTY_HISTORY, 320, 27500, 'PE', 91, 0.12, 0.22)

// Current live prices — match reference screenshot exactly for initial display
export const currentPrices = {
  TATAPOWER:     SPOT_HISTORY.at(-1).close,
  OPT_360PE:     OPTION_HISTORY.at(-1).close,
  NIFTY:         NIFTY_HISTORY.at(-1).close,
  NIFTY_27500PE: NIFTY_OPT_HISTORY.at(-1).close,
  NIFTY_27500CE: NIFTY_CE_HISTORY.at(-1).close,
  SENSEX:        25648.65,
}

// Reference display values — shown in headers on first render
export const REFERENCE_DISPLAY = {
  subPrice:     '&#8377;1,293.65',
  subChange:    '+12.25 (0.95%)',
  subChangeUp:  true,
  leftPrice:    '345.30',
  leftChange:   '+12.25 (8.25%)',
  rightPrice:   '210.10',
  rightChange:  '+65.21 (14.22%)',
  niftyPrice:   '&#8377;28,048.65',
  niftyDelta:   '&#9650; 241.25 (0.95%)',
  niftyUp:      true,
  sensexPrice:  '&#8377;25,648.65',
  sensexDelta:  '&#9660; 14.87 (3.48%)',
  sensexUp:     false,
  margin:       '&#8377;24.5k',
  pnl:          '&#8377;0.00',
}

// ── Option chain ────────────────────────────────────────────
const STRIKES = [25000, 25500, 26000, 26500, 27000, 27500, 28000, 28500, 29000, 29500, 30000]

function fakeOI(base, rng) {
  return Math.floor(base * (0.7 + rng() * 0.6))
}

// buildOptionChain uses Black-Scholes for accurate prices and Greeks
export function buildOptionChain(spot, tte = 0.08, iv = 0.22) {
  const rng = mkRng(Math.floor(spot * 100) % 999983)
  const atm = STRIKES.reduce((a, b) => Math.abs(a - spot) < Math.abs(b - spot) ? a : b)

  return STRIKES.map(strike => {
    const ceG    = calcGreeks(spot, strike, tte, iv, 'CE')
    const peG    = calcGreeks(spot, strike, tte, iv, 'PE')
    const itmCe  = spot > strike
    const itmPe  = spot < strike
    const baseOI = itmCe || itmPe ? 400000 + rng() * 200000 : 200000 + rng() * 600000

    return {
      strike,
      atm: strike === atm,
      ce: {
        price:   ceG.price,
        chgPct:  +((rng() - 0.45) * 6).toFixed(2),
        oi:      Math.floor(fakeOI(baseOI, rng)),
        itm:     itmCe,
        delta:   ceG.delta,
        iv:      +(iv * (1 + (Math.abs(strike - spot) / spot) * 0.5)).toFixed(4), // vol smile
      },
      pe: {
        price:   peG.price,
        chgPct:  +((rng() - 0.45) * 6).toFixed(2),
        oi:      Math.floor(fakeOI(baseOI, rng)),
        itm:     itmPe,
        delta:   peG.delta,
        iv:      +(iv * (1 + (Math.abs(strike - spot) / spot) * 0.5)).toFixed(4),
      },
    }
  })
}

// ═══════════════════════════════════════════════════════════
//  PRICE ENGINE  —  ticks every 1s, closes a candle every 30s
// ═══════════════════════════════════════════════════════════
// ── Intraday vol multiplier (simulated market clock) ────────
// Each real second = 1 simulated minute. Market opens at 9:15.
// Returns a multiplier [0.6 – 2.0] based on intraday hour pattern.
function intradayVolMultiplier(elapsedSeconds) {
  const simMinute = elapsedSeconds % 375            // 375 min = 6h15m trading day
  const simHour   = simMinute / 60
  if (simHour < 0.75) return 2.0  // 9:15–9:30 open surge
  if (simHour < 1.5)  return 1.4  // 9:30–10:45 early session
  if (simHour < 3.5)  return 0.7  // 11:00–12:45 midday lull
  if (simHour < 5.5)  return 1.1  // 13:00–14:30 afternoon
  return 1.8                       // 14:30–15:30 closing rush
}

class PriceEngine {
  constructor() {
    this._handlers    = {}
    this._vols        = {}       // base vols per instrument
    this._prices      = {}
    this._spreads     = {}       // { id: { bid, ask } }
    this._bars        = {}
    this._ticks       = {}
    this._garchVol    = {}       // GARCH-lite running vol per instrument
    this._optionCfg   = {}       // { id: { underlying, strike, type, tte, iv } }
    this._elapsed     = 0        // total ticks since start (for intraday clock)
    this.TICKS_PER_CANDLE = 30
    this._timer       = null
  }

  // Half-spread: options min ₹0.50 or 0.25% each side; index very tight
  _halfSpread(id, price) {
    const isOpt = id.includes('CE') || id.includes('PE') || id.includes('OPT')
    return isOpt
      ? Math.max(0.50, price * 0.0025)
      : Math.max(0.25, price * 0.00015)
  }

  register(id, startPrice, vol) {
    this._prices[id]   = startPrice
    this._vols[id]     = vol
    this._garchVol[id] = vol     // GARCH starts at base vol
    this._ticks[id]    = 0
    const hs = this._halfSpread(id, startPrice)
    this._spreads[id]  = { bid: +(startPrice - hs).toFixed(2), ask: +(startPrice + hs).toFixed(2) }
    const nowSec  = Math.floor(Date.now() / 1000)
    const aligned = nowSec - (nowSec % (5 * 60))
    this._bars[id] = {
      time:   aligned,
      open:   +startPrice.toFixed(2),
      high:   +startPrice.toFixed(2),
      low:    +startPrice.toFixed(2),
      close:  +startPrice.toFixed(2),
      volume: 0,
    }
  }

  on(event, fn) {
    ;(this._handlers[event] = this._handlers[event] || []).push(fn)
    return () => {
      this._handlers[event] = this._handlers[event].filter(f => f !== fn)
    }
  }

  _emit(event, data) {
    ;(this._handlers[event] || []).forEach(fn => fn(data))
  }

  start() {
    if (this._timer) return
    this._timer = setInterval(() => this._tick(), 1000)
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  }

  getPrice(id)  { return this._prices[id] }
  getBidAsk(id) { return this._spreads[id] || { bid: this._prices[id], ask: this._prices[id] } }

  // Register an option with Black-Scholes config for delta-linked live pricing
  registerOption(id, startPrice, { underlying, strike, type, tte = 0.08, iv = 0.22 }) {
    this._optionCfg[id] = { underlying, strike, type, tte, iv }
    this.register(id, startPrice, 0)  // idio vol handled via cfg
  }

  _tick() {
    this._elapsed++
    const volMult    = intradayVolMultiplier(this._elapsed)
    const prevPrices = { ...this._prices }   // snapshot for delta return calculation

    for (const id of Object.keys(this._prices)) {
      const last    = this._prices[id]
      const baseVol = this._vols[id]
      const drift   = 0.00004
      let newPrice

      const optCfg = this._optionCfg[id]
      if (optCfg) {
        // ── Delta-linked option pricing ────────────────────────
        const spotNow  = this._prices[optCfg.underlying] || last
        const spotPrev = prevPrices[optCfg.underlying]   || spotNow
        const spotRet  = spotPrev > 0 ? (spotNow - spotPrev) / spotPrev : 0

        // Decay TTE slightly each candle (30 ticks ≈ 1 simulated minute)
        if (this._ticks[id] === 0 && optCfg.tte > 0.002)
          optCfg.tte = Math.max(optCfg.tte - 0.0001, 0.001)

        const g      = calcGreeks(spotNow, optCfg.strike, optCfg.tte, optCfg.iv, optCfg.type)
        const lambda = g.delta * (spotNow / Math.max(last, 0.01))

        // Small IV randomness (vol-of-vol)
        const ivNudge = (Math.random() - 0.5) * 0.004
        optCfg.iv     = Math.max(0.05, Math.min(optCfg.iv + ivNudge, 0.80))

        // Small idio noise (5% of normal GBM magnitude)
        const idio = (Math.random() - 0.5) * 0.005 * last * volMult

        newPrice = Math.max(last + lambda * last * spotRet + idio, 0.05)

      } else {
        // ── Standard GARCH + intraday GBM (for underlying / index) ──
        // GARCH-lite: creates calm/volatile regimes instead of uniform noise
        const prevGarch = this._garchVol[id]
        const shock     = (Math.random() - 0.5) * 2
        const garchVol  = Math.sqrt(0.88 * prevGarch ** 2 + 0.12 * (baseVol * shock) ** 2)
        this._garchVol[id] = Math.max(baseVol * 0.3, Math.min(garchVol, baseVol * 5))

        const effectiveVol = this._garchVol[id] * volMult
        const u1 = Math.random(), u2 = Math.random()
        const z  = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2)
        newPrice = Math.max(last * (1 + drift + effectiveVol * z), 0.01)
      }

      this._prices[id] = newPrice

      // Bid/ask
      const hs  = this._halfSpread(id, newPrice)
      const bid = +(newPrice - hs).toFixed(2)
      const ask = +(newPrice + hs).toFixed(2)
      this._spreads[id] = { bid, ask }

      const bar = this._bars[id]
      bar.close  = +newPrice.toFixed(2)
      bar.high   = Math.max(bar.high, bar.close)
      bar.low    = Math.min(bar.low,  bar.close)
      // Volume scales with volatility (high-vol periods have more volume)
      bar.volume += Math.floor((50 + Math.random() * 300) * volMult)

      this._emit('tick', { id, price: bar.close, bid, ask })
      this._emit('candleUpdate', { id, bar: { ...bar } })

      this._ticks[id]++
      if (this._ticks[id] >= this.TICKS_PER_CANDLE) {
        this._ticks[id] = 0
        const newTime   = bar.time + 5 * 60
        this._emit('newCandle', { id, bar: { ...bar } })
        this._bars[id] = {
          time:   newTime,
          open:   bar.close,
          high:   bar.close,
          low:    bar.close,
          close:  bar.close,
          volume: 0,
        }
      }
    }
  }
}

export const priceEngine = new PriceEngine()
