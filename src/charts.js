// ═══════════════════════════════════════════════════════════
//  CHARTS.JS  —  Lightweight Charts setup + real-time feed
// ═══════════════════════════════════════════════════════════
import { createChart, CrosshairMode, LineStyle, ColorType } from 'lightweight-charts'
import { NIFTY_CE_HISTORY, NIFTY_HISTORY, NIFTY_OPT_HISTORY } from './data.js'

// ── Shared chart options ────────────────────────────────────
const BASE_OPTIONS = {
  layout: {
    background:      { type: ColorType.Solid, color: '#000000' },
    textColor:       '#b2b5be',
    fontFamily:      "'Inter', sans-serif",
    fontSize:        10,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: '#1a1a1a', style: LineStyle.Solid },
    horzLines: { color: '#1a1a1a', style: LineStyle.Solid },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      color:               '#758696',
      width:               1,
      style:               LineStyle.Dashed,
      labelBackgroundColor: '#2a2e39',
    },
    horzLine: {
      color:               '#758696',
      width:               1,
      style:               LineStyle.Dashed,
      labelBackgroundColor: '#2a2e39',
    },
  },
  rightPriceScale: {
    borderColor:  '#2a2e39',
    ticksVisible: false,
    scaleMargins: { top: 0.08, bottom: 0.28 },
  },
  timeScale: {
    borderColor:     '#2a2e39',
    timeVisible:     true,
    secondsVisible:  false,
    fixLeftEdge:     true,
    fixRightEdge:    false,
    barSpacing:      6,
    rightOffset:     3,
    minimumHeight:   22,
  },
  handleScroll: {
    mouseWheel:       true,
    pressedMouseMove: true,
    horzTouchDrag:    true,
    vertTouchDrag:    false, // fix: prevent chart scroll fighting SL/TP vertical handle drags
  },
  handleScale: {
    mouseWheel:           true,
    pinch:                true,
    axisPressedMouseMove: true,
    axisDoubleClickReset: true,
  },
  autoSize: true, // fix: library manages ResizeObserver internally; applyOptions({width,height}) was wrong API
}

const CANDLE_UP_COLOR   = '#26a69a'
const CANDLE_DOWN_COLOR = '#ef5350'

// ── Chart instances ─────────────────────────────────────────
let ceChart = null, ceSeries = null, ceVolSeries = null
let underlyingChart = null, underlyingSeries = null, underlyingVolSeries = null
let peChart = null, peSeries = null, peVolSeries = null

// Crosshair unsubscribe handles — keyed by chartId
const _crosshairUnsubs = {}

function makeCandleSeries(chart) {
  return chart.addCandlestickSeries({
    upColor:         CANDLE_UP_COLOR,
    downColor:       CANDLE_DOWN_COLOR,
    borderUpColor:   CANDLE_UP_COLOR,
    borderDownColor: CANDLE_DOWN_COLOR,
    wickUpColor:     CANDLE_UP_COLOR,
    wickDownColor:   CANDLE_DOWN_COLOR,
    // Prevent the price axis from ever rendering negative labels.
    // The 28% bottom margin can push the scale below zero when the
    // option's all-time range is wide (e.g. PE at 49 after starting at 320).
    // We clamp minValue to 0; the margin then extends downward from 0, not below it.
    autoscaleInfoProvider: orig => {
      const res = orig()
      if (!res) return res
      res.priceRange.minValue = Math.max(0, res.priceRange.minValue)
      return res
    },
  })
}

function makeVolSeries(chart) {
  const s = chart.addHistogramSeries({
    priceFormat:      { type: 'volume' },
    priceScaleId:     'vol',
    color:            '#26a69a',
    lastValueVisible: false, // fix: was showing floating volume label on price axis
    priceLineVisible: false, // fix: was drawing a dashed line at last volume bar height
  })
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
  return s
}

const VISIBLE_BARS = 80 // bars shown on load — keeps price range tight so scale stays positive

function _showRecentBars(chart, totalBars) {
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, totalBars - VISIBLE_BARS),
    to:   totalBars + 3, // 3-bar right offset (breathing room on right edge)
  })
}

function volBars(history) {
  return history.map(b => ({
    time:  b.time,
    value: b.volume,
    color: b.close >= b.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
  }))
}

// ── Init ────────────────────────────────────────────────────
export function initCharts() {
  const ceEl         = document.getElementById('ce-chart')
  const underlyingEl = document.getElementById('underlying-chart')
  const peEl         = document.getElementById('pe-chart')
  if (!ceEl || !underlyingEl || !peEl) return

  // ── CE chart (left) ──
  ceChart      = createChart(ceEl, BASE_OPTIONS)
  ceSeries     = makeCandleSeries(ceChart)
  ceVolSeries  = makeVolSeries(ceChart)
  ceSeries.setData(NIFTY_CE_HISTORY)
  ceVolSeries.setData(volBars(NIFTY_CE_HISTORY))
  _showRecentBars(ceChart, NIFTY_CE_HISTORY.length)

  // ── Underlying chart (center) ──
  underlyingChart     = createChart(underlyingEl, BASE_OPTIONS)
  underlyingSeries    = makeCandleSeries(underlyingChart)
  underlyingVolSeries = makeVolSeries(underlyingChart)
  underlyingSeries.setData(NIFTY_HISTORY)
  underlyingVolSeries.setData(volBars(NIFTY_HISTORY))
  _showRecentBars(underlyingChart, NIFTY_HISTORY.length)

  // ── PE chart (right) ──
  peChart     = createChart(peEl, BASE_OPTIONS)
  peSeries    = makeCandleSeries(peChart)
  peVolSeries = makeVolSeries(peChart)
  peSeries.setData(NIFTY_OPT_HISTORY)
  peVolSeries.setData(volBars(NIFTY_OPT_HISTORY))
  _showRecentBars(peChart, NIFTY_OPT_HISTORY.length)
}

// Force-resize all visible charts — call after toggling chart-wrapper visibility.
// autoSize handles container changes automatically, but toggling display:none and
// back can confuse it; this nudges the charts after the element becomes visible again.
export function resizeCharts() {
  const ceEl         = document.getElementById('ce-chart')
  const underlyingEl = document.getElementById('underlying-chart')
  const peEl         = document.getElementById('pe-chart')
  // fix: use resize() not applyOptions() — resize() is the correct lightweight-charts resize API
  if (ceEl?.clientWidth > 0 && ceChart)
    ceChart.resize(ceEl.clientWidth, ceEl.clientHeight, true)
  if (underlyingEl?.clientWidth > 0 && underlyingChart)
    underlyingChart.resize(underlyingEl.clientWidth, underlyingEl.clientHeight, true)
  if (peEl?.clientWidth > 0 && peChart)
    peChart.resize(peEl.clientWidth, peEl.clientHeight, true)
}

// ── Real-time candle updates ─────────────────────────────────
export function updateCECandle(bar) {
  if (!ceSeries) return
  ceSeries.update(bar)
  ceVolSeries.update({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)' })
}

export function updateUnderlyingCandle(bar) {
  if (!underlyingSeries) return
  underlyingSeries.update(bar)
  underlyingVolSeries.update({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)' })
}

export function updatePECandle(bar) {
  if (!peSeries) return
  peSeries.update(bar)
  peVolSeries.update({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)' })
}

// ── Switch option contract ───────────────────────────────────
export function switchCEChart(newHistory) {
  if (!ceSeries) return
  ceSeries.setData(newHistory)
  ceVolSeries.setData(volBars(newHistory))
  _showRecentBars(ceChart, newHistory.length)
}

export function switchPEChart(newHistory) {
  if (!peSeries) return
  peSeries.setData(newHistory)
  peVolSeries.setData(volBars(newHistory))
  _showRecentBars(peChart, newHistory.length)
}

// ── Limit-order price lines ──────────────────────────────────
const _orderLines = {}
export function drawOrderLine(chartId, orderId, price, color = '#F59E0B', title = 'Limit', lineStyle = LineStyle.Dashed) {
  const series = chartId === 'ce' ? ceSeries : chartId === 'underlying' ? underlyingSeries : peSeries
  if (!series) return
  // Remove existing line with this id to avoid invisible orphan lines
  if (_orderLines[orderId]) {
    try { _orderLines[orderId].series.removePriceLine(_orderLines[orderId].line) } catch {}
    delete _orderLines[orderId]
  }
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
      color:            entry.color,
      lineWidth:        1,
      lineStyle:        entry.lineStyle,
      axisLabelVisible: true,
      title:            entry.title,
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
  const color = side === 'BUY' ? '#26a69a' : '#ef5350'
  const line  = series.createPriceLine({
    price, color, lineWidth: 2, lineStyle: LineStyle.Solid,
    axisLabelVisible: true, title: side === 'BUY' ? 'Long' : 'Short',
  })
  _orderLines[posId] = { chartId, line, series }
}

export function getVisibleRanges() {
  return {
    ce:         ceChart?.timeScale().getVisibleLogicalRange()         ?? null,
    underlying: underlyingChart?.timeScale().getVisibleLogicalRange() ?? null,
    pe:         peChart?.timeScale().getVisibleLogicalRange()         ?? null,
  }
}

export function restoreVisibleRanges(ranges) {
  if (ranges.ce         && ceChart)         ceChart.timeScale().setVisibleLogicalRange(ranges.ce)
  if (ranges.underlying && underlyingChart)  underlyingChart.timeScale().setVisibleLogicalRange(ranges.underlying)
  if (ranges.pe         && peChart)         peChart.timeScale().setVisibleLogicalRange(ranges.pe)
}

export function destroy() {
  Object.values(_crosshairUnsubs).forEach(unsub => unsub?.())
  ceChart?.remove(); underlyingChart?.remove(); peChart?.remove()
  ceChart = underlyingChart = peChart = null
  ceSeries = underlyingSeries = peSeries = null
  ceVolSeries = underlyingVolSeries = peVolSeries = null
}

// ── Price-scale / time-scale change subscription ─────────────
// Fires whenever the user pans, zooms, or the visible range changes.
// Used to re-anchor overlays (DOM panel, bid/ask tags) after chart scroll.
export function subscribeChartRangeChange(chartId, callback) {
  const [chart] = _chartMap()[chartId] || []
  if (!chart) return () => {}
  const unsub1 = chart.timeScale().subscribeVisibleTimeRangeChange(callback)
  // Also catch vertical (price-scale) drag — LightweightCharts fires a crosshair
  // move on every mousemove during axis drag so we can reuse that signal.
  return () => { try { chart.timeScale().unsubscribeVisibleTimeRangeChange(callback) } catch {} }
}

// ── Crosshair subscription ────────────────────────────────────
const _chartMap = () => ({
  ce:         [ceChart,         ceSeries],
  underlying: [underlyingChart, underlyingSeries],
  pe:         [peChart,         peSeries],
})

export function subscribeChartCrosshair(chartId, callback) {
  const [chart, series] = _chartMap()[chartId] || []
  if (!chart || !series) return

  // fix: unsubscribe any previous handler for this chartId before registering a new one —
  // prevents duplicate handlers accumulating if called more than once
  if (_crosshairUnsubs[chartId]) {
    _crosshairUnsubs[chartId]()
    delete _crosshairUnsubs[chartId]
  }

  const handler = param => {
    if (!param.point) { callback(null); return }
    const cursorPrice = series.coordinateToPrice(param.point.y)
    callback({ x: param.point.x, y: param.point.y, price: cursorPrice ?? null })
  }
  chart.subscribeCrosshairMove(handler)
  _crosshairUnsubs[chartId] = () => chart.unsubscribeCrosshairMove(handler)
}

// ── DOM optimal-zoom snap ─────────────────────────────────────
// Snaps price scale to centerPrice ± halfRange.
// Sequence: enable autoScale → set fixed provider → render → lock scale → restore provider.
// After snap the scale stays locked; user can drag price axis to zoom freely,
// or double-click price axis to reset to full autoscale.
export function snapPriceRange(chartId, centerPrice, halfRange) {
  const [chart, series] = _chartMap()[chartId] || []
  if (!chart || !series) return

  // 1. Ensure autoScale is on so autoscaleInfoProvider is honoured
  chart.applyOptions({ rightPriceScale: { autoScale: true } })

  // 2. Override autoscaleInfoProvider to force the tight range
  series.applyOptions({
    autoscaleInfoProvider: () => ({
      priceRange: { minValue: centerPrice - halfRange, maxValue: centerPrice + halfRange },
    }),
  })

  // 3. After the chart renders at the snapped range, disable autoScale to lock it,
  //    then restore the default (clamp-to-zero) autoscaleInfoProvider
  setTimeout(() => {
    chart.applyOptions({ rightPriceScale: { autoScale: false } })
    series.applyOptions({
      autoscaleInfoProvider: orig => {
        const res = orig()
        if (!res) return res
        res.priceRange.minValue = Math.max(0, res.priceRange.minValue)
        return res
      },
    })
  }, 150)
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
