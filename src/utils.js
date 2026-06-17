// ── Number formatting ──────────────────────────────────────

export function fmtPrice(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPriceShort(n) {
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr'
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(1) + 'L'
  if (Math.abs(n) >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'k'
  return '₹' + n.toFixed(2)
}

export function fmtChange(change, pct) {
  const sign = change >= 0 ? '▲' : '▼'
  const abs  = Math.abs(change)
  const absPct = Math.abs(pct)
  return `${sign} ${abs.toFixed(2)} (${absPct.toFixed(2)}%)`
}

export function fmtPnl(n) {
  if (n === undefined || n === null || isNaN(n)) return '₹0.00'
  const sign = n >= 0 ? '+' : '-'
  return sign + '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPct(n) {
  const sign = n >= 0 ? '+' : ''
  return sign + n.toFixed(2) + '%'
}

export function fmtOI(n) {
  if (n >= 1e7) return (n / 1e7).toFixed(2) + 'Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(1) + 'L'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return String(n)
}

export function fmtQty(qty, lotSize) {
  const lots = Math.round(qty / lotSize)
  return { qty, lots, label: `${lots} lot${lots !== 1 ? 's' : ''}` }
}

// ── DOM helpers ────────────────────────────────────────────

export const $ = (sel, ctx = document) => ctx.querySelector(sel)
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)]

export function setTxt(el, txt) {
  if (el) el.textContent = txt
}

export function setClass(el, cls, on) {
  if (!el) return
  on ? el.classList.add(cls) : el.classList.remove(cls)
}

export function toggle(el, cls) {
  if (el) el.classList.toggle(cls)
}

// ── Misc ───────────────────────────────────────────────────

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

let _uid = 0
export function uid() { return ++_uid }
