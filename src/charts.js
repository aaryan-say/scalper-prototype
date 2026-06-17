// ═══════════════════════════════════════════════════════════
//  CHARTS.JS  —  Lightweight Charts setup + real-time feed
// ═══════════════════════════════════════════════════════════
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'
import { NIFTY_CE_HISTORY, NIFTY_HISTORY, NIFTY_OPT_HISTORY } from './data.js'

// ── Shared chart options ────────────────────────────────────
const BASE_OPTIONS = {
  layout: {
    background:       { color: '#161820' },
    textColor:        '#6B7280',
    fontFamily:       "'Inter', sans-serif",
    fontSize:         10,
    attributionLogo:  false,
  },
  grid: {
    vertLines: { color: '#1E2232', style: LineStyle.Solid },
    horzLines: { color: '#1E2232', style: LineStyle.Solid },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: '#555870', width: 1, style: LineStyle.Dashed },
    horzLine: { color: '#555870', width: 1, style: LineStyle.Dashed },
  },
  rightPriceScale: {
    borderColor: '#2A2D3E',
    scaleMargins: { top: 0.08, bottom: 0.28 },
  },
  timeScale: {
    borderColor:     '#2A2D3E',
    timeVisible:      true,
    secondsVisible:   false,
    fixLeftEdge:      true,
    fixRightEdge:     false,
    barSpacing:       6,
    rightOffset:      3,
  },
  handleScroll:  { mouseWheel: true, pressedMouseMove: true },
  handleScale:   { mouseWheel: true, pinch: true },
}

const CANDLE_UP_COLOR   = '#00C853'
const CANDLE_DOWN_COLOR = '#EF4444'

// ── Chart instances ─────────────────────────────────────────
let ceChart = null, ceSeries = null, ceVolSeries = null
let underlyingChart = null, underlyingSeries = null, underlyingVolSeries = null
let peChart = null, peSeries = null, peVolSeries = null

const _resizeObservers = []

function makeCandleSeries(chart) {
  return chart.addCandlestickSeries({
    upColor:         CANDLE_UP_COLOR,
    downColor:       CANDLE_DOWN_COLOR,
    borderUpColor:   CANDLE_UP_COLOR,
    borderDownColor: CANDLE_DOWN_COLOR,
    wickUpColor:     CANDLE_UP_COLOR,
    wickDownColor:   CANDLE_DOWN_COLOR,
  })
}

function makeVolSeries(chart) {
  const s = chart.addHistogramSeries({
    priceFormat:  { type: 'volume' },
    priceScaleId: 'vol',
    color:        '#26a69a',
  })
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
  return s
}

function volBars(history) {
  return history.map(b => ({
    time:  b.time,
    value: b.volume,
    color: b.close >= b.open ? 'rgba(0,200,83,0.4)' : 'rgba(239,68,68,0.4)',
  }))
}

// ── Init ────────────────────────────────────────────────────
export function initCharts() {
  const ceEl         = document.getElementById('ce-chart')
  const underlyingEl = document.getElementById('underlying-chart')
  const peEl         = document.getElementById('pe-chart')
  if (!ceEl || !underlyingEl || !peEl) return

  // ── CE chart (left) ──
  ceChart      = createChart(ceEl, { ...BASE_OPTIONS, width: ceEl.clientWidth, height: ceEl.clientHeight })
  ceSeries     = makeCandleSeries(ceChart)
  ceVolSeries  = makeVolSeries(ceChart)
  ceSeries.setData(NIFTY_CE_HISTORY)
  ceVolSeries.setData(volBars(NIFTY_CE_HISTORY))
  ceChart.timeScale().fitContent()

  // ── Underlying chart (center) ──
  underlyingChart     = createChart(underlyingEl, { ...BASE_OPTIONS, width: underlyingEl.clientWidth, height: underlyingEl.clientHeight })
  underlyingSeries    = makeCandleSeries(underlyingChart)
  underlyingVolSeries = makeVolSeries(underlyingChart)
  underlyingSeries.setData(NIFTY_HISTORY)
  underlyingVolSeries.setData(volBars(NIFTY_HISTORY))
  underlyingChart.timeScale().fitContent()

  // ── PE chart (right) ──
  peChart     = createChart(peEl, { ...BASE_OPTIONS, width: peEl.clientWidth, height: peEl.clientHeight })
  peSeries    = makeCandleSeries(peChart)
  peVolSeries = makeVolSeries(peChart)
  peSeries.setData(NIFTY_OPT_HISTORY)
  peVolSeries.setData(volBars(NIFTY_OPT_HISTORY))
  peChart.timeScale().fitContent()

  // ── ResizeObservers ──
  const ro = new ResizeObserver(() => {
    // Guard: skip resize when element is hidden (clientWidth=0 would corrupt chart)
    if (ceEl.clientWidth > 0 && ceChart)
      ceChart.applyOptions({ width: ceEl.clientWidth, height: ceEl.clientHeight })
    if (underlyingEl.clientWidth > 0 && underlyingChart)
      underlyingChart.applyOptions({ width: underlyingEl.clientWidth, height: underlyingEl.clientHeight })
    if (peEl.clientWidth > 0 && peChart)
      peChart.applyOptions({ width: peEl.clientWidth, height: peEl.clientHeight })
  })
  ro.observe(ceEl)
  ro.observe(underlyingEl)
  ro.observe(peEl)
  _resizeObservers.push(ro)
}

// Force-resize all visible charts — call after toggling chart-wrapper visibility
export function resizeCharts() {
  const ceEl         = document.getElementById('ce-chart')
  const underlyingEl = document.getElementById('underlying-chart')
  const peEl         = document.getElementById('pe-chart')
  if (ceEl?.clientWidth > 0 && ceChart)
    ceChart.applyOptions({ width: ceEl.clientWidth, height: ceEl.clientHeight })
  if (underlyingEl?.clientWidth > 0 && underlyingChart)
    underlyingChart.applyOptions({ width: underlyingEl.clientWidth, height: underlyingEl.clientHeight })
  if (peEl?.clientWidth > 0 && peChart)
    peChart.applyOptions({ width: peEl.clientWidth, height: peEl.clientHeight })
}

// ── Real-time candle updates ─────────────────────────────────
export function updateCECandle(bar) {
  if (!ceSeries) return
  ceSeries.update(bar)
  ceVolSeries.update({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? 'rgba(0,200,83,0.4)' : 'rgba(239,68,68,0.4)' })
}

export function updateUnderlyingCandle(bar) {
  if (!underlyingSeries) return
  underlyingSeries.update(bar)
  underlyingVolSeries.update({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? 'rgba(0,200,83,0.4)' : 'rgba(239,68,68,0.4)' })
}

export function updatePECandle(bar) {
  if (!peSeries) return
  peSeries.update(bar)
  peVolSeries.update({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? 'rgba(0,200,83,0.4)' : 'rgba(239,68,68,0.4)' })
}

// ── Switch option contract ───────────────────────────────────
export function switchCEChart(newHistory) {
  if (!ceSeries) return
  ceSeries.setData(newHistory)
  ceVolSeries.setData(volBars(newHistory))
  ceChart.timeScale().fitContent()
}

export function switchPEChart(newHistory) {
  if (!peSeries) return
  peSeries.setData(newHistory)
  peVolSeries.setData(volBars(newHistory))
  peChart.timeScale().fitContent()
}

// ── Limit-order price lines ──────────────────────────────────
const _orderLines = {}
export function drawOrderLine(chartId, orderId, price, color = '#F59E0B', title = 'Limit', lineStyle = LineStyle.Dashed) {
  const series = chartId === 'ce' ? ceSeries : chartId === 'underlying' ? underlyingSeries : peSeries
  if (!series) return
  const line = series.createPriceLine({
    price, color, lineWidth: 1, lineStyle,
    axisLabelVisible: true, title,
  })
  _orderLines[orderId] = { chartId, line, series, price, color, title, lineStyle }
  return line
}

export function updateOrderLine(orderId, price) {
  const entry = _orderLines[orderId]
  if (!entry) return
  entry.price = price
  try {
    entry.line.applyOptions({ price })
  } catch {
    try { entry.series.removePriceLine(entry.line) } catch {}
    entry.line = entry.series.createPriceLine({
      price,
      color: entry.color,
      lineWidth: 1,
      lineStyle: entry.lineStyle,
      axisLabelVisible: true,
      title: entry.title,
    })
  }
}

export function removeOrderLine(orderId) {
  const entry = _orderLines[orderId]
  if (!entry) return
  try { entry.series.removePriceLine(entry.line) } catch {}
  delete _orderLines[orderId]
}

export function drawPositionLine(chartId, posId, price, side) {
  const series = chartId === 'ce' ? ceSeries : chartId === 'underlying' ? underlyingSeries : peSeries
  if (!series) return
  const color = side === 'BUY' ? '#00C853' : '#EF4444'
  const line  = series.createPriceLine({
    price, color, lineWidth: 2, lineStyle: LineStyle.Solid,
    axisLabelVisible: true, title: side === 'BUY' ? 'Long' : 'Short',
  })
  _orderLines[posId] = { chartId, line, series }
}

export function destroy() {
  _resizeObservers.forEach(ro => ro.disconnect())
  ceChart?.remove(); underlyingChart?.remove(); peChart?.remove()
  ceChart = underlyingChart = peChart = null
  ceSeries = underlyingSeries = peSeries = null
  ceVolSeries = underlyingVolSeries = peVolSeries = null
}

// ── Crosshair subscription ────────────────────────────────────
const _chartMap  = () => ({ ce: [ceChart, ceSeries], underlying: [underlyingChart, underlyingSeries], pe: [peChart, peSeries] })
export function subscribeChartCrosshair(chartId, callback) {
  const [chart, series] = _chartMap()[chartId] || []
  if (!chart || !series) return
  chart.subscribeCrosshairMove(param => {
    if (!param.point) { callback(null); return }
    const cursorPrice = series.coordinateToPrice(param.point.y)
    callback({ x: param.point.x, y: param.point.y, price: cursorPrice ?? null })
  })
}

// ── Price → screen Y (pixels within chart-body element) ──────
export function getPriceY(chartId, price) {
  const [, series] = _chartMap()[chartId] || []
  if (!series) return null
  return series.priceToCoordinate(price)
}

export function getPriceFromY(chartId, y) {
  const [, series] = _chartMap()[chartId] || []
  if (!series) return null
  return series.coordinateToPrice(y)
}
