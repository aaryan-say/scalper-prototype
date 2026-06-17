// ═══════════════════════════════════════════════════════════
//  STORE.JS  —  positions, orders, funds, P&L, trailing SL
// ═══════════════════════════════════════════════════════════
import { uid, fmtPrice } from './utils.js'

// ── Event bus ──────────────────────────────────────────────
const _handlers = {}
function emit(event, data) {
  ;(_handlers[event] || []).forEach(fn => fn(data))
}
export function on(event, fn) {
  ;(_handlers[event] = _handlers[event] || []).push(fn)
  return () => { _handlers[event] = _handlers[event].filter(f => f !== fn) }
}

// ── State ──────────────────────────────────────────────────
export const state = {
  positions: [],     // open positions
  closedPositions: [],
  orders:    [],     // all orders
  funds: {
    total:     500000,
    usedMargin: 0,
    available: 500000,
  },
  prices:  {},       // latest mid prices by instrument id
  spreads: {},       // latest { bid, ask } by instrument id
  totalUnrealized:  0,
  totalRealized:    0,
}

// ── Trading defaults (localStorage-backed) ─────────────────
const LS_KEY = 'tradingDefaults'
const DEFAULT_TD = {
  qty: { NIFTY: 235, BANKNIFTY: 235, FINNIFTY: 235, SENSEX: 235 },
  lotSize: { NIFTY: 50, BANKNIFTY: 15, FINNIFTY: 25, SENSEX: 10 },
  price: {
    stocks:  { type: 'market', limitPct: 1.25 },
    options: { type: 'market', limitPct: 1.25 },
    futures: { type: 'market', limitPct: 1.25 },
  },
  sl: {
    type:       'market',
    triggerPct: 25,
    trailing:   false,
    trailingPt: 1,
  },
  tp: {
    type:       'market',
    triggerPct: 25,
  },
}

function loadTD() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT_TD }
    const saved = JSON.parse(raw)
    // Deep-merge nested objects so a partial save doesn't clobber nested defaults
    return {
      ...DEFAULT_TD,
      ...saved,
      qty:   { ...DEFAULT_TD.qty,   ...(saved.qty   || {}) },
      price: {
        stocks:  { ...DEFAULT_TD.price.stocks,  ...(saved.price?.stocks  || {}) },
        options: { ...DEFAULT_TD.price.options, ...(saved.price?.options || {}) },
        futures: { ...DEFAULT_TD.price.futures, ...(saved.price?.futures || {}) },
      },
      sl: { ...DEFAULT_TD.sl, ...(saved.sl || {}) },
      tp: { ...DEFAULT_TD.tp, ...(saved.tp || {}) },
    }
  } catch { return { ...DEFAULT_TD } }
}
function saveTD(td) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(td)) } catch {}
}

function migrateLoadedTD(td) {
  // If saved triggerPct is dangerously small for options, reset to safe default
  if ((td.sl?.triggerPct ?? 0) < 5) td.sl = { ...td.sl, triggerPct: DEFAULT_TD.sl.triggerPct }
  if ((td.tp?.triggerPct ?? 0) < 5) td.tp = { ...td.tp, triggerPct: DEFAULT_TD.tp.triggerPct }
  return td
}
export let tradingDefaults = migrateLoadedTD(loadTD())
export function applyTradingDefaults(td) {
  tradingDefaults = td
  saveTD(td)
  emit('tradingDefaults:changed', td)
}
export function resetTradingDefaults() {
  tradingDefaults = { ...DEFAULT_TD }
  saveTD(tradingDefaults)
  emit('tradingDefaults:changed', tradingDefaults)
}

// ── Margin calculation ──────────────────────────────────────
function calcMargin(instrument, qty, price, side) {
  if (instrument.type === 'option') {
    if (side === 'SELL') {
      // SPAN for short options: ~15% of underlying × qty
      // For NIFTY options: underlying × lotSize × nLots × 0.15
      const underlying = state.prices['NIFTY'] || 27500
      const lotSize    = instrument.lotSize || 50
      const nLots      = qty / lotSize
      return Math.round(underlying * lotSize * nLots * 0.15)
    }
    // Buy option: full premium upfront
    return Math.round(price * qty)
  }
  return Math.round(price * qty * 0.15)
}

// ── Price update (called by price engine on every tick) ────
export function updatePrice(id, price, bid, ask) {
  state.prices[id] = price
  if (bid !== undefined && ask !== undefined) state.spreads[id] = { bid, ask }

  // Recalculate unrealized P&L for all open positions of this instrument
  let changed = false
  for (const pos of state.positions) {
    if (pos.instrumentId !== id) continue
    const prev = pos.unrealizedPnl
    const dir  = pos.side === 'BUY' ? 1 : -1
    pos.currentPrice  = price
    pos.unrealizedPnl = +(dir * (price - pos.avgPrice) * pos.qty).toFixed(2)
    if (pos.unrealizedPnl !== prev) changed = true

    // Trailing SL
    if (tradingDefaults.sl.trailing && pos.side === 'BUY') {
      if (price > (pos.highWatermark || pos.avgPrice)) pos.highWatermark = price
      const trailTrigger = (pos.highWatermark || price) * (1 - tradingDefaults.sl.triggerPct / 100)
      if (price <= trailTrigger && !pos._squaringOff) {
        pos._squaringOff = true
        console.log(`[Trailing SL] Squaring off ${pos.id} at ${price}`)
        setTimeout(() => squareOff(pos.id, 'Trailing SL triggered'), 0)
      }
    }
    if (tradingDefaults.sl.trailing && pos.side === 'SELL') {
      if (price < (pos.lowWatermark || pos.avgPrice)) pos.lowWatermark = price
      const trailTrigger = (pos.lowWatermark || price) * (1 + tradingDefaults.sl.triggerPct / 100)
      if (price >= trailTrigger && !pos._squaringOff) {
        pos._squaringOff = true
        setTimeout(() => squareOff(pos.id, 'Trailing SL triggered'), 0)
      }
    }
  }

  // Check pending limit orders
  _checkLimitOrders(id, price)

  if (changed) {
    _recalcTotals()
    emit('pnl:updated', { positions: state.positions, ...state.funds, totalUnrealized: state.totalUnrealized, totalRealized: state.totalRealized })
  }
}

function _recalcTotals() {
  state.totalUnrealized = state.positions.reduce((s, p) => s + (p.unrealizedPnl || 0), 0)
  state.totalRealized   = state.closedPositions.reduce((s, p) => s + (p.realizedPnl || 0), 0)
}

function _checkLimitOrders(id, price) {
  for (const order of state.orders) {
    if (order.status !== 'PENDING' || order.instrumentId !== id) continue
    const crossed = order.side === 'BUY'
      ? price <= order.limitPrice
      : price >= order.limitPrice
    // Limit orders fill at the limit price, not the current market price
    if (crossed) _executeOrder(order, order.limitPrice)
  }
}

// ── Order placement ────────────────────────────────────────
export function placeMarketOrder(side, instrumentId, qty, instrument) {
  const lotSize = instrument?.lotSize || 1
  if (qty % lotSize !== 0) {
    emit('order:rejected', { reason: `Qty must be a multiple of ${lotSize}`, instrumentId, side })
    return null
  }
  const mid = state.prices[instrumentId]
  if (!mid) return null
  // Buy at ask, sell at bid — no free fill at mid
  const spread = state.spreads[instrumentId]
  const execPrice = side === 'BUY'
    ? (spread ? spread.ask : +(mid * 1.0005).toFixed(2))
    : (spread ? spread.bid : +(mid * 0.9995).toFixed(2))
  const order = _createOrder('MARKET', side, instrumentId, qty, null, instrument)
  _executeOrder(order, execPrice)
  return order
}

export function placeLimitOrder(side, instrumentId, qty, limitPrice, instrument) {
  const lotSize = instrument?.lotSize || 1
  if (qty % lotSize !== 0) {
    emit('order:rejected', { reason: `Qty must be a multiple of ${lotSize}`, instrumentId, side })
    return null
  }
  const order = _createOrder('LIMIT', side, instrumentId, qty, limitPrice, instrument)
  state.orders.push(order)
  emit('orders:updated', state.orders)
  return order
}

export function updateLimitOrderPrice(orderId, limitPrice, { silent = false } = {}) {
  const order = state.orders.find(o => o.id === orderId)
  if (!order || order.status !== 'PENDING' || order.type !== 'LIMIT') return null
  order.limitPrice = limitPrice
  if (!silent) emit('orders:updated', state.orders)
  return order
}

function _createOrder(type, side, instrumentId, qty, limitPrice, instrument) {
  return {
    id:           `ORD-${uid()}`,
    type,
    side,
    instrumentId,
    qty,
    limitPrice:   limitPrice || null,
    status:       'PENDING',
    instrument:   instrument || { name: instrumentId },
    placedAt:     new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    executedAt:   null,
    executedPrice: null,
  }
}

function _executeOrder(order, price) {
  order.status        = 'EXECUTED'
  order.executedAt    = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  order.executedPrice = price

  if (!state.orders.includes(order)) state.orders.push(order)
  _openPosition(order, price)
  emit('orders:updated', state.orders)
  emit('order:executed', order)
}

export function cancelOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId)
  if (order && order.status === 'PENDING') {
    order.status = 'CANCELLED'
    emit('orders:updated', state.orders)
  }
}

// ── Position management ────────────────────────────────────
function _openPosition(order, price) {
  const margin = calcMargin(order.instrument || {}, order.qty, price, order.side)

  // Check if there's an existing position in same instrument + side
  const existing = state.positions.find(
    p => p.instrumentId === order.instrumentId && p.side === order.side
  )

  if (existing) {
    // Average in
    const totalQty    = existing.qty + order.qty
    existing.avgPrice = +((existing.avgPrice * existing.qty + price * order.qty) / totalQty).toFixed(2)
    existing.qty      = totalQty
    existing.marginUsed = (existing.marginUsed || 0) + margin
  } else {
    const pos = {
      id:           `POS-${uid()}`,
      instrumentId: order.instrumentId,
      name:         order.instrument?.name || order.instrumentId,
      side:         order.side,
      qty:          order.qty,
      avgPrice:     price,
      currentPrice: price,
      unrealizedPnl: 0,
      highWatermark: price,
      lowWatermark:  price,
      marginUsed:   margin,
      _squaringOff:  false,
      openedAt:     order.executedAt,
    }
    state.positions.push(pos)
  }

  // Debit margin
  state.funds.usedMargin  += margin
  state.funds.available    = state.funds.total + state.totalRealized - state.funds.usedMargin
  _recalcTotals()
  emit('positions:updated', state.positions)
  emit('funds:updated', state.funds)
}

export function squareOff(positionId, reason = '') {
  const idx = state.positions.findIndex(p => p.id === positionId)
  if (idx === -1) return

  const pos    = state.positions[idx]
  const spread = state.spreads[pos.instrumentId]
  const mid    = state.prices[pos.instrumentId] || pos.currentPrice

  // Exit at the unfavorable side of the spread (same pain as entry)
  const closePrice = pos.side === 'BUY'
    ? (spread ? spread.bid : +(mid * 0.9995).toFixed(2))   // long → sell at bid
    : (spread ? spread.ask : +(mid * 1.0005).toFixed(2))   // short → buy at ask

  const dir = pos.side === 'BUY' ? 1 : -1
  let realizedPnl = +(dir * (closePrice - pos.avgPrice) * pos.qty).toFixed(2)

  // ── Charges ──────────────────────────────────────────────
  // Brokerage: ₹20 per order leg × 2 (entry + exit)
  const brokerage = 40
  // STT (Securities Transaction Tax): 0.05% on the sell-side option premium
  // Long position: we sell to close → STT on closePrice × qty
  // Short position: entry was a sell → STT on avgPrice × qty (simulated at close)
  const sttBase = pos.side === 'BUY' ? closePrice : pos.avgPrice
  const stt     = Math.round(sttBase * pos.qty * 0.0005)
  const charges  = brokerage + stt
  realizedPnl    = +(realizedPnl - charges).toFixed(2)

  const closed = {
    ...pos,
    closedAt:    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    closePrice,
    realizedPnl,
    charges,
    reason,
  }
  state.closedPositions.push(closed)
  state.positions.splice(idx, 1)

  // Release exactly the margin that was locked at entry
  const marginReleased = pos.marginUsed || 0
  state.funds.usedMargin  = Math.max(0, state.funds.usedMargin - marginReleased)
  _recalcTotals()
  state.funds.available = state.funds.total + state.totalRealized - state.funds.usedMargin

  emit('positions:updated', state.positions)
  emit('funds:updated', state.funds)
  emit('pnl:updated', { positions: state.positions, ...state.funds, totalUnrealized: state.totalUnrealized, totalRealized: state.totalRealized })
}

export function squareOffAll() {
  const ids = state.positions.map(p => p.id)
  ids.forEach(id => squareOff(id, 'Manual square-off all'))
}
