// ═══════════════════════════════════════════════════════════
//  MAIN.JS  —  bootstrap, wire everything together
// ═══════════════════════════════════════════════════════════
// Force full page reload on HMR — avoids dead price engine after hot swap
if (import.meta.hot) import.meta.hot.decline()
import { initCharts, updateCECandle, updateUnderlyingCandle, updatePECandle, switchCEChart, switchPEChart, drawOrderLine, updateOrderLine, removeOrderLine, drawPositionLine, subscribeChartCrosshair, getPriceY, getPriceFromY, resizeCharts, getVisibleRanges, restoreVisibleRanges } from './charts.js'
import { priceEngine, currentPrices, INSTRUMENTS, buildOptionChain, generateHistory } from './data.js'
import * as store from './store.js'
import { $, $$, fmtPrice, fmtPriceShort, fmtChange, fmtPnl, fmtPct, fmtOI } from './utils.js'

// ── App state ───────────────────────────────────────────────
let oneClickOn        = false
let _visibleCharts    = { ce: true, underlying: true, pe: true }
let ceQty             = 250
let peQty             = 500
const NIFTY_LOT       = 50
let pendingOrderSide  = null
let pendingOrderChart = null   // 'ce' | 'pe'
let _switchingLeg     = 'ce'  // which leg the switch panel was opened for
let _oisSide          = 'ce'  // calls or puts toggle in OI surface view
let _orderFlyoutMode  = ''
let _orderOverlayState = {
  side: 'BUY',
  chart: 'ce',
  instrumentId: '',
  instrumentName: 'DELHIVERY',
  price: 450.75,
  change: -2.85,
  pct: -0.63,
  secondaryPrice: 450.00,
  product: 'delivery',
  priceMode: 'market',
  quantity: 1,
  validity: 'IOC',
  slExpanded: false,
  advancedExpanded: false,
  slOn: false,
  tpOn: false,
  trailingOn: false,
  slMode: 'Market',
  tpMode: 'Market',
  slPrice: 441.74,
  slPct: 2,
  tpPrice: 459.76,
  tpPct: 2,
  trailJump: 0.05,
  advancedTab: 'entry',
  entryTrigger: false,
  iceberg: false,
  entryTime: false,
  exitTime: false,
  triggerWhen: 'moves above',
  triggerPrice: 450.85,
  legs: 1,
}

const _basePrice = { ...currentPrices }
const HEADER_MIN_PINNED = 2
const HEADER_INDEX_ITEMS = [
  { key: 'NIFTY', label: 'NIFTY 50', menuLabel: 'NIFTY', price: 28048.65, delta: 241.25, pct: 0.95, currency: true },
  { key: 'SENSEX', label: 'SENSEX', menuLabel: 'SENSEX', price: 25648.65, delta: 191.91, pct: 0.75, currency: true },
  { key: 'BANKNIFTY', label: 'BANKNIFTY', menuLabel: 'BANKNIFTY', price: 55293.65, delta: 1238.30, pct: 2.29, currency: false },
  { key: 'BANKEX', label: 'BANKEX', menuLabel: 'BANKEX', price: 62289.98, delta: 1385.53, pct: 2.27, currency: false },
  { key: 'MIDCPNIFTY', label: 'MIDCPNIFTY', menuLabel: 'MIDCPNIFTY', price: 14559.90, delta: 178.35, pct: 1.24, currency: false },
  { key: 'FINNIFTY', label: 'FINNIFTY', menuLabel: 'FINNIFTY', price: 26102.15, delta: 570.65, pct: 2.24, currency: false },
  { key: 'NIFTYNXT50', label: 'NIFTYNXT50', menuLabel: 'NIFTYNXT50', price: 70815.85, delta: 1032.80, pct: 1.48, currency: false },
  { key: 'INDIA VIX', label: 'INDIA VIX', menuLabel: 'INDIA VIX', price: 16.70, delta: -1.21, pct: -6.76, currency: false, noCurrency: true },
]
const OPTION_METRIC_CONFIG = {
  pcr: {
    id: 'metric-pcr',
    label: 'PCR',
    tooltip: value => `Put Call Ratio: ${value.toFixed(2)}`,
    format: value => value.toFixed(2),
    icon: '<path d="M5 5h10M5 15h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M7 3l-2 2 2 2M13 13l2 2-2 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  maxPain: {
    id: 'metric-max-pain',
    label: 'Max Pain',
    tooltip: value => `Max Pain: ${Math.round(value)}`,
    format: value => Math.round(value).toString(),
    icon: '<circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="10" r="2.2" stroke="currentColor" stroke-width="1.4"/><path d="M10 1.8v3M10 15.2v3M1.8 10h3M15.2 10h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  },
  atmIv: {
    id: 'metric-atm-iv',
    label: 'IV',
    tooltip: value => `ATM Implied Volatility: ${value.toFixed(2)}`,
    format: value => value.toFixed(2),
    icon: '<path d="M2.5 12.2c2.1-5.8 3.9-5.8 5.5 0s3.4 5.8 5.5 0 3.3-5.8 4-2.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 16h14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>',
  },
  ivPercentile: {
    id: 'metric-iv-percentile',
    label: 'IV Percentile',
    tooltip: value => `IV Percentile: ${value.toFixed(2)} - ${ivPercentileLabel(value)}`,
    format: value => Math.round(value).toString(),
    icon: '<path d="M4 13a6 6 0 1 1 12 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10 13l3.8-4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="13" r="1.3" fill="currentColor"/>',
  },
  gex: {
    id: 'metric-gex',
    label: 'GEX',
    tooltip: value => `Gamma Exposure: ${value >= 0 ? '+' : ''}${value.toFixed(1)}B — Dealers ${value >= 0.5 ? 'long gamma (suppressing volatility)' : value <= -0.5 ? 'short gamma (amplifying moves)' : 'near gamma flip'}`,
    format: value => `${value >= 0 ? '+' : ''}${value.toFixed(1)}B`,
    icon: '<path d="M3 14c1.5-4 3-4 4.5 0s3 4 4.5 0 2.5-4 4-1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10 4v3M10 4l-1.5 2M10 4l1.5 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  gammaRegime: {
    id: 'metric-gamma-regime',
    label: 'Regime',
    tooltip: value => `Gamma Regime: ${gammaRegimeLabel(value)} — ${value >= 60 ? 'range-bound, mean-reverting' : value <= 40 ? 'trending, high volatility' : 'transitioning, unstable'}`,
    format: value => gammaRegimeLabel(value),
    icon: '<rect x="3" y="12" width="3" height="5" rx="1" fill="currentColor" opacity=".45"/><rect x="8.5" y="8" width="3" height="9" rx="1" fill="currentColor" opacity=".7"/><rect x="14" y="4" width="3" height="13" rx="1" fill="currentColor"/>',
  },
}
let _pinnedIndices = HEADER_INDEX_ITEMS.map(item => item.key)
let _enabledOptionMetrics = { pcr: true, maxPain: false, atmIv: true, ivPercentile: false, gex: true, gammaRegime: true }
let _optionMetricTimer = null

// Shared container for all chart overlays (position labels, "+" buttons, popups)
let _chartOverlayContainer = null
const _posOverlays = {}   // posId → { chartId, el, entryPrice, chartEl }
const _priceHandles = {}  // id → draggable limit / SL / TP chart handles

// ── Toast notifications ──────────────────────────────────────
function showToast(message, type = 'info') {
  const el = document.createElement('div')
  el.className = `app-toast app-toast--${type}`
  el.textContent = message
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add('app-toast--visible'))
  setTimeout(() => {
    el.classList.remove('app-toast--visible')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }, 3500)
}

// ── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Overlay container lives in body so it's never clipped by chart-wrapper's overflow:hidden
  _chartOverlayContainer = document.createElement('div')
  _chartOverlayContainer.id = 'chart-overlays'
  Object.assign(_chartOverlayContainer.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '60',
  })
  document.body.appendChild(_chartOverlayContainer)

  initCharts()
  seedPriceEngine()
  wireTopBar()
  wirePnlSwitcher()
  wireNavbar()
  wireSubHeader()
  wireBuySellBars()
  wireContextMenus()
  wireTradingDefaultsModal()
  wireSwitchLegPanel()
  wireChartOverview()
  wireDraggableTfSelectors()
  wireOrderOverlay()
  wirePnlPanel()
  wireDepth()
  wireTradePresets()
  loadTradingDefaultsIntoModal()
  wireCrosshairButtons()
  wireChartVisibility()
  wireDrawingToolbar()
  wireChartToast()
  startPositionOverlayLoop()
  startPriceHandleLoop()
  priceEngine.start()
})

// ── Seed price engine ────────────────────────────────────────
function seedPriceEngine() {
  priceEngine.register('NIFTY',  currentPrices.NIFTY,  0.0008)
  priceEngine.register('SENSEX', currentPrices.SENSEX, 0.0008)
  // CE/PE use delta-linked pricing — must register AFTER NIFTY so it's in the tick loop first
  priceEngine.registerOption('NIFTY_27500CE', currentPrices.NIFTY_27500CE, {
    underlying: 'NIFTY', strike: 27500, type: 'CE', tte: 0.08, iv: 0.22,
  })
  priceEngine.registerOption('NIFTY_27500PE', currentPrices.NIFTY_27500PE, {
    underlying: 'NIFTY', strike: 27500, type: 'PE', tte: 0.08, iv: 0.22,
  })

  store.updatePrice('NIFTY',         currentPrices.NIFTY)
  const _ceBA = priceEngine.getBidAsk('NIFTY_27500CE')
  const _peBA = priceEngine.getBidAsk('NIFTY_27500PE')
  store.updatePrice('NIFTY_27500CE', currentPrices.NIFTY_27500CE, _ceBA.bid, _ceBA.ask)
  store.updatePrice('NIFTY_27500PE', currentPrices.NIFTY_27500PE, _peBA.bid, _peBA.ask)

  priceEngine.on('tick', ({ id, price, bid, ask }) => {
    store.updatePrice(id, price, bid, ask)
    _checkRiskLevels(id, price)
    updateDepthOnTick(id, price, bid, ask)
    if (id === 'NIFTY')         { updateNiftyChip(price); updateUnderlyingHeader(price) }
    if (id === 'NIFTY_27500CE') { updateCEHeader(price); _updateTpaPrice('ce', price) }
    if (id === 'NIFTY_27500PE') { updatePEHeader(price); _updateTpaPrice('pe', price) }
    if (id === 'SENSEX')        updateSensexChip(price)
    if (id === 'NIFTY' && _oiProfileOn) _drawOiProfile()
  })

  priceEngine.on('candleUpdate', ({ id, bar }) => {
    if (id === 'NIFTY')         updateUnderlyingCandle(bar)
    if (id === 'NIFTY_27500CE') updateCECandle(bar)
    if (id === 'NIFTY_27500PE') updatePECandle(bar)
  })
}

// ── Top bar price updates ────────────────────────────────────
function updateNiftyChip(price) {
  const base    = _basePrice.NIFTY
  const change  = price - base
  const pct     = (change / base) * 100
  updateTickerIndexChip('NIFTY', price, change, pct)
}

function updateSensexChip(price) {
  const base    = _basePrice.SENSEX
  const change  = price - base
  const pct     = (change / base) * 100
  updateTickerIndexChip('SENSEX', price, change, pct)
}

function updateTickerIndexChip(indexKey, price, change, pct) {
  $$('.index-chip').forEach(chip => {
    if (chip.dataset.index !== indexKey) return
    const item = HEADER_INDEX_ITEMS.find(entry => entry.key === indexKey)
    const priceEl = $('.idx-price', chip)
    const deltaEl = $('.idx-delta', chip)
    if (priceEl) priceEl.textContent = item?.currency ? fmtPrice(price) : formatNumberPrice(price, item)
    updateIndexDelta(deltaEl, change, pct)
  })
}

function updateIndexDelta(deltaEl, change, pct) {
  if (!deltaEl) return
  deltaEl.className = 'idx-delta ' + (change >= 0 ? 'up' : 'down')
  deltaEl.innerHTML = indexDeltaMarkup(change, pct)
}

function indexDeltaMarkup(change, pct) {
  const isUp = change >= 0
  return `
    <svg viewBox="0 0 10 10" aria-hidden="true">
      <path d="${isUp ? 'M5 1l4 7H1z' : 'M5 9l4-7H1z'}" fill="currentColor"></path>
    </svg>
    <span>${change >= 0 ? '+' : '-'}${Math.abs(change).toFixed(2)} (${change >= 0 ? '+' : '-'}${Math.abs(pct).toFixed(2)}%)</span>`
}

function formatNumberPrice(value, item) {
  if (item?.noCurrency) return value.toFixed(2)
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatIndexPrice(item) {
  return item.currency ? fmtPrice(item.price) : formatNumberPrice(item.price, item)
}

function updateTopPnl(total) {
  const el = $('#top-pnl')
  if (!el) return
  el.textContent = fmtPnl(total)
  el.className   = 'mc-value ' + (total >= 0 ? 'positive' : 'negative')
}

function updateTopMargin(available) {
  const el = $('#top-margin')
  if (el) el.textContent = fmtPriceShort(available)
}

// ── Sub-header + chart header price updates ──────────────────
let _niftyBase = currentPrices.NIFTY
function updateUnderlyingHeader(price) {
  const change  = price - _niftyBase
  const pct     = (change / _niftyBase) * 100
  // Sub-header (NIFTY 50 overview)
  const priceEl  = $('#sub-price')
  const changeEl = $('#sub-change')
  if (priceEl)  priceEl.textContent = fmtPrice(price)
  if (changeEl) {
    changeEl.textContent = fmtChange(change, pct)
    changeEl.className   = 'sub-change ' + (change >= 0 ? 'up' : 'down')
  }
  // Underlying chart header
  const uPrice  = $('#underlying-chart-price')
  const uChange = $('#underlying-chart-change')
  if (uPrice)  uPrice.textContent = price.toFixed(2)
  if (uChange) {
    uChange.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + ' (' + pct.toFixed(2) + '%)'
    uChange.className   = 'chart-change ' + (change >= 0 ? 'up' : 'down')
  }
}

let _ceBase = currentPrices.NIFTY_27500CE
function updateCEHeader(price) {
  const change = price - _ceBase
  const pct    = (change / _ceBase) * 100
  const el     = $('#ce-chart-price')
  const chEl   = $('#ce-chart-change')
  if (el)   el.textContent = price.toFixed(2)
  if (chEl) {
    chEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + ' (' + pct.toFixed(2) + '%)'
    chEl.className   = 'chart-change ' + (change >= 0 ? 'up' : 'down')
  }
}

let _peBase = currentPrices.NIFTY_27500PE
function updatePEHeader(price) {
  const change = price - _peBase
  const pct    = (change / _peBase) * 100
  const el     = $('#pe-chart-price')
  const chEl   = $('#pe-chart-change')
  if (el)   el.textContent = price.toFixed(2)
  if (chEl) {
    chEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + ' (' + pct.toFixed(2) + '%)'
    chEl.className   = 'chart-change ' + (change >= 0 ? 'up' : 'down')
  }
}

// ── Navbar ───────────────────────────────────────────────────
function wireNavbar() {
  const NAV = ['nav-option-chain', 'nav-order-book', 'nav-chart-analyzer']
  NAV.forEach(id => {
    const el = $(`#${id}`)
    if (!el) return
    el.addEventListener('click', e => {
      e.preventDefault()
      NAV.forEach(i => $(`#${i}`)?.classList.remove('active'))
      el.classList.add('active')
      if (id === 'nav-option-chain') toggleOptionChainPanel()
      if (id === 'nav-order-book')   toggleDepthPanel()
    })
  })
  $('#oc-panel-close')?.addEventListener('click', closeOptionChainPanel)
}

function toggleOptionChainPanel() {
  const panel = $('#option-chain-panel')
  const isOpen = panel.classList.toggle('open')
  if (isOpen) {
    const spot = priceEngine.getPrice('NIFTY') || currentPrices.NIFTY
    const el = $('#oc-spot-val')
    if (el) el.textContent = '₹' + spot.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    renderFullOptionChain(buildOptionChain(spot))
  }
  updateCompactMode()
}

function closeOptionChainPanel() {
  $('#option-chain-panel')?.classList.remove('open')
  $('#nav-option-chain')?.classList.remove('active')
  updateCompactMode()
}

// Compact mode — activated when both panels are open simultaneously
const _COMPACT_LABELS = [
  { id: 'ce-buy',  full: ' Buy Call',  compact: ' B' },
  { id: 'ce-sell', full: ' Sell Call', compact: ' S' },
  { id: 'pe-buy',  full: ' Buy Put',   compact: ' B' },
  { id: 'pe-sell', full: ' Sell Put',  compact: ' S' },
]

function updateCompactMode() {
  const leftOpen  = $('#option-chain-panel')?.classList.contains('open') ||
                    $('#depth-panel')?.classList.contains('open')
  const rightOpen = $('#pnl-panel')?.classList.contains('open')
  const bothOpen  = leftOpen && rightOpen
  $('#trade-module')?.classList.toggle('compact', bothOpen)
  _COMPACT_LABELS.forEach(({ id, full, compact }) => {
    const label = $(`#${id}`)?.querySelector('.btn-label')
    if (label) label.textContent = bothOpen ? compact : full
  })
}

// ── Shared strike switcher — updates BOTH CE and PE charts simultaneously ──
function switchBothLegsToStrike(strike) {
  const seed = parseInt(strike) % 97 + 1
  const ceHist = generateHistory(currentPrices.NIFTY_27500CE, 0.028, 200, seed)
  const peHist = generateHistory(currentPrices.NIFTY_27500PE, 0.028, 200, seed + 7)

  switchCEChart(ceHist)
  _ceBase = ceHist.at(-1).close
  $('#ce-chart-price').textContent = _ceBase.toFixed(2)
  $('#switch-ce-btn').textContent  = `27 Mar ${strike} ▾`
  $('#trade-call-switch strong').innerHTML = `${strike} CALL <span>OTM 28</span>`

  switchPEChart(peHist)
  _peBase = peHist.at(-1).close
  $('#pe-chart-price').textContent = _peBase.toFixed(2)
  $('#switch-pe-btn').textContent  = `27 Mar ${strike} ▾`
  $('#trade-put-switch strong').innerHTML  = `${strike} PUT <span>OTM 13</span>`
}

function _buildupLabel(side) {
  if (side.chgPct > 0.8)  return { label: 'LB', cls: 'lb' }
  if (side.chgPct < -0.8) return { label: 'SC', cls: 'sc' }
  if (side.chgPct > 0)    return { label: 'UW', cls: 'uw' }
  return                         { label: 'SB', cls: 'sb' }
}

function renderFullOptionChain(chain) {
  const tbody = $('#oc-full-tbody')
  if (!tbody) return
  const maxCeOI = Math.max(...chain.map(r => r.ce.oi), 1)
  const maxPeOI = Math.max(...chain.map(r => r.pe.oi), 1)
  tbody.innerHTML = chain.map(row => {
    const rowCls = [row.atm ? 'oc-atm-row' : '', row.ce.itm ? 'itm-c' : '', row.pe.itm ? 'itm-p' : ''].filter(Boolean).join(' ')
    const cePct  = ((row.ce.oi / maxCeOI) * 100).toFixed(1)
    const pePct  = ((row.pe.oi / maxPeOI) * 100).toFixed(1)
    const ceB    = _buildupLabel(row.ce)
    const peB    = _buildupLabel(row.pe)
    const ceCls  = row.ce.chgPct >= 0 ? 'up' : 'down'
    const peCls  = row.pe.chgPct >= 0 ? 'up' : 'down'
    const ceLTP  = row.ce.price < 10 ? row.ce.price.toFixed(2) : row.ce.price.toFixed(1)
    const peLTP  = row.pe.price < 10 ? row.pe.price.toFixed(2) : row.pe.price.toFixed(1)
    return `<tr class="${rowCls}" data-strike="${row.strike}">
      <td class="ft-ce-oi">
        <div class="oc-oi-fill ce" style="width:${cePct}%"></div>
        <div class="oc-oi-content">
          <span class="oc-oi-val">${fmtOI(row.ce.oi)}</span>
          <span class="oc-buildup ${ceB.cls}">${ceB.label}</span>
        </div>
      </td>
      <td class="ft-ce-price">
        <div class="ft-ltp-wrap">
          <span class="ft-ltp ${ceCls}">${ceLTP}</span>
          <span class="ft-ltp-chg ${ceCls}">${row.ce.chgPct >= 0 ? '+' : ''}${row.ce.chgPct.toFixed(1)}%</span>
        </div>
      </td>
      <td class="ft-strike ${row.atm ? 'ft-atm' : ''}">
        ${row.atm ? '<span class="oc-atm-badge">ATM</span>' : ''}
        <span class="oc-strike-num">${row.strike}</span>
      </td>
      <td class="ft-pe-price">
        <div class="ft-ltp-wrap ft-ltp-wrap--pe">
          <span class="ft-ltp ${peCls}">${peLTP}</span>
          <span class="ft-ltp-chg ${peCls}">${row.pe.chgPct >= 0 ? '+' : ''}${row.pe.chgPct.toFixed(1)}%</span>
        </div>
      </td>
      <td class="ft-pe-oi">
        <div class="oc-oi-fill pe" style="width:${pePct}%"></div>
        <div class="oc-oi-content pe">
          <span class="oc-oi-val">${fmtOI(row.pe.oi)}</span>
          <span class="oc-buildup ${peB.cls}">${peB.label}</span>
        </div>
      </td>
    </tr>`
  }).join('')

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      switchBothLegsToStrike(tr.dataset.strike)
      closeOptionChainPanel()
    })
  })
}

// ── Sub-header ───────────────────────────────────────────────
let _oiProfileOn = false

function wireSubHeader() {
  const wrap  = $('#one-click-wrap')
  const track = $('#one-click-track')
  if (wrap) wrap.addEventListener('click', () => {
    oneClickOn = !oneClickOn
    track.classList.toggle('on', oneClickOn)
  })

  $('#oi-profile-btn')?.addEventListener('click', () => {
    _oiProfileOn = !_oiProfileOn
    $('#oi-profile-btn').classList.toggle('active', _oiProfileOn)
    if (_oiProfileOn) {
      _initOiProfileCanvas()
      _drawOiProfile()
    } else {
      _clearOiProfile()
    }
  })

  $('#profile-setting-btn')?.addEventListener('click', () => {
    $('#profile-setting-btn').classList.toggle('active')
  })
}

// ── OI Profile overlay on underlying chart ───────────────────
let _oiProfileCanvas  = null
let _oiProfileRafId   = null

function _initOiProfileCanvas() {
  if (_oiProfileCanvas) return
  const chartEl = $('#underlying-chart')
  if (!chartEl) return
  chartEl.style.position = 'relative'
  _oiProfileCanvas = document.createElement('canvas')
  _oiProfileCanvas.id = 'oi-profile-canvas'
  Object.assign(_oiProfileCanvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '4',
  })
  chartEl.appendChild(_oiProfileCanvas)
}

function _clearOiProfile() {
  if (!_oiProfileCanvas) return
  const ctx = _oiProfileCanvas.getContext('2d')
  ctx.clearRect(0, 0, _oiProfileCanvas.width, _oiProfileCanvas.height)
}

function _drawOiProfile() {
  if (!_oiProfileOn || !_oiProfileCanvas) return
  const chartEl = $('#underlying-chart')
  if (!chartEl) return

  const dpr = window.devicePixelRatio || 1
  const W   = chartEl.offsetWidth
  const H   = chartEl.offsetHeight
  if (!W || !H) return

  _oiProfileCanvas.width  = W * dpr
  _oiProfileCanvas.height = H * dpr
  _oiProfileCanvas.style.width  = W + 'px'
  _oiProfileCanvas.style.height = H + 'px'

  const ctx = _oiProfileCanvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)

  const spot  = priceEngine.getPrice('NIFTY') || currentPrices.NIFTY
  const chain = buildOptionChain(spot)

  const maxOI  = Math.max(...chain.map(r => Math.max(r.ce.oi, r.pe.oi)), 1)
  const maxBar = W * 0.14
  const barH   = Math.max(3, Math.min(14, H / chain.length * 0.65))
  const labelW = 64
  const SCALE_W = 72  // price scale width on right

  chain.forEach(row => {
    const y = getPriceY('underlying', row.strike)
    if (y === null || y < 2 || y > H - 2) return
    const yp = Math.round(y) - barH / 2

    const ceW = (row.ce.oi / maxOI) * maxBar
    const peW = (row.pe.oi / maxOI) * maxBar
    const rightEdge = W - SCALE_W - 4

    // PE bar (green) — further left
    ctx.fillStyle = row.atm ? 'rgba(38,166,154,0.85)' : 'rgba(38,166,154,0.55)'
    ctx.fillRect(rightEdge - ceW - peW - 2, yp, peW, barH)

    // CE bar (red) — closer to right
    ctx.fillStyle = row.atm ? 'rgba(239,83,80,0.85)' : 'rgba(239,83,80,0.55)'
    ctx.fillRect(rightEdge - ceW, yp, ceW, barH)

    // ATM highlight line
    if (row.atm) {
      ctx.strokeStyle = 'rgba(109,124,246,0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(0, Math.round(y)); ctx.lineTo(rightEdge - ceW - peW - 6, Math.round(y)); ctx.stroke()
      ctx.setLineDash([])
    }

    // Strike label
    const isKeyStrike = row.atm || Math.abs(row.strike - Math.round(spot / 100) * 100) % 200 === 0
    if (isKeyStrike && barH >= 6) {
      const lblX = rightEdge - ceW - peW - labelW - 8
      if (lblX > 0) {
        ctx.fillStyle = row.atm ? 'rgba(109,124,246,0.75)' : 'rgba(255,165,0,0.65)'
        ctx.fillRect(lblX, yp + (barH - 14) / 2, labelW, 14)
        ctx.fillStyle = '#fff'
        ctx.font = '9.5px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(row.strike.toLocaleString(), lblX + labelW / 2, yp + barH / 2)
      }
    }
  })

  // Legend
  ctx.font = '9px system-ui'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(239,83,80,0.8)'; ctx.fillRect(8, H - 18, 8, 8)
  ctx.fillStyle = '#94a3b8'; ctx.fillText('CE OI', 20, H - 14)
  ctx.fillStyle = 'rgba(38,166,154,0.8)'; ctx.fillRect(60, H - 18, 8, 8)
  ctx.fillText('PE OI', 72, H - 14)
}

// ── Top bar ──────────────────────────────────────────────────
function wireTopBar() {
  initHeaderPreferences()
  wireIndicesMenu()
  renderOptionsMetrics()
  startOptionsMetricTicker()
  store.on('pnl:updated', ({ totalUnrealized, totalRealized }) => {
    const net = totalUnrealized + totalRealized
    updateTopPnl(net)
    setPnlCardValue('active-pnl-val', totalUnrealized)
    setPnlCardValue('net-pnl-val', net)
  })
  store.on('funds:updated', ({ available }) => updateTopMargin(available))
}

const _optionMetricState = {
  pcr: 1.25,
  maxPain: 23700,
  atmIv: 16.85,
  ivPercentile: 77,
  gex: 2.3,
  gammaRegime: 68,
}

function startOptionsMetricTicker() {
  if (_optionMetricTimer) window.clearInterval(_optionMetricTimer)
  if (!$('#metric-pcr') || !getEnabledOptionMetricKeys().length) return
  _optionMetricTimer = window.setInterval(updateRandomOptionMetric, 30000)
}

function updateRandomOptionMetric() {
  const keys = getEnabledOptionMetricKeys()
  if (!keys.length) return
  const key = keys[Math.floor(Math.random() * keys.length)]
  const previous = _optionMetricState[key]
  let next = previous

  if (key === 'pcr') {
    next = clampNumber(previous + randomStep([-0.05, -0.03, 0.03, 0.05]), 0.65, 1.95)
  } else if (key === 'maxPain') {
    next = clampNumber(previous + randomStep([-100, -50, 50, 100]), 23200, 24800)
  } else if (key === 'atmIv') {
    next = clampNumber(previous + randomStep([-0.35, -0.2, 0.2, 0.35]), 11.5, 24.5)
  } else if (key === 'ivPercentile') {
    next = clampNumber(previous + randomStep([-3, -2, 2, 3]), 5, 95)
  } else if (key === 'gex') {
    next = clampNumber(+(previous + randomStep([-0.4, -0.2, 0.2, 0.4])).toFixed(1), -8, 8)
  } else if (key === 'gammaRegime') {
    next = clampNumber(previous + randomStep([-4, -2, 2, 4]), 5, 95)
  }

  _optionMetricState[key] = next
  renderOptionMetric(key, previous, next)
}

function randomStep(steps) {
  return steps[Math.floor(Math.random() * steps.length)]
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function initHeaderPreferences() {
  try {
    const savedPinned = JSON.parse(localStorage.getItem('headerPinnedIndices') || 'null')
    if (Array.isArray(savedPinned)) {
      const validPinned = savedPinned.filter(key => HEADER_INDEX_ITEMS.some(item => item.key === key))
      if (validPinned.length >= HEADER_MIN_PINNED) _pinnedIndices = validPinned
    }

    const savedMetrics = JSON.parse(localStorage.getItem('headerEnabledMetrics') || 'null')
    if (savedMetrics && typeof savedMetrics === 'object') {
      _enabledOptionMetrics = {
        pcr:          savedMetrics.pcr          !== false,
        maxPain:      savedMetrics.maxPain       !== false,
        atmIv:        savedMetrics.atmIv         !== false,
        ivPercentile: savedMetrics.ivPercentile  !== false,
        gex:          savedMetrics.gex           === true,
        gammaRegime:  savedMetrics.gammaRegime   === true,
      }
    }
  } catch {}

  renderIndexTicker()
  renderIndicesMenuBody()
}

function persistHeaderPreferences() {
  try {
    localStorage.setItem('headerPinnedIndices', JSON.stringify(_pinnedIndices))
    localStorage.setItem('headerEnabledMetrics', JSON.stringify(_enabledOptionMetrics))
  } catch {}
}

function renderIndexTicker() {
  const track = $('#index-ticker-track')
  if (!track) return
  const pinnedItems = HEADER_INDEX_ITEMS.filter(item => _pinnedIndices.includes(item.key))
  const markup = buildTickerSetMarkup(pinnedItems, false) + buildTickerSetMarkup(pinnedItems, true)
  track.innerHTML = markup
}

function buildTickerSetMarkup(items, duplicate) {
  return `
    <div class="ticker-set"${duplicate ? ' aria-hidden="true"' : ''}>
      ${items.map(item => `
        <div class="index-chip" data-index="${item.key}">
          <span class="idx-name">${item.label}</span>
          <span class="idx-price${item.noCurrency ? ' no-currency' : ''}">${formatIndexPrice(item)}</span>
          <span class="idx-delta ${item.delta >= 0 ? 'up' : 'down'}">
            ${indexDeltaMarkup(item.delta, item.pct)}
          </span>
        </div>
      `).join('')}
    </div>
  `
}

function renderIndicesMenuBody() {
  const menuBody = $('#indices-menu-body')
  if (!menuBody) return
  menuBody.innerHTML = `
    <section class="indices-section" aria-label="Header instruments">
      <div class="indices-section-title">Header Instruments</div>
      ${HEADER_INDEX_ITEMS.map(item => buildIndicesRowMarkup(item)).join('')}
    </section>
    <section class="indices-section" aria-label="Signal modules">
      <div class="indices-section-title">
        Signal Modules
        <span class="signal-count-badge${Object.values(_enabledOptionMetrics).filter(Boolean).length >= SIGNAL_MAX ? ' at-max' : ''}">${Object.values(_enabledOptionMetrics).filter(Boolean).length}/${SIGNAL_MAX}</span>
      </div>
      <div class="signal-toggle-list">
        ${Object.entries(OPTION_METRIC_CONFIG).map(([key, config]) => buildSignalToggleMarkup(key, config)).join('')}
      </div>
    </section>
  `
}

function buildIndicesRowMarkup(item) {
  const pinned = _pinnedIndices.includes(item.key)
  const canUnpin = !pinned || _pinnedIndices.length > HEADER_MIN_PINNED
  return `
    <div class="indices-row selected${pinned ? ' pinned' : ''}" data-index="${item.key}" role="menuitem" tabindex="0">
      <span class="im-name">${item.menuLabel}</span>
      <span class="im-price${item.delta < 0 ? ' down' : ''}">${item.noCurrency ? item.price.toFixed(2) : item.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span class="im-delta ${item.delta >= 0 ? 'up' : 'down'}">${indexDeltaMarkup(item.delta, item.pct)}</span>
      <button class="indices-pin-btn" type="button" data-pin-index="${item.key}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${item.menuLabel}" aria-pressed="${pinned ? 'true' : 'false'}"${canUnpin ? '' : ' disabled'}>
        <svg class="idx-pin${pinned ? '' : ' outline'}" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.7 2.8l6.5 6.5-2.4.9-1.8 3.6-2.2-2.2-2.9 2.9-1.1-1.1 2.9-2.9-2.2-2.2 3.6-1.8.9-2.4z" fill="currentColor"/></svg>
      </button>
    </div>
  `
}

function buildSignalToggleMarkup(key, config) {
  const value = _optionMetricState[key]
  const active = _enabledOptionMetrics[key] !== false
  const enabledCount = Object.values(_enabledOptionMetrics).filter(Boolean).length
  const atLimit = !active && enabledCount >= SIGNAL_MAX
  return `
    <button class="signal-toggle-btn${active ? ' active' : ''}${atLimit ? ' at-limit' : ''}" type="button" data-metric-toggle="${key}" aria-pressed="${active ? 'true' : 'false'}" ${atLimit ? `title="Disable another signal to enable ${config.label}"` : ''}>
      <svg class="signal-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">${config.icon}</svg>
      <span class="signal-meta">
        <span class="signal-name">${config.label}</span>
        <span class="signal-value">${config.format(value)}</span>
      </span>
      <span class="signal-toggle-knob" aria-hidden="true"></span>
      ${atLimit ? '<span class="signal-limit-badge">4 max</span>' : ''}
    </button>
  `
}

function renderOptionsMetrics() {
  const wrap = $('#options-metrics')
  if (!wrap) return

  Object.keys(OPTION_METRIC_CONFIG).forEach(key => {
    const config = OPTION_METRIC_CONFIG[key]
    const chip = $(`.om-chip[data-metric="${key}"]`, wrap)
    const valueEl = $(`#${config.id}`)
    if (!chip || !valueEl) return
    const value = _optionMetricState[key]
    valueEl.textContent = config.format(value)
    valueEl.dataset.value = String(value)
    chip.dataset.tooltip = config.tooltip(value)
    chip.classList.toggle('is-high', key === 'ivPercentile' && value >= 70)
    chip.classList.toggle('gex-pos', key === 'gex' && value >= 0.5)
    chip.classList.toggle('gex-neg', key === 'gex' && value <= -0.5)
    chip.classList.toggle('regime-pos', key === 'gammaRegime' && value >= 60)
    chip.classList.toggle('regime-neg', key === 'gammaRegime' && value <= 40)
    chip.style.display = _enabledOptionMetrics[key] === false ? 'none' : ''
  })

  wrap.classList.toggle('is-hidden', !getEnabledOptionMetricKeys().length)
}

function getEnabledOptionMetricKeys() {
  return Object.keys(OPTION_METRIC_CONFIG).filter(key => _enabledOptionMetrics[key] !== false)
}

function renderOptionMetric(key, previous, next) {
  const config = OPTION_METRIC_CONFIG[key]

  const valueEl = $(`#${config.id}`)
  const chip = valueEl?.closest('.om-chip')
  if (!valueEl || !chip) return

  const direction = next >= previous ? 'up' : 'down'
  valueEl.textContent = config.format(next)
  valueEl.dataset.value = String(next)
  chip.dataset.tooltip = config.tooltip(next)

  if (key === 'ivPercentile') chip.classList.toggle('is-high', next >= 70)
  if (key === 'gex') {
    chip.classList.toggle('gex-pos', next >= 0.5)
    chip.classList.toggle('gex-neg', next <= -0.5)
  }
  if (key === 'gammaRegime') {
    chip.classList.toggle('regime-pos', next >= 60)
    chip.classList.toggle('regime-neg', next <= 40)
  }

  renderIndicesMenuBody()
  chip.classList.remove('is-updating', 'metric-updated-up', 'metric-updated-down')
  void chip.offsetWidth
  chip.classList.add('is-updating', `metric-updated-${direction}`)
  window.setTimeout(() => {
    chip.classList.remove('is-updating', 'metric-updated-up', 'metric-updated-down')
  }, 1400)
}

function ivPercentileLabel(value) {
  if (value >= 70) return 'Very High'
  if (value >= 50) return 'High'
  if (value >= 30) return 'Moderate'
  return 'Low'
}

function gammaRegimeLabel(value) {
  if (value >= 60) return 'Positive'
  if (value <= 40) return 'Negative'
  return 'Transition'
}

function wireIndicesMenu() {
  const btn = $('#indices-menu-btn')
  const menu = $('#indices-menu')
  const cluster = $('#index-cluster')
  const viewport = $('#index-ticker-viewport')
  if (!btn || !menu) return

  const setMode = mode => {
    const auto = mode === 'auto'
    cluster?.classList.toggle('auto-scroll', auto)
    $$('.scroll-mode-btn', menu).forEach(item => {
      item.classList.toggle('active', item.dataset.mode === mode)
    })
    try { localStorage.setItem('indexTickerMode', mode) } catch {}
    if (auto && viewport) viewport.scrollLeft = 0
  }

  const close = () => {
    menu.classList.add('hidden')
    btn.classList.remove('open')
    btn.setAttribute('aria-expanded', 'false')
  }
  const open = () => {
    menu.classList.remove('hidden')
    btn.classList.add('open')
    btn.setAttribute('aria-expanded', 'true')
  }

  btn.addEventListener('click', e => {
    e.stopPropagation()
    menu.classList.contains('hidden') ? open() : close()
  })

  menu.addEventListener('click', e => {
    e.stopPropagation()
    const modeBtn = e.target.closest('.scroll-mode-btn')
    if (modeBtn) {
      setMode(modeBtn.dataset.mode === 'auto' ? 'auto' : 'manual')
      return
    }

    const pinBtn = e.target.closest('.indices-pin-btn')
    if (pinBtn) {
      const indexKey = pinBtn.dataset.pinIndex
      togglePinnedIndex(indexKey)
      return
    }

    const metricBtn = e.target.closest('.signal-toggle-btn')
    if (metricBtn) {
      toggleOptionMetric(metricBtn.dataset.metricToggle)
      return
    }

    const row = e.target.closest('.indices-row')
    if (!row) return
    $$('.indices-row', menu).forEach(item => item.classList.toggle('focused', item === row))
    setMode('manual')
    scrollTickerToIndex(row.dataset.index)
  })

  menu.addEventListener('keydown', e => {
    const row = e.target.closest('.indices-row')
    if (!row || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    $$('.indices-row', menu).forEach(item => item.classList.toggle('focused', item === row))
    setMode('manual')
    scrollTickerToIndex(row.dataset.index)
  })

  document.addEventListener('click', close)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close()
  })

  let savedMode = 'auto'
  try { savedMode = localStorage.getItem('indexTickerMode') || 'auto' } catch {}
  setMode(savedMode === 'manual' ? 'manual' : 'auto')
}

function togglePinnedIndex(indexKey) {
  if (!indexKey) return
  const isPinned = _pinnedIndices.includes(indexKey)
  if (isPinned) {
    if (_pinnedIndices.length <= HEADER_MIN_PINNED) return
    _pinnedIndices = _pinnedIndices.filter(key => key !== indexKey)
  } else {
    _pinnedIndices = HEADER_INDEX_ITEMS
      .map(item => item.key)
      .filter(key => key === indexKey || _pinnedIndices.includes(key))
  }
  persistHeaderPreferences()
  renderIndexTicker()
  renderIndicesMenuBody()
}

const SIGNAL_MAX = 4

function toggleOptionMetric(metricKey) {
  if (!OPTION_METRIC_CONFIG[metricKey]) return
  const isOn = _enabledOptionMetrics[metricKey] !== false
  if (!isOn) {
    // Turning ON — check limit
    const enabledCount = Object.values(_enabledOptionMetrics).filter(Boolean).length
    if (enabledCount >= SIGNAL_MAX) {
      // Flash the panel to indicate the limit is reached
      const list = $('.signal-toggle-list')
      if (list) {
        list.classList.remove('signal-limit-flash')
        void list.offsetWidth
        list.classList.add('signal-limit-flash')
      }
      return
    }
  }
  _enabledOptionMetrics[metricKey] = isOn ? false : true
  persistHeaderPreferences()
  renderOptionsMetrics()
  renderIndicesMenuBody()
  startOptionsMetricTicker()
}

function scrollTickerToIndex(indexName) {
  const viewport = $('#index-ticker-viewport')
  if (!viewport || !indexName) return
  const chip = $(`.ticker-set:first-child .index-chip[data-index="${indexName}"]`)
  if (!chip) return
  const left = chip.offsetLeft - Math.max(0, (viewport.clientWidth - chip.offsetWidth) / 2)
  viewport.scrollTo({ left, behavior: 'smooth' })
}

function setPnlCardValue(elId, value) {
  const el = $(`#${elId}`)
  if (!el) return
  el.textContent = fmtPnl(value)
  el.className = 'pnl-card-value' + (value === 0 ? '' : value > 0 ? ' pos' : ' neg')
}

// ── Chart Visibility Toggles ─────────────────────────────────
function wireChartVisibility() {
  const controls = $('#chart-vis-controls')
  if (!controls) return
  controls.addEventListener('click', (e) => {
    const btn = e.target.closest('.cv-btn')
    if (!btn) return
    const key = btn.dataset.chart
    const activeCount = Object.values(_visibleCharts).filter(Boolean).length
    if (_visibleCharts[key] && activeCount === 1) {
      // Last active — reject with shake
      btn.classList.add('cv-shake')
      btn.addEventListener('animationend', () => btn.classList.remove('cv-shake'), { once: true })
      return
    }
    _visibleCharts[key] = !_visibleCharts[key]
    btn.classList.toggle('active', _visibleCharts[key])
    _applyChartVisibility()
  })
}

function _applyChartVisibility() {
  const { ce, underlying: ul, pe } = _visibleCharts

  // Snapshot logical ranges before toggling so scroll position survives the hide/show cycle
  const savedRanges = getVisibleRanges()

  // Toggle chart wrappers
  $('#ce-chart-wrapper')?.classList.toggle('cv-hidden', !ce)
  $('#underlying-chart-wrapper')?.classList.toggle('cv-hidden', !ul)
  $('#pe-chart-wrapper')?.classList.toggle('cv-hidden', !pe)

  const dividers = $$('.chart-divider')
  if (dividers[0]) dividers[0].classList.toggle('cv-hidden', !(ce && (ul || pe)))
  if (dividers[1]) dividers[1].classList.toggle('cv-hidden', !(ul && pe))

  requestAnimationFrame(() => requestAnimationFrame(() => {
    resizeCharts()
    restoreVisibleRanges(savedRanges)
  }))
}

// ── PnL Switcher (Active ↔ Net swap) ─────────────────────────
function wirePnlSwitcher() {
  const switcher = $('#pnl-switcher')
  if (!switcher) return
  switcher.addEventListener('click', (e) => {
    const card = e.target.closest('.pnl-card')
    if (!card || card.classList.contains('pnl-card--big')) return
    const big   = switcher.querySelector('.pnl-card--big')
    const small = switcher.querySelector('.pnl-card--small')
    big.classList.replace('pnl-card--big', 'pnl-card--small')
    small.classList.replace('pnl-card--small', 'pnl-card--big')
  })
}

// ── Buy/Sell bars ────────────────────────────────────────────
function wireBuySellBars() {
  // CE steppers
  $('#ce-inc').addEventListener('click',  () => { ceQty += NIFTY_LOT; updateQtyDisplay('ce') })
  $('#ce-dec').addEventListener('click',  () => { ceQty = Math.max(NIFTY_LOT, ceQty - NIFTY_LOT); updateQtyDisplay('ce') })
  // PE steppers
  $('#pe-inc').addEventListener('click',  () => { peQty += NIFTY_LOT; updateQtyDisplay('pe') })
  $('#pe-dec').addEventListener('click',  () => { peQty = Math.max(NIFTY_LOT, peQty - NIFTY_LOT); updateQtyDisplay('pe') })

  // CE buy/sell
  $('#ce-buy').addEventListener('click',  () => handleOrder('BUY',  'ce', 'NIFTY_27500CE'))
  $('#ce-sell').addEventListener('click', () => handleOrder('SELL', 'ce', 'NIFTY_27500CE'))
  // PE buy/sell
  $('#pe-buy').addEventListener('click',  () => handleOrder('BUY',  'pe', 'NIFTY_27500PE'))
  $('#pe-sell').addEventListener('click', () => handleOrder('SELL', 'pe', 'NIFTY_27500PE'))

  // Spot/Futures toggle in underlying bar
  const sfTrack = $('#spot-futures-track')
  let spotMode = true
  if (sfTrack) sfTrack.addEventListener('click', () => {
    spotMode = !spotMode
    sfTrack.classList.toggle('on', spotMode)
    $('#sft-spot')?.classList.toggle('active', spotMode)
    $('#sft-futures')?.classList.toggle('active', !spotMode)
  })
}

function updateQtyDisplay(side) {
  const qty  = side === 'ce' ? ceQty : peQty
  const lots = Math.max(1, Math.round(qty / NIFTY_LOT))
  $(`#${side}-qty`).textContent  = lots
  $(`#${side}-lots`).textContent = `${lots} lot${lots !== 1 ? 's' : ''}`
}

function handleOrder(side, chart, instrumentId) {
  if (oneClickOn) {
    const qty  = chart === 'ce' ? ceQty : peQty
    const inst = INSTRUMENTS[instrumentId] || { name: instrumentId, type: 'option' }
    const order = store.placeMarketOrder(side, instrumentId, qty, inst)
    if (order) flashOrderFeedback(chart, side)
  } else {
    pendingOrderSide  = side
    pendingOrderChart = chart
    showOrderOverlay(side, chart, instrumentId)
  }
}

function flashOrderFeedback(chart, side) {
  const btn = $(`#${chart}-${side.toLowerCase()}`)
  if (!btn) return
  const orig = btn.style.filter
  btn.style.filter = 'brightness(1.4)'
  setTimeout(() => { btn.style.filter = orig }, 200)
}

// ── Context menus ────────────────────────────────────────────
const ctxMenu = $('#context-menu')
let _ctxTarget = null

function wireContextMenus() {
  ['ce-menu-btn', 'underlying-menu-btn', 'pe-menu-btn', 'sub-menu-btn'].forEach(id => {
    const btn = $(`#${id}`)
    if (!btn) return
    btn.addEventListener('click', e => {
      e.stopPropagation()
      _ctxTarget = id
      const rect = btn.getBoundingClientRect()
      ctxMenu.style.top  = (rect.bottom + 4) + 'px'
      ctxMenu.style.left = Math.min(rect.right - 170, window.innerWidth - 180) + 'px'
      ctxMenu.classList.remove('hidden')
    })
  })

  ctxMenu.addEventListener('click', e => {
    const item = e.target.closest('[data-action]')
    if (!item) return
    if (item.dataset.action === 'defaults') openTradingDefaults()
    ctxMenu.classList.add('hidden')
  })

  document.addEventListener('click', () => ctxMenu.classList.add('hidden'))
}

// ── Trading Defaults Modal ────────────────────────────────────
function wireTradingDefaultsModal() {
  $$('[data-td-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('[data-td-tab]').forEach(b => b.classList.remove('active'))
      $$('.tab-panel').forEach(p => p.classList.remove('active'))
      btn.classList.add('active')
      $(`#td-tab-${btn.dataset.tdTab}`).classList.add('active')
    })
  })

  $$('.modal-stepper .stepper-btn[data-inst]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inst   = btn.dataset.inst
      const action = btn.dataset.action
      const valEl  = $(`#qty-${inst}`)
      if (!valEl) return
      let v = parseInt(valEl.textContent) || 0
      v = action === 'inc' ? v + 25 : Math.max(25, v - 25)
      valEl.textContent = v
      updateLotsDisplay(inst, v)
    })
  })

  ;[['price-type-stocks', 'stocks-limit-row'],
    ['price-type-options','options-limit-row'],
    ['price-type-futures','futures-limit-row']].forEach(([selId, rowId]) => {
    const sel = $(`#${selId}`)
    const row = $(`#${rowId}`)
    if (!sel || !row) return
    sel.addEventListener('change', () => {
      row.style.display = sel.value === 'limit' ? 'flex' : 'none'
    })
  })

  const trailTrack = $('#trailing-sl-track')
  let trailOn = false
  if (trailTrack) trailTrack.addEventListener('click', () => {
    trailOn = !trailOn
    trailTrack.classList.toggle('on', trailOn)
  })

  let trailVal = 1
  $('#trailing-inc')?.addEventListener('click', () => { trailVal++; $('#trailing-val').textContent = trailVal })
  $('#trailing-dec')?.addEventListener('click', () => { trailVal = Math.max(1, trailVal - 1); $('#trailing-val').textContent = trailVal })

  $('#td-apply')?.addEventListener('click',  () => { applyTradingDefaultsFromModal(); closeTradingDefaults() })
  $('#td-cancel')?.addEventListener('click', closeTradingDefaults)
  $('#td-close')?.addEventListener('click',  closeTradingDefaults)
  $('#td-reset')?.addEventListener('click',  () => { store.resetTradingDefaults(); loadTradingDefaultsIntoModal() })

  $('#trading-defaults-modal')?.addEventListener('click', e => {
    if (e.target === $('#trading-defaults-modal')) closeTradingDefaults()
  })
}

function updateLotsDisplay(inst, qty) {
  const lotSizes = { NIFTY: 50, BANKNIFTY: 15, FINNIFTY: 25, SENSEX: 10 }
  const ls   = lotSizes[inst] || 1
  const lots = Math.round(qty / ls)
  const el   = $(`#lots-${inst}`)
  if (el) el.textContent = `${lots} lot${lots !== 1 ? 's' : ''}`
}

function openTradingDefaults() { loadTradingDefaultsIntoModal(); $('#trading-defaults-modal').classList.remove('hidden') }
function closeTradingDefaults() { $('#trading-defaults-modal').classList.add('hidden') }

function loadTradingDefaultsIntoModal() {
  const td = store.tradingDefaults
  ;['NIFTY','BANKNIFTY','FINNIFTY','SENSEX'].forEach(inst => {
    const v  = td.qty?.[inst] ?? 235
    const el = $(`#qty-${inst}`)
    if (el) el.textContent = v
    updateLotsDisplay(inst, v)
  })
  ;[['price-type-stocks', td.price?.stocks?.type ?? 'market', 'stocks-limit-row', 'price-limit-stocks', td.price?.stocks?.limitPct ?? 1.25],
    ['price-type-options',td.price?.options?.type ?? 'market','options-limit-row','price-limit-options',td.price?.options?.limitPct ?? 1.25],
    ['price-type-futures',td.price?.futures?.type ?? 'market','futures-limit-row','price-limit-futures',td.price?.futures?.limitPct ?? 1.25]
  ].forEach(([selId, val, rowId, inputId, pct]) => {
    const sel   = $(`#${selId}`)
    const row   = $(`#${rowId}`)
    const input = $(`#${inputId}`)
    if (sel)   sel.value   = val
    if (row)   row.style.display = val === 'limit' ? 'flex' : 'none'
    if (input) input.value = pct
  })
  const trailEl = $('#trailing-sl-track')
  if (trailEl) trailEl.classList.toggle('on', !!td.sl?.trailing)
  const tvEl = $('#trailing-val')
  if (tvEl) tvEl.textContent = td.sl?.trailingPt ?? 1
  const slPct = $('#sl-trigger-pct')
  if (slPct) slPct.value = td.sl?.triggerPct ?? 25
  const tpPct = $('#tp-trigger-pct')
  if (tpPct) tpPct.value = td.tp?.triggerPct ?? 25
}

function applyTradingDefaultsFromModal() {
  const td = { ...store.tradingDefaults }
  td.qty   = {}
  ;['NIFTY','BANKNIFTY','FINNIFTY','SENSEX'].forEach(inst => {
    td.qty[inst] = parseInt($(`#qty-${inst}`)?.textContent) || 235
  })
  td.price = {
    stocks:  { type: $('#price-type-stocks')?.value  ?? 'market', limitPct: parseFloat($('#price-limit-stocks')?.value)  || 1.25 },
    options: { type: $('#price-type-options')?.value ?? 'market', limitPct: parseFloat($('#price-limit-options')?.value) || 1.25 },
    futures: { type: $('#price-type-futures')?.value ?? 'market', limitPct: parseFloat($('#price-limit-futures')?.value) || 1.25 },
  }
  td.sl = {
    type:       $('#sl-price-type')?.value ?? 'market',
    triggerPct: parseFloat($('#sl-trigger-pct')?.value) || 25,
    trailing:   $('#trailing-sl-track')?.classList.contains('on') ?? false,
    trailingPt: parseInt($('#trailing-val')?.textContent) || 1,
  }
  td.tp = {
    type:       $('#tp-price-type')?.value ?? 'market',
    triggerPct: parseFloat($('#tp-trigger-pct')?.value) || 25,
  }
  store.applyTradingDefaults(td)
  // Re-price existing open position SL/TP handles with new percentages
  store.state.positions.forEach(pos => {
    const slId = `risk-${pos.id}-sl`
    const tpId = `risk-${pos.id}-tp`
    const slPx = riskPriceForPosition(pos, 'sl')
    const tpPx = riskPriceForPosition(pos, 'tp')
    if (_priceHandles[slId]) { _priceHandles[slId].price = slPx; updateOrderLine(slId, slPx) }
    if (_priceHandles[tpId]) { _priceHandles[tpId].price = tpPx; updateOrderLine(tpId, tpPx) }
  })
}

// ── Switch Leg Panel ──────────────────────────────────────────
let _switchingChain = []

function wireSwitchLegPanel() {
  $('#trade-call-switch')?.addEventListener('click', e => {
    e.stopPropagation()
    _switchingLeg = 'ce'
    openSwitchLeg('ce', e.currentTarget)
  })

  $('#trade-put-switch')?.addEventListener('click', e => {
    e.stopPropagation()
    _switchingLeg = 'pe'
    openSwitchLeg('pe', e.currentTarget)
  })

  $('#sl-close')?.addEventListener('click', closeSwitchLeg)

  // Tab switching
  $('#sl-tabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.sl-tab')
    if (!tab) return
    const which = tab.dataset.slTab
    $$('.sl-tab').forEach(t => t.classList.toggle('active', t === tab))
    const isChain = which === 'chain'
    $('#sl-chain-view')?.classList.toggle('hidden', !isChain)
    $('#sl-surface-view')?.classList.toggle('hidden', isChain)
    if (!isChain) renderOISurface(_switchingChain, _switchingLeg)
  })

  // Footer "Option chain" link → open left panel
  $('#footer-option-chain')?.addEventListener('click', e => {
    e.preventDefault()
    toggleOptionChainPanel()
  })
}

function openSwitchLeg(leg = _switchingLeg, anchor = null) {
  _switchingLeg = leg
  _oisSide = leg  // CE leg defaults to Calls, PE leg defaults to Puts
  const panel = $('#switch-leg-panel')
  const spot  = priceEngine.getPrice('NIFTY') || currentPrices.NIFTY
  _switchingChain = buildOptionChain(spot)

  // Reset to chain tab
  $$('.sl-tab').forEach(t => t.classList.toggle('active', t.dataset.slTab === 'chain'))
  $('#sl-chain-view')?.classList.remove('hidden')
  $('#sl-surface-view')?.classList.add('hidden')

  renderOptionChain(_switchingChain, leg)
  positionSwitchLegPanel(panel, anchor, leg)
  panel.classList.add('open')
}

function closeSwitchLeg() {
  $('#switch-leg-panel').classList.remove('open')
}

function positionSwitchLegPanel(panel, anchor, leg) {
  if (!panel || !anchor) return
  const rect = anchor.getBoundingClientRect()
  const panelWidth = 318
  const panelHeight = 420
  let left = leg === 'ce' ? rect.left : rect.right - panelWidth
  left = Math.max(72, Math.min(left, window.innerWidth - panelWidth - 24))
  let top = rect.top - panelHeight - 10
  top = Math.max(82, top)
  panel.style.setProperty('--switch-left', `${left}px`)
  panel.style.setProperty('--switch-top', `${top}px`)
}

function renderOptionChain(chain, leg = _switchingLeg) {
  const thead = $('#oc-thead')
  const tbody = $('#oc-tbody')
  if (!tbody) return
  $('#sl-title').textContent = leg === 'ce' ? 'Switch Call Leg' : 'Switch Put Leg'
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th colspan="2" class="calls-col">CALLS</th>
        <th class="strike-col"></th>
        <th colspan="2" class="puts-col">PUTS</th>
      </tr>
      <tr>
        <th class="th-sub-r">OI / Buildup</th>
        <th class="th-sub-r">LTP</th>
        <th class="strike-col">STRIKE</th>
        <th class="th-sub-l">LTP</th>
        <th class="th-sub-l">OI / Buildup</th>
      </tr>`
  }
  const maxCeOI = Math.max(...chain.map(r => r.ce.oi), 1)
  const maxPeOI = Math.max(...chain.map(r => r.pe.oi), 1)
  tbody.innerHTML = chain.map(row => {
    const rowCls = row.atm ? 'oc-atm-row' : ''
    const cePct  = ((row.ce.oi / maxCeOI) * 100).toFixed(1)
    const pePct  = ((row.pe.oi / maxPeOI) * 100).toFixed(1)
    const ceB    = _buildupLabel(row.ce)
    const peB    = _buildupLabel(row.pe)
    const cChg   = row.ce.chgPct >= 0 ? 'up' : 'down'
    const pChg   = row.pe.chgPct >= 0 ? 'up' : 'down'
    return `
      <tr class="${rowCls}" data-strike="${row.strike}">
        <td class="sw-ce-oi">
          <div class="oc-oi-fill ce" style="width:${cePct}%"></div>
          <div class="oc-oi-content">
            <span class="oc-oi-val">${fmtOI(row.ce.oi)}</span>
            <span class="oc-buildup ${ceB.cls}">${ceB.label}</span>
          </div>
        </td>
        <td class="sw-ce-price">
          <span class="sw-ltp ${cChg}">${row.ce.price.toFixed(2)}</span>
        </td>
        <td class="strike-col ${row.atm ? 'ft-atm' : ''}">
          ${row.atm ? '<span class="oc-atm-badge">ATM</span>' : ''}
          <span class="oc-strike-num">${row.strike}</span>
        </td>
        <td class="sw-pe-price">
          <span class="sw-ltp ${pChg}">${row.pe.price.toFixed(2)}</span>
        </td>
        <td class="sw-pe-oi">
          <div class="oc-oi-fill pe" style="width:${pePct}%"></div>
          <div class="oc-oi-content pe">
            <span class="oc-oi-val">${fmtOI(row.pe.oi)}</span>
            <span class="oc-buildup ${peB.cls}">${peB.label}</span>
          </div>
        </td>
      </tr>`
  }).join('')

  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => {
      switchBothLegsToStrike(row.dataset.strike)
      closeSwitchLeg()
    })
  })
}

function renderOISurface(chain, leg = _switchingLeg) {
  const wrap = $('#sl-surface-view')
  if (!wrap || !chain.length) return

  // Expiries — simulated term structure (nearer expiries have more OI at ATM)
  const EXPIRIES = [
    { label: '24 Mar', decay: 1.00 },
    { label: '30 Mar', decay: 0.88 },
    { label: '07 Apr', decay: 0.74 },
    { label: '13 Apr', decay: 0.60 },
    { label: '21 Apr', decay: 0.46 },
    { label: '28 Apr', decay: 0.34 },
  ]

  // Show ~7 strikes centered on ATM
  const atmIdx = chain.findIndex(r => r.atm)
  const center = atmIdx >= 0 ? atmIdx : Math.floor(chain.length / 2)
  const start  = Math.max(0, center - 3)
  const slice  = chain.slice(start, start + 7)

  // Build surface: expiry × strike → OI values (deterministic seeded mock)
  const surface = EXPIRIES.map((exp, ei) => ({
    label: exp.label,
    cells: slice.map((row, si) => {
      const distFromAtm = Math.abs(si - (center - start))
      const bell   = Math.exp(-0.38 * distFromAtm) * exp.decay
      const seedCe = ((ei * 31 + si * 17 + 5) % 97) / 97
      const seedPe = ((ei * 13 + si * 41 + 3) % 97) / 97
      return {
        strike: row.strike,
        atm:    row.atm,
        ce: Math.max(15000, Math.round(650000 * bell * (0.82 + seedCe * 0.36))),
        pe: Math.max(15000, Math.round(650000 * bell * (0.80 + seedPe * 0.40))),
      }
    }),
  }))

  const side    = _oisSide
  const isCall  = side === 'ce'
  const heatRGB = isCall ? '38,166,154' : '239,83,80'

  let maxOI = 0
  surface.forEach(exp => exp.cells.forEach(c => { maxOI = Math.max(maxOI, c[side]) }))

  const d   = new Date()
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const ts  = `Updated 15:30:00 ${d.getDate()} ${MON[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`

  wrap.innerHTML = `
    <div class="ois-hm">
      <div class="ois-hm-controls">
        <button class="ois-side-btn${isCall ? ' active calls' : ''}" data-ois-side="ce">Calls</button>
        <button class="ois-side-btn${!isCall ? ' active puts' : ''}" data-ois-side="pe">Puts</button>
      </div>
      <div class="ois-hm-scroll">
        <table class="ois-hm-table">
          <thead>
            <tr>
              <th class="ois-hm-exp-th"></th>
              ${slice.map(r => `<th class="ois-hm-strike-th${r.atm ? ' atm' : ''}">${(r.strike / 1000).toFixed(0)}K</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${surface.map(exp => `
              <tr>
                <td class="ois-hm-exp-cell">${exp.label}</td>
                ${exp.cells.map(c => {
                  const oi    = c[side]
                  const alpha = ((oi / maxOI) * 0.72).toFixed(2)
                  return `<td class="ois-hm-cell${c.atm ? ' atm' : ''}"
                    style="background:rgba(${heatRGB},${alpha})"
                    data-strike="${c.strike}">${fmtOI(oi)}</td>`
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="ois-hm-footer">
        <div class="ois-legend">
          <span class="ois-legend-label">Low OI</span>
          <div class="ois-legend-bar" style="background:linear-gradient(to right,rgba(${heatRGB},0.06),rgba(${heatRGB},0.75))"></div>
          <span class="ois-legend-label">High OI</span>
        </div>
        <span class="ois-hm-ts">${ts}</span>
      </div>
    </div>
  `

  // Calls / Puts toggle
  wrap.querySelectorAll('.ois-side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _oisSide = btn.dataset.oisSide
      renderOISurface(chain, leg)
    })
  })

  // Click any cell → switch BOTH charts to that strike simultaneously
  wrap.querySelectorAll('.ois-hm-cell[data-strike]').forEach(cell => {
    cell.addEventListener('click', () => {
      switchBothLegsToStrike(cell.dataset.strike)
      closeSwitchLeg()
    })
  })
}

// ── Timeframe selector dropdowns ─────────────────────────────
const TF_OPTIONS = ['1m', '3m', '5m', '15m', '30m', '1H', '4H', '1D']
let _activeTfDropdown = null

function wireTfSelectors() {
  const configs = [
    { btnId: 'ce-tf-btn' },
    { btnId: 'underlying-tf-btn' },
    { btnId: 'pe-tf-btn' },
  ]

  configs.forEach(({ btnId }) => {
    const btn = $(`#${btnId}`)
    if (!btn) return
    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (_activeTfDropdown?.dataset.for === btnId) {
        _closeTfDropdown()
        return
      }
      _closeTfDropdown()
      _openTfDropdown(btn, btnId)
    })
  })

  document.addEventListener('click', _closeTfDropdown)
}

function _openTfDropdown(anchor, btnId) {
  const current = anchor.textContent.trim().replace('▾', '').trim()
  const rect    = anchor.getBoundingClientRect()

  const drop = document.createElement('div')
  drop.className = 'tf-dropdown'
  drop.dataset.for = btnId
  drop.dataset.anchor = btnId

  TF_OPTIONS.forEach(tf => {
    const item = document.createElement('button')
    item.className = 'tf-dropdown-item' + (tf === current ? ' active' : '')
    item.textContent = tf
    item.addEventListener('click', e => {
      e.stopPropagation()
      anchor.textContent = tf + ' ▾'
      _closeTfDropdown()
    })
    drop.appendChild(item)
  })

  // Align below button, flip left if it would overflow right edge
  const dropWidth = 64
  let left = rect.left
  if (left + dropWidth > window.innerWidth - 8) left = rect.right - dropWidth
  drop.style.top  = `${rect.bottom + 4}px`
  drop.style.left = `${left}px`
  document.body.appendChild(drop)
  anchor.classList.add('open')
  _activeTfDropdown = drop
  _activeTfDropdown._anchor = anchor
}

function _closeTfDropdown() {
  if (_activeTfDropdown) {
    _activeTfDropdown._anchor?.classList.remove('open')
    _activeTfDropdown.remove()
    _activeTfDropdown = null
  }
}

// Keep old name as alias so the boot call still works
const wireDraggableTfSelectors = wireTfSelectors

// ── Order Overlay ─────────────────────────────────────────────
function wireOrderOverlay() {
  const overlay = $('#order-overlay')
  if (!overlay) return

  $('#oo-cancel-x')?.addEventListener('click', hideOrderOverlay)
  $('#oo-flyout-close')?.addEventListener('click', hideOrderFlyout)
  $('#oo-confirm')?.addEventListener('click', confirmLimitOrder)

  overlay.addEventListener('click', e => {
    const sideBtn = e.target.closest('[data-oo-side]')
    if (sideBtn) {
      _orderOverlayState.side = sideBtn.dataset.ooSide
      syncTriggerPricesFromOrder()
      renderOrderOverlay()
      return
    }

    const productBtn = e.target.closest('[data-oo-product]')
    if (productBtn) {
      _orderOverlayState.product = productBtn.dataset.ooProduct
      renderOrderOverlay()
      return
    }

    const qtyBtn = e.target.closest('[data-oo-qty]')
    if (qtyBtn) {
      adjustOrderQuantity(qtyBtn.dataset.ooQty === 'inc' ? 1 : -1)
      return
    }

    const trailBtn = e.target.closest('[data-oo-trail]')
    if (trailBtn) {
      _orderOverlayState.trailJump = clampNumber(_orderOverlayState.trailJump + (trailBtn.dataset.ooTrail === 'inc' ? 0.05 : -0.05), 0.05, 5)
      renderOrderOverlay()
      return
    }

    const legsBtn = e.target.closest('[data-oo-legs]')
    if (legsBtn) {
      _orderOverlayState.legs = Math.max(1, _orderOverlayState.legs + (legsBtn.dataset.ooLegs === 'inc' ? 1 : -1))
      renderOrderOverlay()
      return
    }

    const accordionBtn = e.target.closest('[data-oo-accordion]')
    if (accordionBtn) {
      if (accordionBtn.dataset.ooAccordion === 'sltp') _orderOverlayState.slExpanded = !_orderOverlayState.slExpanded
      if (accordionBtn.dataset.ooAccordion === 'advanced') _orderOverlayState.advancedExpanded = !_orderOverlayState.advancedExpanded
      renderOrderOverlay()
      return
    }

    const toggleBtn = e.target.closest('[data-oo-toggle]')
    if (toggleBtn) {
      toggleOrderOverlayFlag(toggleBtn.dataset.ooToggle)
      return
    }

    const tabBtn = e.target.closest('[data-oo-tab]')
    if (tabBtn) {
      _orderOverlayState.advancedTab = tabBtn.dataset.ooTab
      renderOrderOverlay()
      return
    }

    const flyoutBtn = e.target.closest('[data-oo-flyout]')
    if (flyoutBtn) {
      toggleOrderFlyout(flyoutBtn.dataset.ooFlyout)
      return
    }

    if (e.target.closest('#oo-price-mode-btn')) {
      _orderOverlayState.priceMode = _orderOverlayState.priceMode === 'market' ? 'limit' : 'market'
      renderOrderOverlay()
      return
    }

    if (e.target.closest('#oo-sl-mode-btn')) {
      _orderOverlayState.slMode = _orderOverlayState.slMode === 'Market' ? 'Limit' : 'Market'
      renderOrderOverlay()
      return
    }

    if (e.target.closest('#oo-tp-mode-btn')) {
      _orderOverlayState.tpMode = _orderOverlayState.tpMode === 'Market' ? 'Limit' : 'Market'
      renderOrderOverlay()
      return
    }

    if (e.target.closest('#oo-trigger-when-btn')) {
      _orderOverlayState.triggerWhen = _orderOverlayState.triggerWhen === 'moves above' ? 'moves below' : 'moves above'
      renderOrderOverlay()
    }
  })

  $('#oo-limit-input')?.addEventListener('input', e => {
    const value = parseFloat(e.target.value)
    if (!Number.isNaN(value)) _orderOverlayState.price = value
    syncTriggerPricesFromOrder()
    renderOrderOverlay()
  })
}

function showOrderOverlay(side, chart, instrumentId) {
  const overlay = $('#order-overlay')
  if (!overlay) return
  const inst = INSTRUMENTS[instrumentId] || { name: instrumentId, lotSize: 1, type: 'option' }
  const price = priceEngine.getPrice(instrumentId) || 0
  const base = _basePrice[instrumentId] || price || 1
  const change = +(price - base).toFixed(2)
  const pct = base ? +(((price - base) / base) * 100).toFixed(2) : 0
  _orderOverlayState = {
    ..._orderOverlayState,
    side,
    chart,
    instrumentId,
    instrumentName: (inst.name || instrumentId).toUpperCase(),
    price,
    change,
    pct,
    secondaryPrice: Math.max(0, +(price - change).toFixed(2)),
    quantity: Math.max(1, Math.round((chart === 'ce' ? ceQty : peQty) / (inst.lotSize || NIFTY_LOT))),
    slExpanded: false,
    advancedExpanded: false,
    slOn: false,
    tpOn: false,
    trailingOn: false,
    advancedTab: 'entry',
    entryTrigger: false,
    iceberg: false,
    entryTime: false,
    exitTime: false,
  }
  syncTriggerPricesFromOrder()
  positionOrderOverlay(chart)
  renderOrderOverlay()
  overlay.classList.remove('hidden')
}

function hideOrderOverlay() {
  $('#order-overlay').classList.add('hidden')
  hideOrderFlyout()
  pendingOrderSide  = null
  pendingOrderChart = null
}

function confirmLimitOrder() {
  if (!pendingOrderSide || !pendingOrderChart) return

  const instrumentId = _orderOverlayState.instrumentId || (pendingOrderChart === 'ce' ? 'NIFTY_27500CE' : 'NIFTY_27500PE')
  const inst = INSTRUMENTS[instrumentId] || { lotSize: NIFTY_LOT, type: 'option', name: instrumentId }
  const qty = Math.max(1, _orderOverlayState.quantity) * (inst.lotSize || NIFTY_LOT)

  // Block if insufficient margin
  const required = estimateOrderRequirement(inst, _orderOverlayState)
  if (required > store.state.funds.available) {
    hideOrderOverlay()
    return
  }

  const effectivePrice = _orderOverlayState.priceMode === 'limit'
    ? (parseFloat($('#oo-limit-input')?.value) || _orderOverlayState.price)
    : (priceEngine.getPrice(instrumentId) || _orderOverlayState.price)

  const side = _orderOverlayState.side || pendingOrderSide
  if (_orderOverlayState.priceMode === 'market') {
    const order = store.placeMarketOrder(side, instrumentId, qty, inst)
    if (order) flashOrderFeedback(pendingOrderChart, side)
  } else {
    placeChartLimitOrder(side, pendingOrderChart, instrumentId, qty, effectivePrice)
  }

  hideOrderOverlay()
}

function positionOrderOverlay(chart) {
  const overlay = $('#order-overlay')
  const chartEl = $(`#${chart}-chart-wrapper`)
  if (!overlay || !chartEl) return
  const rect = chartEl.getBoundingClientRect()
  const width = 360
  const top = Math.max(44, rect.top + 6)
  let left = chart === 'ce' ? rect.left + 8 : rect.right - width - 8
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12))
  overlay.classList.toggle('is-left', chart === 'ce')
  overlay.classList.toggle('is-right', chart !== 'ce')
  overlay.style.top = `${top}px`
  overlay.style.left = `${left}px`
  overlay.style.bottom = ''
}

function renderOrderOverlay() {
  const overlay = $('#order-overlay')
  if (!overlay) return
  const state = _orderOverlayState
  const sideIsBuy = state.side === 'BUY'
  const instrument = INSTRUMENTS[state.instrumentId] || { type: 'option', lotSize: NIFTY_LOT }
  const required = estimateOrderRequirement(instrument, state)
  const balance = store.state.funds.available
  const needsFunds = required > balance

  $('#oo-summary-title').textContent = state.instrumentName
  $('#oo-current-price').textContent = fmtPrice(state.price)
  $('#oo-summary-change').textContent = `${state.change >= 0 ? '▲' : '▼'} ${Math.abs(state.change).toFixed(2)} (${Math.abs(state.pct).toFixed(2)}%)`
  $('#oo-summary-change').className = `oo-summary-change ${state.change >= 0 ? 'up' : 'down'}`
  $('#oo-summary-secondary').textContent = `BSE ${state.secondaryPrice.toFixed(2)}`
  $('#oo-price-display').textContent = fmtPrice(state.price)
  $('#oo-price-mode-btn').textContent = state.priceMode === 'market' ? 'Market' : 'Limit'
  $('#oo-limit-row').classList.toggle('hidden', state.priceMode !== 'limit')
  $('#oo-limit-input').value = state.price.toFixed(2)
  $('#oo-qty-value').textContent = String(state.quantity)
  $('#oo-qty-caption').textContent = `${state.quantity} ${state.quantity === 1 ? 'lot' : 'lots'}`
  $('#oo-validity-btn').textContent = state.validity
  $('#oo-sl-price').textContent = fmtPrice(state.slPrice)
  $('#oo-sl-pct').textContent = `${state.slPct}%`
  $('#oo-tp-price').textContent = fmtPrice(state.tpPrice)
  $('#oo-tp-pct').textContent = `${state.tpPct}%`
  $('#oo-trail-value').textContent = state.trailJump.toFixed(2)
  $('#oo-trail-note').textContent = state.trailJump.toFixed(2)
  $('#oo-trigger-when-btn').textContent = state.triggerWhen
  $('#oo-entry-trigger-price').textContent = fmtPrice(state.triggerPrice)
  $('#oo-legs-value').textContent = String(state.legs)
  $('#oo-legs-note').textContent = String(state.legs)

  $$('#oo-side-segment .oo-segment-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.ooSide === state.side))
  $$('#oo-product-segment .oo-segment-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.ooProduct === state.product))
  $$('.oo-card').forEach(card => {
    if (card.querySelector('[data-oo-accordion="sltp"]')) card.classList.toggle('open', state.slExpanded)
    if (card.querySelector('[data-oo-accordion="advanced"]')) card.classList.toggle('open', state.advancedExpanded)
  })
  $('#oo-sltp-body').classList.toggle('hidden', !state.slExpanded)
  $('#oo-advanced-body').classList.toggle('hidden', !state.advancedExpanded)
  $('#oo-advanced-entry').classList.toggle('hidden', state.advancedTab !== 'entry')
  $('#oo-advanced-exit').classList.toggle('hidden', state.advancedTab !== 'exit')
  $$('[data-oo-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.ooTab === state.advancedTab))

  setOrderToggleState('sl', state.slOn)
  setOrderToggleState('tp', state.tpOn)
  setOrderToggleState('trailing', state.trailingOn)
  setOrderToggleState('entryTrigger', state.entryTrigger)
  setOrderToggleState('iceberg', state.iceberg)
  setOrderToggleState('entryTime', state.entryTime)
  setOrderToggleState('exitTime', state.exitTime)
  $('#oo-sl-panel').classList.toggle('hidden', !state.slOn)
  $('#oo-trailing-panel').classList.toggle('hidden', !state.trailingOn)
  $('#oo-tp-panel').classList.toggle('hidden', !state.tpOn)
  $('#oo-entry-trigger-panel').classList.toggle('hidden', !state.entryTrigger)
  $('#oo-iceberg-panel').classList.toggle('hidden', !state.iceberg)
  $('#oo-entry-time-panel').classList.toggle('hidden', !state.entryTime)
  $('#oo-exit-time-panel').classList.toggle('hidden', !state.exitTime)
  $('#oo-sl-mode-btn').classList.toggle('hidden', !state.slOn)
  $('#oo-tp-mode-btn').classList.toggle('hidden', !state.tpOn)
  $('#oo-sl-mode-btn').textContent = state.slMode
  $('#oo-tp-mode-btn').textContent = state.tpMode
  $('#oo-required').textContent = fmtPrice(required)
  $('#oo-balance').textContent = fmtPrice(balance)
  $('#oo-warning').classList.toggle('hidden', !needsFunds)
  $('#oo-confirm').textContent = needsFunds ? 'Add Funds' : 'Add To'
  $('#oo-confirm').className = `oo-confirm ${sideIsBuy ? 'buy' : 'sell'}`

  updateOrderFlyoutPosition()
  renderOrderFlyout()
}

function setOrderToggleState(flag, on) {
  const btn = $(`[data-oo-toggle="${flag}"]`)
  if (btn) btn.classList.toggle('on', on)
}

function toggleOrderOverlayFlag(flag) {
  if (flag === 'sl') _orderOverlayState.slOn = !_orderOverlayState.slOn
  if (flag === 'tp') _orderOverlayState.tpOn = !_orderOverlayState.tpOn
  if (flag === 'trailing') _orderOverlayState.trailingOn = !_orderOverlayState.trailingOn
  if (flag === 'entryTrigger') _orderOverlayState.entryTrigger = !_orderOverlayState.entryTrigger
  if (flag === 'iceberg') _orderOverlayState.iceberg = !_orderOverlayState.iceberg
  if (flag === 'entryTime') _orderOverlayState.entryTime = !_orderOverlayState.entryTime
  if (flag === 'exitTime') _orderOverlayState.exitTime = !_orderOverlayState.exitTime
  renderOrderOverlay()
}

function adjustOrderQuantity(direction) {
  const instrument = INSTRUMENTS[_orderOverlayState.instrumentId] || { lotSize: NIFTY_LOT }
  const nextLots = Math.max(1, _orderOverlayState.quantity + direction)
  _orderOverlayState.quantity = nextLots
  if (_orderOverlayState.chart === 'ce') ceQty = nextLots * (instrument.lotSize || NIFTY_LOT)
  if (_orderOverlayState.chart === 'pe') peQty = nextLots * (instrument.lotSize || NIFTY_LOT)
  updateQtyDisplay(_orderOverlayState.chart)
  renderOrderOverlay()
}

function syncTriggerPricesFromOrder() {
  _orderOverlayState.slPrice = +(_orderOverlayState.price * (1 - _orderOverlayState.slPct / 100)).toFixed(2)
  _orderOverlayState.tpPrice = +(_orderOverlayState.price * (1 + _orderOverlayState.tpPct / 100)).toFixed(2)
  _orderOverlayState.triggerPrice = +(_orderOverlayState.price + (_orderOverlayState.triggerWhen === 'moves above' ? 0.30 : -0.30)).toFixed(2)
}

function estimateOrderRequirement(instrument, state) {
  const lotSize = instrument.lotSize || NIFTY_LOT
  const qty = state.quantity * lotSize
  if (instrument.type === 'option') {
    if (state.side === 'SELL') {
      const underlying = store.state.prices.NIFTY || currentPrices.NIFTY
      return Math.round(underlying * lotSize * state.quantity * 0.15)
    }
    return +(state.price * qty).toFixed(2)
  }
  return +(state.price * qty * (state.product === 'delivery' ? 1 : 0.2)).toFixed(2)
}

function toggleOrderFlyout(mode) {
  _orderFlyoutMode = _orderFlyoutMode === mode ? '' : mode
  renderOrderFlyout()
}

function hideOrderFlyout() {
  _orderFlyoutMode = ''
  renderOrderFlyout()
}

function renderOrderFlyout() {
  const flyout = $('#oo-flyout')
  if (!flyout) return
  const active = !!_orderFlyoutMode
  flyout.classList.toggle('hidden', !active)
  $$('.oo-rail-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.ooFlyout === _orderFlyoutMode))
  if (!active) return
  const titles = { book: 'Order Book', defaults: 'Default Settings', alert: `${_orderOverlayState.instrumentName} • NSE`, copy: 'Quick Actions' }
  $('#oo-flyout-title').textContent = titles[_orderFlyoutMode] || 'Panel'
  $$('[data-oo-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.ooPanel !== _orderFlyoutMode))
  updateOrderFlyoutPosition()
}

function updateOrderFlyoutPosition() {
  const flyout = $('#oo-flyout')
  const overlay = $('#order-overlay')
  if (!flyout || !overlay || !_orderFlyoutMode || overlay.classList.contains('hidden')) return
  const overlayRect = overlay.getBoundingClientRect()
  const flyoutWidth = 420
  const gap = 14
  let left = overlayRect.right + gap
  if (left + flyoutWidth > window.innerWidth - 12) left = overlayRect.left - flyoutWidth - gap
  left = Math.max(12, left)
  flyout.style.top = `${overlayRect.top + 10}px`
  flyout.style.left = `${left}px`
}

function placeChartLimitOrder(side, chartId, instrumentId, qty, limitPrice) {
  const inst  = INSTRUMENTS[instrumentId] || { name: instrumentId, type: 'option' }
  const order = store.placeLimitOrder(side, instrumentId, qty, limitPrice, inst)
  if (!order) return null

  const color = side === 'BUY' ? '#00C853' : '#EF4444'
  drawOrderLine(chartId, order.id, limitPrice, color, `${side} LMT`)
  createPriceHandle({
    id: order.id,
    chartId,
    price: limitPrice,
    kind: 'limit',
    side,
    label: `${side} LIMIT`,
    color,
    onDrag(price, phase) {
      updateOrderLine(order.id, price)
      store.updateLimitOrderPrice(order.id, price, { silent: phase === 'move' })
    },
  })
  return order
}

// ── P&L Panel ─────────────────────────────────────────────────
function wirePnlPanel() {
  $('#right-sidebar-tab')?.addEventListener('click', togglePnlPanel)
  $('#pnl-close')?.addEventListener('click', closePnlPanel)

  store.on('positions:updated', renderPositions)
  store.on('orders:updated', orders => {
    renderOrders(orders)
    reconcileOrderHandles()
  })
  store.on('pnl:updated', ({ totalUnrealized, totalRealized }) => {
    const total = totalUnrealized + totalRealized
    setPnlStat('pnl-realized',   totalRealized,   totalRealized >= 0)
    setPnlStat('pnl-unrealized', totalUnrealized, totalUnrealized >= 0)
    setPnlStat('pnl-total',      total,           total >= 0)
    updateTopPnl(total)
  })
}

function setPnlStat(id, val, isPos) {
  const el = $(`#${id}`)
  if (!el) return
  el.textContent = fmtPnl(val)
  el.className = 'pnl-stat-value ' + (val === 0 ? '' : isPos ? 'pos' : 'neg')
}

function togglePnlPanel() {
  $('#pnl-panel').classList.toggle('open')
  const isOpen = $('#pnl-panel').classList.contains('open')
  $('#right-sidebar-tab')?.classList.toggle('active', isOpen)
  if (isOpen) closeDepthPanel()
  updateCompactMode()
}
function closePnlPanel() {
  $('#pnl-panel').classList.remove('open')
  $('#right-sidebar-tab')?.classList.remove('active')
  updateCompactMode()
}

// ── Depth Panel ────────────────────────────────────────────────
const DEPTH_TICK   = 0.25
const DEPTH_LEVELS = 5
let _depthOpen     = false
let _depthTick     = 0

function _updateTpaPrice(side, price) {
  if (_tradePreset === 'default') return
  const btn = $(`#${side}-tpa-price`)
  if (!btn || btn.dataset.mode !== 'mkt') return
  const val = $(`#${side}-tpa-val`)
  if (val) val.textContent = '₹' + price.toFixed(2)
}

// ── Trade Presets ──────────────────────────────────────────
let _tradePreset = 'buy-only'

const _TPA_CFG = [
  { side: 'ce', instrId: 'NIFTY_27500CE', panelSel: '.trade-panel-call' },
  { side: 'pe', instrId: 'NIFTY_27500PE', panelSel: '.trade-panel-put' },
]

function wireTradePresets() {
  const pencilBtn = $('#trade-preset-btn')
  const panel = $('#trade-preset-panel')
  if (!pencilBtn || !panel) return

  // Pencil opens/closes the preset chooser
  pencilBtn.addEventListener('click', e => {
    e.stopPropagation()
    const isOpen = !panel.classList.contains('hidden')
    panel.classList.toggle('hidden', isOpen)
    pencilBtn.classList.toggle('active', !isOpen)
  })

  $('#tpp-close')?.addEventListener('click', () => {
    panel.classList.add('hidden')
    pencilBtn.classList.remove('active')
  })

  // Close on click outside (panel is inside #trade-module so stopPropagation from pencilBtn is enough)
  document.addEventListener('click', e => {
    if (!panel.classList.contains('hidden') &&
        !panel.contains(e.target) &&
        e.target !== pencilBtn &&
        !pencilBtn.contains(e.target)) {
      panel.classList.add('hidden')
      pencilBtn.classList.remove('active')
    }
  })

  // Preset card selection
  $$('.tpp-card').forEach(card => {
    card.addEventListener('click', () => {
      _applyTradePreset(card.dataset.preset)
      panel.classList.add('hidden')
      pencilBtn.classList.remove('active')
    })
  })

  // Wire each panel's smart bar
  _TPA_CFG.forEach(({ side, instrId }) => {
    const _presetSide = () => (_tradePreset === 'buy-only' ? 'BUY' : 'SELL')

    // ── Price toggle: MKT ↔ LMT ──
    $(`#${side}-tpa-price`)?.addEventListener('click', () => _toggleTpaMode(side))

    const limitInput = $(`#${side}-tpa-input`)
    limitInput?.addEventListener('keydown', e => { if (e.key === 'Enter') limitInput.blur() })
    limitInput?.addEventListener('blur', () => {
      if (limitInput.value) {
        const val = $(`#${side}-tpa-val`)
        if (val) val.textContent = '₹' + parseFloat(limitInput.value).toFixed(2)
      }
    })

    // ── +Add ──
    $(`#${side}-tpa-add`)?.addEventListener('click', () => {
      const posSide = _presetSide()
      const pos = store.state.positions.find(p => p.instrumentId === instrId && p.side === posSide)
      if (!pos) return
      const priceBtn = $(`#${side}-tpa-price`)
      const isLimit  = priceBtn?.dataset.mode === 'lmt'
      const instrument = { type: 'option', lotSize: 50, name: pos.name }
      const qty = store.tradingDefaults.qty?.NIFTY || 50
      if (isLimit && limitInput?.value) {
        store.placeLimitOrder(posSide, instrId, qty, parseFloat(limitInput.value), instrument)
      } else {
        store.placeMarketOrder(posSide, instrId, qty, instrument)
      }
    })

    // Open combined SL+TP form (both SL and TP buttons share the same form)
    const _openRiskForm = (focusField) => {
      $(`#${side}-tpa-main`)?.classList.add('hidden')
      $(`#${side}-tpa-sl-form`)?.classList.remove('hidden')
      const pos = store.state.positions.find(p => p.instrumentId === instrId && p.side === _presetSide())
      const slInp = $(`#${side}-tpa-sl-input`)
      if (pos && slInp && !slInp.value) {
        const defaultSl = roundToTick(pos.avgPrice * (1 - (store.tradingDefaults.sl?.triggerPct ?? 1) / 100))
        slInp.value = defaultSl.toFixed(2)
      }
      $(`#${side}-tpa-${focusField}-input`)?.focus()
    }

    $(`#${side}-tpa-sl-open`)?.addEventListener('click', () => _openRiskForm('sl'))
    $(`#${side}-tpa-tp-open`)?.addEventListener('click', () => _openRiskForm('tp'))

    $(`#${side}-tpa-sl-back`)?.addEventListener('click', () => {
      $(`#${side}-tpa-sl-form`)?.classList.add('hidden')
      $(`#${side}-tpa-main`)?.classList.remove('hidden')
    })

    // Trail SL toggle
    $(`#${side}-tpa-trail`)?.addEventListener('click', e => {
      const trailBtn = e.currentTarget
      const isOn = trailBtn.dataset.on === 'true'
      trailBtn.dataset.on = isOn ? 'false' : 'true'
      store.applyTradingDefaults({
        ...store.tradingDefaults,
        sl: { ...store.tradingDefaults.sl, trailing: !isOn },
      })
      _TPA_CFG.forEach(cfg => {
        const other = $(`#${cfg.side}-tpa-trail`)
        if (other) other.dataset.on = isOn ? 'false' : 'true'
      })
    })

    // Set — applies whichever of SL / TP have a value entered
    $(`#${side}-tpa-set-sl`)?.addEventListener('click', () => {
      const pos = store.state.positions.find(p => p.instrumentId === instrId)
      if (!pos) return
      const slPrice = parseFloat($(`#${side}-tpa-sl-input`)?.value)
      const tpPrice = parseFloat($(`#${side}-tpa-tp-input`)?.value)
      if (!isNaN(slPrice) && slPrice > 0) {
        const slId = `risk-${pos.id}-sl`
        drawOrderLine(side, slId, slPrice, '#EF4444', 'SL')
        if (_priceHandles[slId]) { _priceHandles[slId].price = slPrice; _priceHandles[slId].dormant = false }
        else _priceHandles[slId] = { price: slPrice, dormant: false }
      }
      if (!isNaN(tpPrice) && tpPrice > 0) {
        const tpId = `risk-${pos.id}-tp`
        drawOrderLine(side, tpId, tpPrice, '#00C853', 'TP')
        if (_priceHandles[tpId]) { _priceHandles[tpId].price = tpPrice; _priceHandles[tpId].dormant = false }
        else _priceHandles[tpId] = { price: tpPrice, dormant: false }
      }
      $(`#${side}-tpa-sl-form`)?.classList.add('hidden')
      $(`#${side}-tpa-main`)?.classList.remove('hidden')
    })

    // ── Exit ──
    $(`#${side}-tpa-exit`)?.addEventListener('click', () => {
      const pos = store.state.positions.find(p => p.instrumentId === instrId)
      if (pos) store.squareOff(pos.id, 'Smart exit')
    })
  })

  store.on('positions:updated', _syncTpaBars)

  // Apply the initial preset so #trade-module gets the right class on load
  _applyTradePreset(_tradePreset)
}

function _toggleTpaMode(side) {
  const btn   = $(`#${side}-tpa-price`)
  const input = $(`#${side}-tpa-input`)
  const label = btn?.querySelector('.tpa-mode-lbl')
  if (!btn || !input) return
  const isNowLimit = btn.dataset.mode === 'mkt'
  btn.dataset.mode = isNowLimit ? 'lmt' : 'mkt'
  btn.classList.toggle('limit-mode', isNowLimit)
  if (label) label.textContent = isNowLimit ? 'LMT' : 'MKT'
  btn.classList.toggle('hidden', isNowLimit)
  input.classList.toggle('hidden', !isNowLimit)
  if (isNowLimit) {
    const instrId = side === 'ce' ? 'NIFTY_27500CE' : 'NIFTY_27500PE'
    const currentPrice = store.state.prices[instrId]
    if (currentPrice) input.value = currentPrice.toFixed(2)
    input.focus()
    input.select()
  }
}

function _applyTradePreset(preset) {
  _tradePreset = preset
  const module = $('#trade-module')
  if (!module) return
  module.classList.remove('preset-buy-only', 'preset-sell-only')
  if (preset === 'buy-only')  module.classList.add('preset-buy-only')
  if (preset === 'sell-only') module.classList.add('preset-sell-only')
  $$('.tpp-card').forEach(c => c.classList.toggle('active', c.dataset.preset === preset))
  // Reset any open sub-forms
  _TPA_CFG.forEach(({ side }) => {
    $(`#${side}-tpa-sl-form`)?.classList.add('hidden')
    $(`#${side}-tpa-tp-form`)?.classList.add('hidden')
    $(`#${side}-tpa-main`)?.classList.remove('hidden')
  })
  _syncTpaBars()
}

function _syncTpaBars() {
  if (_tradePreset === 'default') {
    _TPA_CFG.forEach(({ panelSel }) => $(panelSel)?.classList.remove('in-position'))
    return
  }
  const posSide = _tradePreset === 'buy-only' ? 'BUY' : 'SELL'
  _TPA_CFG.forEach(({ side, instrId, panelSel }) => {
    const tradePanel = $(panelSel)
    if (!tradePanel) return
    const pos = store.state.positions.find(p => p.instrumentId === instrId && p.side === posSide)
    tradePanel.classList.toggle('in-position', !!pos)
    if (pos) {
      const priceBtn = $(`#${side}-tpa-price`)
      if (priceBtn?.dataset.mode === 'mkt') {
        const val = $(`#${side}-tpa-val`)
        const price = store.state.prices[instrId]
        if (val && price) val.textContent = '₹' + price.toFixed(2)
      }
    }
  })
}

function wireDepth() {
  $('#depth-close')?.addEventListener('click', closeDepthPanel)
}

function toggleDepthPanel() {
  const panel = $('#depth-panel')
  const opening = !panel.classList.contains('open')
  panel.classList.toggle('open')
  _depthOpen = opening
  if (opening) {
    closePnlPanel()
    const ce = store.state.spreads['NIFTY_27500CE']
    const pe = store.state.spreads['NIFTY_27500PE']
    if (ce) _renderDepth('ce', store.state.prices['NIFTY_27500CE'], ce.bid, ce.ask)
    if (pe) _renderDepth('pe', store.state.prices['NIFTY_27500PE'], pe.bid, pe.ask)
  }
  updateCompactMode()
}

function closeDepthPanel() {
  $('#depth-panel')?.classList.remove('open')
  $('#nav-order-book')?.classList.remove('active')
  _depthOpen = false
  updateCompactMode()
}

function _genDepthLevels(bid, ask) {
  const asks = []
  const bids = []
  for (let i = 0; i < DEPTH_LEVELS; i++) {
    const aPrice = +(Math.round((ask + i * DEPTH_TICK) / DEPTH_TICK) * DEPTH_TICK).toFixed(2)
    const bPrice = +(Math.round((bid - i * DEPTH_TICK) / DEPTH_TICK) * DEPTH_TICK).toFixed(2)
    asks.push({ price: aPrice, qty: Math.round((8 + Math.random() * 42) * 50) })
    bids.push({ price: bPrice, qty: Math.round((8 + Math.random() * 42) * 50) })
  }
  return {
    asks: asks.sort((a, b) => b.price - a.price),
    bids: bids.sort((a, b) => b.price - a.price),
  }
}

function _renderDepth(side, price, bid, ask) {
  const levelsEl = $(`#depth-${side}-levels`)
  const ltpEl    = $(`#depth-${side}-ltp`)
  const nameEl   = $(`#depth-${side}-label`)
  if (!levelsEl) return

  if (nameEl) nameEl.textContent = side === 'ce' ? '27500 CE' : '27500 PE'
  if (ltpEl)  ltpEl.textContent  = '₹' + price.toFixed(2)

  const { asks, bids } = _genDepthLevels(bid, ask)
  const maxQty = Math.max(...asks.map(a => a.qty), ...bids.map(b => b.qty), 1)
  const pct = q => ((q / maxQty) * 100).toFixed(1) + '%'
  const fmt = q => q.toLocaleString('en-IN')

  levelsEl.innerHTML =
    asks.map(a => `
      <div class="depth-row ask-row">
        <span class="depth-bid"></span>
        <span class="depth-price">${a.price.toFixed(2)}</span>
        <span class="depth-ask" style="--pct:${pct(a.qty)}">${fmt(a.qty)}</span>
      </div>`).join('') +
    `<div class="depth-row ltp-row">
       <span></span>
       <span class="depth-ltp-val">₹${price.toFixed(2)}</span>
       <span></span>
     </div>` +
    bids.map(b => `
      <div class="depth-row bid-row">
        <span class="depth-bid" style="--pct:${pct(b.qty)}">${fmt(b.qty)}</span>
        <span class="depth-price">${b.price.toFixed(2)}</span>
        <span class="depth-ask"></span>
      </div>`).join('')
}

function updateDepthOnTick(id, price, bid, ask) {
  if (!_depthOpen || !bid || !ask) return
  _depthTick++
  if (_depthTick % 3 !== 0) return
  if (id === 'NIFTY_27500CE') _renderDepth('ce', price, bid, ask)
  if (id === 'NIFTY_27500PE') _renderDepth('pe', price, bid, ask)
}

function renderPositions() {
  const list = $('#positions-list')
  if (!list) return
  const positions = store.state.positions

  if (positions.length === 0) {
    list.innerHTML = '<div class="empty-state">No open positions</div>'
    return
  }

  list.innerHTML = positions.map(pos => {
    const pnlCls = pos.unrealizedPnl >= 0 ? 'pos' : 'neg'
    const pct    = pos.avgPrice > 0 ? ((pos.currentPrice - pos.avgPrice) / pos.avgPrice * 100) : 0
    return `
      <div class="position-row">
        <div class="pos-row-top">
          <span class="pos-name">${pos.name}</span>
          <span class="pos-side-badge ${pos.side.toLowerCase()}">${pos.side}</span>
        </div>
        <div class="pos-row-mid">
          <div class="pos-meta">
            <span class="pos-meta-label">Qty</span>
            <span class="pos-meta-value">${pos.qty}</span>
          </div>
          <div class="pos-meta">
            <span class="pos-meta-label">Entry</span>
            <span class="pos-meta-value">${fmtPrice(pos.avgPrice)}</span>
          </div>
          <div class="pos-meta">
            <span class="pos-meta-label">LTP</span>
            <span class="pos-meta-value">${fmtPrice(pos.currentPrice)}</span>
          </div>
          <div class="pos-meta pos-pnl">
            <span class="pos-pnl-value ${pnlCls}">${fmtPnl(pos.unrealizedPnl)}</span>
            <span class="pos-pnl-pct ${pnlCls}">${fmtPct(pct)}</span>
          </div>
        </div>
        <button class="sq-btn" data-pos-id="${pos.id}">Square Off</button>
      </div>`
  }).join('')

  list.querySelectorAll('.sq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.squareOff(btn.dataset.posId)
      renderPositions()
    })
  })
}

function renderOrders() {
  const list = $('#orders-list')
  if (!list) return
  const orders = store.state.orders

  if (orders.length === 0) {
    list.innerHTML = '<div class="empty-state">No orders placed</div>'
    return
  }

  list.innerHTML = [...orders].reverse().slice(0, 20).map(o => {
    const dotCls   = o.status.toLowerCase()
    const meta     = `${o.type} · ${o.side} · ${o.qty} · ${o.placedAt}`
    const canCancel = o.status === 'PENDING'
    return `
      <div class="order-row">
        <div class="order-status-dot ${dotCls}"></div>
        <div class="order-info">
          <div class="order-name">${o.instrument?.name || o.instrumentId}</div>
          <div class="order-meta">${meta}${o.limitPrice ? ' @ ' + fmtPrice(o.limitPrice) : ''}</div>
        </div>
        ${canCancel ? `<button class="cancel-order-btn" data-order-id="${o.id}">Cancel</button>` : ''}
      </div>`
  }).join('')

  list.querySelectorAll('.cancel-order-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.cancelOrder(btn.dataset.orderId)
      renderOrders()
    })
  })
}

// ── Chart crosshair "+" buttons ───────────────────────────────
function wireCrosshairButtons() {
  const CHARTS = [
    { chartId: 'ce',         elId: 'ce-chart' },
    { chartId: 'underlying', elId: 'underlying-chart' },
    { chartId: 'pe',         elId: 'pe-chart' },
  ]
  let tvPlusHotkey = false

  document.addEventListener('keydown', e => {
    tvPlusHotkey = e.altKey && e.ctrlKey
  })

  document.addEventListener('keyup', e => {
    tvPlusHotkey = e.altKey && e.ctrlKey
    if (!tvPlusHotkey) {
      _chartOverlayContainer?.querySelectorAll('.chart-plus-btn').forEach(btn => {
        btn.dataset.hotkey = 'false'
      })
    }
  })

  CHARTS.forEach(({ chartId, elId }) => {
    const chartEl = $(`#${elId}`)
    if (!chartEl) return

    const btn = document.createElement('button')
    btn.className      = 'chart-plus-btn'
    btn.textContent    = '+'
    btn.dataset.chart  = chartId
    btn.title          = 'Create order, alert, or price line'
    btn.style.display  = 'none'
    _chartOverlayContainer.appendChild(btn)

    const popup = document.createElement('div')
    popup.className = 'chart-order-popup hidden'
    popup.dataset.chart = chartId
    _chartOverlayContainer.appendChild(popup)

    let _hPrice = null

    // "+" tracks only Y (stays at right edge of plot, before price scale)
    const SCALE_W = 72  // approximate right price-scale width in our charts
    subscribeChartCrosshair(chartId, data => {
      if (!data || data.price === null) { btn.style.display = 'none'; return }
      const rect = chartEl.getBoundingClientRect()
      _hPrice = data.price
      btn.style.display = 'flex'
      btn.style.top     = (rect.top + data.y - 10) + 'px'
      btn.style.left    = tvPlusHotkey
        ? (rect.left + data.x - 10) + 'px'
        : (rect.right - SCALE_W - 22) + 'px'
      btn.dataset.hotkey = tvPlusHotkey ? 'true' : 'false'
    })

    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (_hPrice === null) return
      _chartOverlayContainer.querySelectorAll('.chart-order-popup').forEach(p => p.classList.add('hidden'))
      const rect = chartEl.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      const popupW = 220
      const popupH = 186
      // Center horizontally on the button; appear just below it
      let left = Math.round(btnRect.left + btnRect.width / 2 - popupW / 2)
      left = Math.max(rect.left + 4, Math.min(left, window.innerWidth - popupW - 8))
      let top = btnRect.bottom + 6
      if (top + popupH > window.innerHeight - 8) top = btnRect.top - popupH - 6
      top = Math.max(rect.top + 4, top)
      popup.style.top   = top + 'px'
      popup.style.left  = left + 'px'
      popup.style.width = popupW + 'px'
      popup.innerHTML   = buildTradingViewPlusMenuHTML(chartId, _hPrice)
      popup.classList.remove('hidden')
      wireChartPopup(popup, chartId, _hPrice)
    })
  })

  document.addEventListener('click', () => {
    _chartOverlayContainer?.querySelectorAll('.chart-order-popup').forEach(p => p.classList.add('hidden'))
  })
}

function buildTradingViewPlusMenuHTML(chartId, price) {
  const instrId = chartId === 'ce' ? 'NIFTY_27500CE' : chartId === 'pe' ? 'NIFTY_27500PE' : 'NIFTY'
  const inst    = INSTRUMENTS[instrId]
  const name    = inst?.name || instrId
  const qty     = chartId === 'ce' ? ceQty : chartId === 'pe' ? peQty : NIFTY_LOT
  const p       = price.toFixed(2)
  return `
    <div class="cop-price-row">
      <span>At price</span>
      <strong>₹${p}</strong>
    </div>
    <div class="cop-row" data-action="buy-limit">
      <svg class="cop-icon" viewBox="0 0 16 16"><path d="M8 3v10M3 8l5-5 5 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Buy ${qty} <strong>${name}</strong> limit</span>
    </div>
    <div class="cop-row" data-action="sell-limit">
      <svg class="cop-icon sell" viewBox="0 0 16 16"><path d="M8 3v10M3 8l5 5 5-5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Sell ${qty} <strong>${name}</strong> limit</span>
    </div>
    <div class="cop-sep"></div>
    <div class="cop-row" data-action="alert">
      <svg class="cop-icon muted" viewBox="0 0 16 16"><path d="M8 2.5a4 4 0 0 0-4 4v2.1L2.8 11h10.4L12 8.6V6.5a4 4 0 0 0-4-4Z" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/><path d="M6.7 12.3a1.4 1.4 0 0 0 2.6 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <span>Add alert at ₹${p}</span>
    </div>
    <div class="cop-row" data-action="hline">
      <svg class="cop-icon muted" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
      <span>Add horizontal line</span>
    </div>`
}

function buildChartPopupHTML(chartId, price) {
  const instrId  = chartId === 'ce' ? 'NIFTY_27500CE' : chartId === 'pe' ? 'NIFTY_27500PE' : 'NIFTY'
  const inst     = INSTRUMENTS[instrId]
  const name     = inst?.name || instrId
  const qty      = chartId === 'ce' ? ceQty : chartId === 'pe' ? peQty : NIFTY_LOT
  const p        = price.toFixed(2)
  return `
    <div class="cop-row" data-action="buy-limit">
      <svg class="cop-icon" viewBox="0 0 16 16"><path d="M8 3v10M3 8l5-5 5 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Buy ${qty} <strong>${name}</strong> @ ₹${p} limit</span>
    </div>
    <div class="cop-row" data-action="sell-limit">
      <svg class="cop-icon sell" viewBox="0 0 16 16"><path d="M8 3v10M3 8l5 5 5-5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Sell ${qty} <strong>${name}</strong> @ ₹${p} limit</span>
    </div>
    <div class="cop-sep"></div>
    <div class="cop-row" data-action="hline">
      <svg class="cop-icon muted" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
      <span>Draw Horizontal Line at ₹${p}</span>
      <span class="cop-shortcut">Alt+H</span>
    </div>`
}

function wireChartPopup(popup, chartId, price) {
  popup.addEventListener('click', e => {
    e.stopPropagation()
    const row = e.target.closest('[data-action]')
    if (!row) return
    const action  = row.dataset.action
    const instrId = chartId === 'ce' ? 'NIFTY_27500CE' : chartId === 'pe' ? 'NIFTY_27500PE' : 'NIFTY'
    const qty     = chartId === 'ce' ? ceQty : chartId === 'pe' ? peQty : NIFTY_LOT
    if (action === 'buy-limit') {
      placeChartLimitOrder('BUY', chartId, instrId, qty, price)
    } else if (action === 'sell-limit') {
      placeChartLimitOrder('SELL', chartId, instrId, qty, price)
    } else if (action === 'alert') {
      drawOrderLine(chartId, `alert-${Date.now()}`, price, '#F59E0B', 'Alert')
    } else if (action === 'hline') {
      drawOrderLine(chartId, `hline-${Date.now()}`, price, '#6B7FA8', 'Line')
    }
    popup.classList.add('hidden')
  })
}

// ── Draggable chart price handles ─────────────────────────────
function roundToTick(price, tick = 0.05) {
  return +(Math.round(price / tick) * tick).toFixed(2)
}

function removePriceHandle(id) {
  const handle = _priceHandles[id]
  if (!handle) return
  handle.el.remove()
  if (handle.removeLine !== false) removeOrderLine(id)
  delete _priceHandles[id]
}

function createPriceHandle({ id, chartId, price, kind, side, label, color, onDrag, removeLine = true }) {
  removePriceHandle(id)
  const chartEl = $(`#${chartId}-chart`)
  if (!chartEl || !_chartOverlayContainer) return null

  const el = document.createElement('div')
  el.className = `chart-price-handle ${kind} ${side?.toLowerCase() || ''}`
  el.dataset.handleId = id
  el.innerHTML = `
    <span class="cph-grip" aria-hidden="true"></span>
    <span class="cph-label">${label}</span>
    <span class="cph-price">${fmtPrice(price)}</span>`
  _chartOverlayContainer.appendChild(el)

  const handle = { id, chartId, chartEl, el, price, kind, onDrag, removeLine, dragging: false }
  _priceHandles[id] = handle

  const setPrice = (nextPrice, phase) => {
    handle.price = nextPrice
    el.querySelector('.cph-price').textContent = fmtPrice(nextPrice)
    if (typeof onDrag === 'function') onDrag(nextPrice, phase)
    positionPriceHandle(handle)
  }

  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    handle.dragging = true
    el.classList.add('dragging')
    el.setPointerCapture?.(e.pointerId)
    document.body.classList.add('price-handle-dragging')

    const move = ev => {
      const rect = chartEl.getBoundingClientRect()
      const y = Math.max(2, Math.min(ev.clientY - rect.top, rect.height - 2))
      const nextPrice = getPriceFromY(chartId, y)
      if (nextPrice === null || nextPrice === undefined || Number.isNaN(nextPrice)) return
      setPrice(roundToTick(nextPrice), 'move')
    }

    const up = ev => {
      handle.dragging = false
      el.classList.remove('dragging')
      document.body.classList.remove('price-handle-dragging')
      try { el.releasePointerCapture?.(ev.pointerId) } catch {}
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      setPrice(handle.price, 'end')
    }

    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up, { once: true })
  })

  positionPriceHandle(handle)
  return handle
}

function positionPriceHandle(handle) {
  const y = getPriceY(handle.chartId, handle.price)
  const rect = handle.chartEl.getBoundingClientRect()
  if (y === null || y === undefined || y < -8 || y > rect.height + 8) {
    handle.el.style.display = 'none'
    return
  }
  handle.el.style.display = 'flex'
  handle.el.style.top = (rect.top + y - 12) + 'px'
  handle.el.style.left = (rect.right - Math.min(224, Math.max(158, rect.width * 0.38))) + 'px'
}

function startPriceHandleLoop() {
  setInterval(() => {
    Object.values(_priceHandles).forEach(positionPriceHandle)
  }, 120)
}

function reconcileOrderHandles() {
  const livePendingIds = new Set(
    store.state.orders
      .filter(o => o.status === 'PENDING' && o.type === 'LIMIT')
      .map(o => o.id)
  )

  Object.keys(_priceHandles).forEach(id => {
    const handle = _priceHandles[id]
    if (handle.kind === 'risk') return
    if (id.startsWith('risk-')) return
    if (!livePendingIds.has(id)) removePriceHandle(id)
  })
}

// ── On-chart position P&L overlays ───────────────────────────
function _instrToChart(instrId) {
  if (instrId === 'NIFTY_27500CE') return 'ce'
  if (instrId === 'NIFTY_27500PE') return 'pe'
  return 'underlying'
}

function startPositionOverlayLoop() {
  store.on('positions:updated', () => {
    const positions = store.state.positions
    const liveIds   = new Set(positions.map(p => p.id))

    // Remove stale overlays + position lines
    for (const [id, entry] of Object.entries(_posOverlays)) {
      if (!liveIds.has(id)) {
        entry.el.remove()
        removeOrderLine(id)
        removePriceHandle(`risk-${id}-sl`)
        removePriceHandle(`risk-${id}-tp`)
        delete _posOverlays[id]
      }
    }

    // Create new overlays + position lines
    positions.forEach(pos => {
      if (_posOverlays[pos.id]) return
      const chartId = _instrToChart(pos.instrumentId)
      const chartEl = $(`#${chartId}-chart`)
      if (!chartEl) return

      drawPositionLine(chartId, pos.id, pos.avgPrice, pos.side)
      createPositionRiskHandles(pos, chartId)

      const el = document.createElement('div')
      el.className = 'chart-pos-overlay'
      el.dataset.posId = pos.id
      el.innerHTML = _buildPosOverlayHTML(pos)
      el.style.display = 'none'
      _chartOverlayContainer.appendChild(el)
      _posOverlays[pos.id] = { chartId, el, entryPrice: pos.avgPrice, chartEl }

      el.querySelector('.cpo-exit')?.addEventListener('click', e => {
        e.stopPropagation()
        store.squareOff(pos.id)
      })
    })
  })

  // Refresh P&L text + Y position every 300ms
  setInterval(() => {
    const positions = store.state.positions
    positions.forEach(pos => {
      const entry = _posOverlays[pos.id]
      if (!entry) return
      const y    = getPriceY(entry.chartId, entry.entryPrice)
      const rect = entry.chartEl.getBoundingClientRect()
      if (y === null || y === undefined || y < 4 || y > rect.height - 4) {
        entry.el.style.display = 'none'
        return
      }
      const pnl    = pos.unrealizedPnl ?? 0
      const pnlCls = pnl >= 0 ? 'pos' : 'neg'
      const pnlEl  = entry.el.querySelector('.cpo-pnl')
      if (pnlEl) {
        pnlEl.textContent = (pnl >= 0 ? '+' : '') + fmtPnl(pnl)
        pnlEl.className   = 'cpo-pnl ' + pnlCls
      }
      entry.el.style.display = 'flex'
      entry.el.style.top     = (rect.top + y - 13) + 'px'
      entry.el.style.left    = (rect.left + Math.max(6, rect.width * 0.04)) + 'px'
    })
  }, 300)
}

function riskPriceForPosition(pos, type) {
  const pct = type === 'sl'
    ? (store.tradingDefaults.sl?.triggerPct ?? 1)
    : (store.tradingDefaults.tp?.triggerPct ?? 1)
  const direction = pos.side === 'BUY'
    ? (type === 'sl' ? -1 : 1)
    : (type === 'sl' ? 1 : -1)
  return roundToTick(pos.avgPrice * (1 + direction * pct / 100))
}

function createPositionRiskHandles(pos, chartId) {
  const riskDefs = [
    { type: 'sl', label: 'SL', color: '#EF4444' },
    { type: 'tp', label: 'TP', color: '#00C853' },
  ]

  riskDefs.forEach(({ type, label, color }) => {
    const id = `risk-${pos.id}-${type}`
    const price = riskPriceForPosition(pos, type)
    drawOrderLine(chartId, id, price, color, label)
    createPriceHandle({
      id,
      chartId,
      price,
      kind: 'risk',
      side: type,
      label,
      color,
      onDrag(nextPrice) {
        updateOrderLine(id, nextPrice)
        const h = _priceHandles[id]
        if (h) { h.price = nextPrice; h.dormant = false }
      },
    })
  })
}

function _checkRiskLevels(instrumentId, price) {
  const positions = store.state.positions.filter(p => p.instrumentId === instrumentId)
  for (const pos of positions) {
    if (pos._squaringOff) continue

    const slHandle = _priceHandles[`risk-${pos.id}-sl`]
    if (slHandle && !slHandle.dormant) {
      const slHit = pos.side === 'BUY' ? price <= slHandle.price : price >= slHandle.price
      if (slHit) {
        pos._squaringOff = true
        showToast(`SL hit @ ₹${price.toFixed(2)} — position closed`, 'danger')
        setTimeout(() => store.squareOff(pos.id, 'SL triggered'), 0)
        continue
      }
    }

    const tpHandle = _priceHandles[`risk-${pos.id}-tp`]
    if (tpHandle && !tpHandle.dormant) {
      const tpHit = pos.side === 'BUY' ? price >= tpHandle.price : price <= tpHandle.price
      if (tpHit) {
        pos._squaringOff = true
        showToast(`TP hit @ ₹${price.toFixed(2)} — position closed`, 'success')
        setTimeout(() => store.squareOff(pos.id, 'TP triggered'), 0)
      }
    }
  }
}

// ── Drawing Toolbar ──────────────────────────────────────────
function wireDrawingToolbar() {
  const toolbar = $('#drawing-toolbar')
  if (!toolbar) return

  toolbar.addEventListener('click', e => {
    const btn = e.target.closest('.dt-btn')
    if (!btn) return
    const tool = btn.dataset.tool

    // Stateful toggles — don't change the selected drawing tool
    if (tool === 'sync') {
      btn.classList.toggle('dt-sync-btn')
      return
    }
    if (tool === 'lock' || tool === 'hide' || tool === 'trash') return

    // All other tools are mutually exclusive drawing modes
    $$('.dt-btn', toolbar).forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    if (!['crosshair', 'cursor'].includes(tool)) {
      showToast(`${btn.title || tool} — drawing tools are UI mockups, not yet wired to chart events`, 'info')
    }
  })
}

function _buildPosOverlayHTML(pos) {
  const sideCls = pos.side === 'BUY' ? 'buy' : 'sell'
  return `
    <div class="cpo-bar ${sideCls}"></div>
    <div class="cpo-body">
      <span class="cpo-side ${sideCls}">${pos.side}</span>
      <span class="cpo-entry">@ ${pos.avgPrice.toFixed(2)}</span>
      <span class="cpo-pnl">₹0.00</span>
      <button class="cpo-exit">Exit</button>
    </div>`
}

// ═══════════════════════════════════════════════════════════
//  CHART OVERVIEW PANEL — Analytics Chart Selector
// ═══════════════════════════════════════════════════════════
let _covOpen         = false
let _covSelectedType = 'oi'
let _covHeroData     = null
let _covHeroTick     = 0

const COV_CHART_TYPES = [
  { id: 'oi',               label: 'Open Interest',       icon: `<rect x="4" y="8" width="5" height="20" rx=".5" fill="#ef5350" opacity=".75"/><rect x="10" y="13" width="5" height="15" rx=".5" fill="#26a69a" opacity=".75"/><rect x="18" y="3" width="5" height="25" rx=".5" fill="#ef5350" opacity=".75"/><rect x="24" y="5" width="5" height="23" rx=".5" fill="#26a69a" opacity=".75"/><rect x="32" y="10" width="5" height="18" rx=".5" fill="#ef5350" opacity=".75"/><rect x="38" y="15" width="5" height="13" rx=".5" fill="#26a69a" opacity=".75"/><line x1="2" y1="28" x2="42" y2="28" stroke="#334155" stroke-width="1"/>` },
  { id: 'oi-change',        label: 'OI Change',           icon: `<line x1="2" y1="16" x2="42" y2="16" stroke="#334155" stroke-width="1"/><rect x="4" y="8" width="5" height="8" rx=".5" fill="#26a69a" opacity=".8"/><rect x="11" y="16" width="5" height="7" rx=".5" fill="#ef5350" opacity=".8"/><rect x="18" y="6" width="5" height="10" rx=".5" fill="#26a69a" opacity=".8"/><rect x="25" y="16" width="5" height="5" rx=".5" fill="#ef5350" opacity=".8"/><rect x="32" y="10" width="5" height="6" rx=".5" fill="#26a69a" opacity=".8"/><rect x="39" y="16" width="4" height="9" rx=".5" fill="#ef5350" opacity=".8"/>` },
  { id: 'multi-strike-oi',  label: 'Multi-Strike OI',     icon: `<polyline points="2,22 10,18 18,14 26,10 34,13 42,8" stroke="#ef5350" stroke-width="1.5" fill="none"/><polyline points="2,24 10,21 18,23 26,17 34,13 42,18" stroke="#26a69a" stroke-width="1.5" fill="none"/><polyline points="2,27 10,25 18,21 26,19 34,22 42,16" stroke="#60c0f0" stroke-width="1.5" fill="none"/>` },
  { id: 'total-oi-spot',    label: 'Total OI vs Spot',    icon: `<path d="M2,22 L10,18 L18,14 L26,18 L34,12 L42,10 L42,28 L2,28 Z" fill="rgba(38,166,154,0.2)"/><polyline points="2,22 10,18 18,14 26,18 34,12 42,10" stroke="#26a69a" stroke-width="1.5" fill="none"/><polyline points="2,25 10,22 18,20 26,16 34,19 42,14" stroke="#60c0f0" stroke-width="1.2" fill="none" stroke-dasharray="2,1"/>` },
  { id: 'strangle',         label: 'Strangle',            icon: `<path d="M2,8 L14,20 L22,26 L30,20 L42,8" stroke="#ef5350" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><line x1="2" y1="15" x2="42" y2="12" stroke="#60c0f0" stroke-width="1.2"/>` },
  { id: 'straddle',         label: 'Straddle',            icon: `<path d="M2,10 L16,24 L22,27 L28,24 L42,10" stroke="#f59e0b" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><line x1="2" y1="16" x2="42" y2="13" stroke="#60c0f0" stroke-width="1.2"/>` },
  { id: 'iv-smile',         label: 'Implied Volatility',  icon: `<path d="M2,5 C10,22 17,28 22,28 C27,28 34,22 42,5" stroke="#f59e0b" stroke-width="2" fill="none" stroke-linecap="round"/><line x1="22" y1="4" x2="22" y2="28" stroke="#334155" stroke-width="1" stroke-dasharray="2,2"/>` },
  { id: 'multi-strike-iv',  label: 'Multi-Strike IV',     icon: `<polyline points="2,6 10,12 18,16 26,14 34,12 42,8" stroke="#ef5350" stroke-width="1.5" fill="none"/><polyline points="2,12 10,16 18,20 26,18 34,16 42,12" stroke="#f59e0b" stroke-width="1.5" fill="none"/><polyline points="2,18 10,21 18,25 26,23 34,21 42,17" stroke="#26a69a" stroke-width="1.5" fill="none"/>` },
  { id: 'atm-vol',          label: 'ATM Vol vs Spot',     icon: `<polyline points="2,22 8,18 14,14 20,17 26,12 32,15 38,11 42,13" stroke="#f59e0b" stroke-width="1.8" fill="none"/><polyline points="2,24 8,22 14,20 20,18 26,21 32,17 38,19 42,16" stroke="#60c0f0" stroke-width="1.2" fill="none" stroke-dasharray="2,1"/>` },
  { id: 'time-lapse-skew',  label: 'Time Lapse Skew',     icon: `<path d="M2,6 C10,20 17,26 22,27 C27,26 34,20 42,6" stroke="#ef5350" stroke-width="1.5" fill="none" opacity=".35"/><path d="M2,8 C10,21 17,26 22,26 C27,26 34,21 42,8" stroke="#f59e0b" stroke-width="1.5" fill="none" opacity=".6"/><path d="M2,12 C10,23 17,27 22,28 C27,27 34,23 42,12" stroke="#26a69a" stroke-width="2" fill="none"/>` },
  { id: 'volume',           label: 'Volume',              icon: `<rect x="3" y="14" width="4" height="14" rx=".5" fill="#26a69a" opacity=".8"/><rect x="8" y="19" width="4" height="9" rx=".5" fill="#ef5350" opacity=".8"/><rect x="15" y="9" width="4" height="19" rx=".5" fill="#26a69a" opacity=".8"/><rect x="20" y="13" width="4" height="15" rx=".5" fill="#ef5350" opacity=".8"/><rect x="27" y="7" width="4" height="21" rx=".5" fill="#26a69a" opacity=".8"/><rect x="32" y="14" width="4" height="14" rx=".5" fill="#ef5350" opacity=".8"/><rect x="39" y="16" width="4" height="12" rx=".5" fill="#26a69a" opacity=".8"/><line x1="1" y1="28" x2="43" y2="28" stroke="#334155" stroke-width="1"/>` },
  { id: 'vol-change',       label: 'Volume Change',       icon: `<line x1="2" y1="16" x2="42" y2="16" stroke="#334155" stroke-width="1"/><rect x="3" y="10" width="5" height="6" rx=".5" fill="#26a69a" opacity=".8"/><rect x="10" y="16" width="5" height="8" rx=".5" fill="#ef5350" opacity=".8"/><rect x="17" y="7" width="5" height="9" rx=".5" fill="#26a69a" opacity=".8"/><rect x="24" y="16" width="5" height="4" rx=".5" fill="#ef5350" opacity=".8"/><rect x="31" y="9" width="5" height="7" rx=".5" fill="#26a69a" opacity=".8"/><rect x="38" y="16" width="4" height="10" rx=".5" fill="#ef5350" opacity=".8"/>` },
  { id: 'multi-strike-vol', label: 'Multi-Strike Volume', icon: `<polyline points="2,26 10,22 18,20 26,16 34,14 42,10" stroke="#ef5350" stroke-width="1.5" fill="none"/><polyline points="2,24 10,20 18,22 26,18 34,15 42,17" stroke="#26a69a" stroke-width="1.5" fill="none"/><polyline points="2,28 10,26 18,24 26,22 34,21 42,19" stroke="#60c0f0" stroke-width="1.5" fill="none"/>` },
  { id: 'pcr',              label: 'Put Call Ratio',      icon: `<polyline points="2,20 8,16 14,12 20,18 26,10 32,14 38,12 42,15" stroke="#a78bfa" stroke-width="2" fill="none"/><polyline points="2,22 8,20 14,18 20,16 26,19 32,15 38,17 42,14" stroke="#60c0f0" stroke-width="1.2" fill="none" stroke-dasharray="2,1"/>` },
  { id: 'gamma-exp',        label: 'Gamma Exposure',      icon: `<line x1="2" y1="20" x2="42" y2="20" stroke="#334155" stroke-width="1"/><rect x="3" y="22" width="4" height="6" rx=".5" fill="#ef5350" opacity=".7"/><rect x="9" y="16" width="4" height="4" rx=".5" fill="#ef5350" opacity=".7"/><rect x="15" y="10" width="4" height="10" rx=".5" fill="#26a69a" opacity=".8"/><rect x="21" y="6" width="4" height="14" rx=".5" fill="#26a69a" opacity=".9"/><rect x="27" y="10" width="4" height="10" rx=".5" fill="#26a69a" opacity=".8"/><rect x="33" y="16" width="4" height="4" rx=".5" fill="#ef5350" opacity=".7"/><rect x="39" y="22" width="4" height="6" rx=".5" fill="#ef5350" opacity=".7"/>` },
  { id: 'delta-profile',    label: 'Delta Profile',       icon: `<path d="M2,27 C8,27 12,24 16,20 C20,16 24,10 28,7 C32,4 36,3 42,3" stroke="#60c0f0" stroke-width="2" fill="none" stroke-linecap="round"/><line x1="22" y1="2" x2="22" y2="28" stroke="#334155" stroke-width="1" stroke-dasharray="2,2"/><line x1="2" y1="15" x2="42" y2="15" stroke="#334155" stroke-width="1" stroke-dasharray="2,2"/>` },
]

function wireChartOverview() {
  $('#nav-chart-overview')?.addEventListener('click', e => {
    e.preventDefault()
    _covOpen ? closeChartOverview() : openChartOverview()
  })
  $('#cov-close')?.addEventListener('click', closeChartOverview)
}

function wireChartToast() {
  let _toastTimer = null
  function showTvToast() {
    const toast = $('#tv-toast')
    if (!toast) return
    clearTimeout(_toastTimer)
    toast.classList.add('show')
    _toastTimer = setTimeout(() => toast.classList.remove('show'), 1800)
  }
  $$('.dt-btn').forEach(btn => btn.addEventListener('click', showTvToast))
  $$('.tf-selector').forEach(btn => btn.addEventListener('click', showTvToast))
  ;['ce-menu-btn', 'underlying-menu-btn', 'pe-menu-btn'].forEach(id => {
    $(`#${id}`)?.addEventListener('click', showTvToast)
  })
}

function openChartOverview() {
  _covOpen = true
  _initCovHeroData()
  renderCovPanel()
  const panel = $('#chart-overview-panel')
  panel.classList.add('open')
  $('#nav-chart-overview').classList.add('active')
  // Redraw after CSS transition so canvas.offsetWidth is correct
  setTimeout(() => { _drawCovHero(); _drawAllCovMiniCharts() }, 270)
}

function closeChartOverview() {
  _covOpen = false
  $('#chart-overview-panel')?.classList.remove('open')
  $('#nav-chart-overview')?.classList.remove('active')
}

function _initCovHeroData() {
  if (_covHeroData) return
  const spot   = priceEngine.getPrice('NIFTY') || currentPrices.NIFTY
  const chain  = buildOptionChain(spot)
  const bars   = generateHistory(spot, 0.0008, 60, 555)
  const atmIdx = chain.findIndex(r => r.atm)
  const center = atmIdx >= 0 ? atmIdx : Math.floor(chain.length / 2)
  const strikes = chain.slice(Math.max(0, center - 4), center + 5)
  _covHeroData = { spot, chain, bars, strikes }
}

function renderCovPanel() {
  const body = $('#cov-body')
  if (!body) return
  const sel = COV_CHART_TYPES.find(t => t.id === _covSelectedType) || COV_CHART_TYPES[0]
  body.innerHTML = `
    <div class="cov-hero">
      <div class="cov-hero-top">
        <span class="cov-hero-name" id="cov-hero-name">${sel.label}</span>
        <span class="cov-hero-instr">NIFTY 50</span>
      </div>
      <canvas class="cov-hero-canvas" id="cov-hero-canvas"></canvas>
    </div>
    <div class="cov-section-label">CHART TYPE</div>
    <div class="cov-type-grid" id="cov-type-grid">
      ${COV_CHART_TYPES.map(t => `
        <button class="cov-type-card${t.id === _covSelectedType ? ' active' : ''}" data-cov-type="${t.id}" type="button">
          <canvas class="cov-type-canvas" data-type="${t.id}"></canvas>
          <span class="cov-type-label">${t.label}</span>
        </button>`).join('')}
    </div>`
  $('#cov-type-grid')?.addEventListener('click', e => {
    const card = e.target.closest('.cov-type-card')
    if (!card) return
    _selectCovType(card.dataset.covType)
  })
  requestAnimationFrame(() => {
    _drawCovHero()
    _drawAllCovMiniCharts()
  })
}

function _drawAllCovMiniCharts() {
  if (!_covHeroData) return
  $$('.cov-type-canvas').forEach(canvas => {
    const type = canvas.dataset.type
    if (!type) return
    const dpr = window.devicePixelRatio || 1
    const W   = canvas.offsetWidth  || 120
    const H   = canvas.offsetHeight || 52
    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)
    _covDrawType(ctx, W, H, type)
  })
}

function _selectCovType(id) {
  _covSelectedType = id
  $$('.cov-type-card').forEach(c => c.classList.toggle('active', c.dataset.covType === id))
  const nameEl = $('#cov-hero-name')
  const sel    = COV_CHART_TYPES.find(t => t.id === id)
  if (nameEl && sel) nameEl.textContent = sel.label
  _drawCovHero()
}

function _drawCovHero() {
  const canvas = $('#cov-hero-canvas')
  if (!canvas || !_covHeroData) return
  const dpr = window.devicePixelRatio || 1
  const W   = canvas.offsetWidth  || 282
  const H   = canvas.offsetHeight || 180
  canvas.width  = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)
  _covDrawType(ctx, W, H, _covSelectedType)
}

function _covDrawType(ctx, W, H, type) {
  if (!_covHeroData) return
  const { chain, bars, strikes } = _covHeroData
  const close = bars.map(b => b.close)
  const mini  = H < 80  // suppress legend & ATM lines on tiny cards

  const dispatch = {
    'oi':               () => _covHero_oi(ctx, W, H, chain, mini),
    'oi-change':        () => _covHero_oiChange(ctx, W, H, chain, mini),
    'multi-strike-oi':  () => _covHero_multiLine(ctx, W, H, strikes.map((r, i) => ({ color: _covStrikeColor(i), values: _covFakeTimeSeries(bars, r.ce.oi, 0.008, i * 31) })), mini),
    'total-oi-spot':    () => _covHero_totalOIvsSpot(ctx, W, H, chain, close, mini),
    'strangle':         () => _covHero_strangle(ctx, W, H, bars, false, mini),
    'straddle':         () => _covHero_strangle(ctx, W, H, bars, true, mini),
    'iv-smile':         () => _covHero_ivSmile(ctx, W, H, chain, mini),
    'multi-strike-iv':  () => _covHero_multiLine(ctx, W, H, strikes.slice(0, 4).map((r, i) => ({ color: _covStrikeColor(i), values: _covFakeTimeSeries(bars, r.ce.iv, 0.012, i * 17) })), mini),
    'atm-vol':          () => _covHero_atmVol(ctx, W, H, bars, mini),
    'time-lapse-skew':  () => _covHero_timeLapseSkew(ctx, W, H, chain, mini),
    'volume':           () => _covHero_volume(ctx, W, H, bars, false, mini),
    'vol-change':       () => _covHero_volume(ctx, W, H, bars, true, mini),
    'multi-strike-vol': () => _covHero_multiLine(ctx, W, H, strikes.map((r, i) => ({ color: _covStrikeColor(i), values: _covFakeTimeSeries(bars, r.ce.oi * 0.001, 0.02, i * 23) })), mini),
    'pcr':              () => _covHero_pcr(ctx, W, H, bars, chain, mini),
    'gamma-exp':        () => _covHero_gammaExp(ctx, W, H, chain, mini),
    'delta-profile':    () => _covHero_deltaProfile(ctx, W, H, chain, mini),
  }
  ;(dispatch[type] || dispatch['oi'])()
}

function _covStrikeColor(i) {
  return ['#ef5350','#26a69a','#60c0f0','#f59e0b','#a78bfa','#fb923c'][i % 6]
}

function _covFakeTimeSeries(bars, baseVal, vol, seed) {
  let v = baseVal
  const mk = (s) => { let x = s >>> 0; return () => { x += 0x6D2B79F5; let t = Math.imul(x^(x>>>15),1|x); t^=t+Math.imul(t^(t>>>7),61|t); return ((t^(t>>>14))>>>0)/4294967296 } }
  const rng = mk(seed || 1)
  return bars.map(() => { v = Math.max(v * 0.1, v * (1 + (rng() - 0.5) * vol * 2)); return v })
}

function _covScaleY(values, H, padT = 8, padB = 12) {
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const innerH = H - padT - padB
  return { min, max, range, toY: v => padT + innerH - ((v - min) / range) * innerH }
}

function _covHero_oi(ctx, W, H, chain, mini = false) {
  const n     = chain.length
  const padT  = 4, padB = mini ? 4 : 14, padL = 4, padR = 4
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const groupW = innerW / n
  const barW   = Math.max(1, groupW * 0.42)
  const maxOI  = Math.max(...chain.flatMap(r => [r.ce.oi, r.pe.oi]))
  const baseY  = padT + innerH

  chain.forEach((row, i) => {
    const cx = padL + i * groupW + groupW / 2
    const ceH = (row.ce.oi / maxOI) * innerH
    const peH = (row.pe.oi / maxOI) * innerH
    ctx.fillStyle = 'rgba(239,83,80,0.75)'
    ctx.fillRect(cx - barW - 1, baseY - ceH, barW, ceH)
    ctx.fillStyle = 'rgba(38,166,154,0.75)'
    ctx.fillRect(cx + 1, baseY - peH, barW, peH)
    if (!mini && row.atm) {
      ctx.strokeStyle = 'rgba(109,124,246,0.6)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath(); ctx.moveTo(cx, padT); ctx.lineTo(cx, baseY); ctx.stroke()
      ctx.setLineDash([])
    }
  })
  ctx.beginPath(); ctx.moveTo(padL, baseY); ctx.lineTo(W - padR, baseY)
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.stroke()
  if (!mini) _covLegend(ctx, W, H, [{ color: '#ef5350', label: 'Calls' }, { color: '#26a69a', label: 'Puts' }])
}

function _covHero_oiChange(ctx, W, H, chain, mini = false) {
  const n     = chain.length
  const padT  = 4, padB = mini ? 4 : 14, padL = 4, padR = 4
  const innerW = W - padL - padR
  const innerH = (H - padT - padB) / 2
  const midY   = padT + innerH
  const groupW = innerW / n
  const barW   = Math.max(1, groupW * 0.42)
  const deltas = chain.map(r => ({ ce: r.ce.oi * (r.ce.chgPct / 100), pe: r.pe.oi * (r.pe.chgPct / 100) }))
  const maxD   = Math.max(...deltas.flatMap(d => [Math.abs(d.ce), Math.abs(d.pe)]), 1)

  deltas.forEach((d, i) => {
    const cx = padL + i * groupW + groupW / 2
    const ceH = (Math.abs(d.ce) / maxD) * innerH
    const peH = (Math.abs(d.pe) / maxD) * innerH
    ctx.fillStyle = d.ce >= 0 ? 'rgba(239,83,80,0.75)' : 'rgba(239,83,80,0.4)'
    ctx.fillRect(cx - barW - 1, d.ce >= 0 ? midY - ceH : midY, barW, ceH)
    ctx.fillStyle = d.pe >= 0 ? 'rgba(38,166,154,0.75)' : 'rgba(38,166,154,0.4)'
    ctx.fillRect(cx + 1, d.pe >= 0 ? midY - peH : midY, barW, peH)
  })
  ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(W - padR, midY)
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.stroke()
  if (!mini) _covLegend(ctx, W, H, [{ color: '#ef5350', label: 'Calls' }, { color: '#26a69a', label: 'Puts' }])
}

function _covHero_multiLine(ctx, W, H, series, mini = false) {
  const n = series[0]?.values?.length || 0
  if (!n) return
  const allVals = series.flatMap(s => s.values)
  const { toY }  = _covScaleY(allVals, H, 4, mini ? 4 : 12)
  const toX      = i => (i / (n - 1)) * W

  series.forEach(({ color, values }) => {
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(values[0]))
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(values[i]))
    ctx.strokeStyle = color
    ctx.lineWidth   = mini ? 1.2 : 1.5
    ctx.lineJoin    = 'round'
    ctx.stroke()
  })
}

function _covHero_totalOIvsSpot(ctx, W, H, chain, close, mini = false) {
  const totalOI = chain.map((_, i) => chain[i].ce.oi + chain[i].pe.oi)
  const n = close.length
  const pb = mini ? 4 : 20
  const { toY: toYoi } = _covScaleY(totalOI, H, 4, pb)
  const { toY: toYp  } = _covScaleY(close, H, 4, pb)
  const toX = i => (i / (n - 1)) * W

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, 'rgba(38,166,154,0.25)')
  grad.addColorStop(1, 'rgba(38,166,154,0)')
  ctx.beginPath()
  ctx.moveTo(toX(0), toYoi(totalOI[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toYoi(totalOI[Math.floor(i / n * totalOI.length)]))
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
  ctx.fillStyle = grad; ctx.fill()

  ctx.beginPath()
  ctx.moveTo(toX(0), toYoi(totalOI[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toYoi(totalOI[Math.floor(i / n * totalOI.length)]))
  ctx.strokeStyle = '#26a69a'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(toX(0), toYp(close[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toYp(close[i]))
  ctx.strokeStyle = '#60c0f0'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]); ctx.stroke()
  ctx.setLineDash([])
  if (!mini) _covLegend(ctx, W, H, [{ color: '#26a69a', label: 'Total OI' }, { color: '#60c0f0', label: 'NIFTY', dashed: true }])
}

function _covHero_strangle(ctx, W, H, bars, isStraddle, mini = false) {
  const n     = bars.length
  const close = bars.map(b => b.close)
  const { min: pMin, max: pMax } = _covScaleY(close, H)
  const mid   = (pMin + pMax) / 2
  const strat = close.map(p => {
    const dist = Math.abs(p - mid)
    return isStraddle ? dist * 0.4 + pMin * 0.01 : Math.max(0, dist - (pMax - pMin) * 0.12) * 0.5 + pMin * 0.008
  })
  const allV  = [...close, ...strat]
  const { toY } = _covScaleY(allV, H, 4, mini ? 4 : 12)
  const toX     = i => (i / (n - 1)) * W
  const col     = isStraddle ? '#f59e0b' : '#ef5350'

  ctx.beginPath()
  ctx.moveTo(toX(0), toY(strat[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(strat[i]))
  ctx.strokeStyle = col; ctx.lineWidth = mini ? 1.4 : 1.8; ctx.lineJoin = 'round'; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(toX(0), toY(close[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(close[i]))
  ctx.strokeStyle = '#60c0f0'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]); ctx.stroke()
  ctx.setLineDash([])
  if (!mini) _covLegend(ctx, W, H, [{ color: col, label: isStraddle ? 'STRADDLE' : 'STRANGLE' }, { color: '#60c0f0', label: 'NIFTY', dashed: true }])
}

function _covHero_ivSmile(ctx, W, H, chain, mini = false) {
  const ceIVs = chain.map(r => r.ce.iv * 100)
  const peIVs = chain.map(r => r.pe.iv * 100)
  const n     = chain.length
  const pb    = mini ? 4 : 20
  const { toY } = _covScaleY([...ceIVs, ...peIVs], H, 4, pb)
  const toX     = i => (i / (n - 1)) * W

  ctx.beginPath()
  ctx.moveTo(toX(0), toY(peIVs[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(peIVs[i]))
  ctx.strokeStyle = '#26a69a'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(toX(0), toY(ceIVs[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(ceIVs[i]))
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke()

  if (!mini) {
    const atmI = chain.findIndex(r => r.atm)
    if (atmI >= 0) {
      ctx.beginPath(); ctx.moveTo(toX(atmI), 4); ctx.lineTo(toX(atmI), H - 14)
      ctx.strokeStyle = 'rgba(109,124,246,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke()
      ctx.setLineDash([])
    }
    _covLegend(ctx, W, H, [{ color: '#ef5350', label: 'CE IV' }, { color: '#26a69a', label: 'PE IV' }])
  }
}

function _covHero_atmVol(ctx, W, H, bars, mini = false) {
  const close  = bars.map(b => b.close)
  const atm    = _covFakeTimeSeries(bars, 0.22, 0.015, 77)
  const atmPct = atm.map(v => v * 100)
  const pb     = mini ? 4 : 20
  const { toY: toYiv } = _covScaleY(atmPct, H, 4, pb)
  const { toY: toYp  } = _covScaleY(close, H, 4, pb)
  const n = bars.length
  const toX = i => (i / (n - 1)) * W

  ctx.beginPath()
  ctx.moveTo(toX(0), toYiv(atmPct[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toYiv(atmPct[i]))
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = mini ? 1.4 : 1.8; ctx.lineJoin = 'round'; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(toX(0), toYp(close[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toYp(close[i]))
  ctx.strokeStyle = '#60c0f0'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]); ctx.stroke()
  ctx.setLineDash([])
  if (!mini) _covLegend(ctx, W, H, [{ color: '#f59e0b', label: 'ATM IV' }, { color: '#60c0f0', label: 'NIFTY', dashed: true }])
}

function _covHero_timeLapseSkew(ctx, W, H, chain, mini = false) {
  const n      = chain.length
  const TIMES  = [
    { label: 'Now', alpha: 1.0, color: '#26a69a' },
    { label: '-1h', alpha: 0.6, color: '#f59e0b' },
    { label: '-3h', alpha: 0.3, color: '#ef5350' },
  ]
  const toX = i => (i / (n - 1)) * W
  const allIVs = chain.map(r => r.ce.iv * 100)
  const pb = mini ? 4 : 20
  const { toY } = _covScaleY(allIVs.map(v => v * 1.25), H, 4, pb)
  const atmI = chain.findIndex(x => x.atm)

  TIMES.forEach(({ alpha, color }, ti) => {
    const ivs = chain.map((r, i) => {
      const dist = Math.abs(i - atmI) / chain.length
      return r.ce.iv * 100 * (1 + ti * 0.08 * (1 + dist * 2))
    })
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(ivs[0]))
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(ivs[i]))
    ctx.strokeStyle = color
    ctx.globalAlpha = alpha
    ctx.lineWidth   = mini ? (1.6 - ti * 0.3) : (2 - ti * 0.4)
    ctx.lineJoin    = 'round'
    ctx.stroke()
    ctx.globalAlpha = 1
  })
  if (!mini) _covLegend(ctx, W, H, TIMES.map(t => ({ color: t.color, label: t.label })))
}

function _covHero_volume(ctx, W, H, bars, isChange, mini = false) {
  const n     = bars.length
  const padT  = 4, padB = mini ? 4 : 14, padL = 4
  const innerH = (H - padT - padB) * (isChange ? 0.5 : 1)
  const midY   = padT + (H - padT - padB) * 0.5
  const baseY  = padT + (H - padT - padB)
  const barW   = Math.max(1, (W - padL) / n * 0.8)
  const toX    = i => padL + i * ((W - padL) / n) + ((W - padL) / n) / 2

  const ceVol = bars.map((b, i) => b.volume * (0.4 + 0.3 * Math.sin(i * 0.4)))
  const peVol = bars.map((b, i) => b.volume * (0.3 + 0.25 * Math.cos(i * 0.5 + 1)))
  const maxV  = Math.max(...ceVol, ...peVol)

  bars.forEach((_, i) => {
    const x   = toX(i)
    const ceh = (ceVol[i] / maxV) * innerH
    const peh = (peVol[i] / maxV) * innerH

    if (isChange) {
      const sign = i % 3 !== 1 ? 1 : -1
      ctx.fillStyle = sign > 0 ? 'rgba(38,166,154,0.75)' : 'rgba(239,83,80,0.75)'
      ctx.fillRect(x - barW / 2, sign > 0 ? midY - ceh * 0.7 : midY, barW, ceh * 0.7)
    } else {
      ctx.fillStyle = 'rgba(38,166,154,0.75)'
      ctx.fillRect(x - barW / 2 - 1, baseY - ceh, barW / 2, ceh)
      ctx.fillStyle = 'rgba(239,83,80,0.75)'
      ctx.fillRect(x + 1, baseY - peh, barW / 2, peh)
    }
  })

  const axisY = isChange ? midY : baseY
  ctx.beginPath(); ctx.moveTo(padL, axisY); ctx.lineTo(W, axisY)
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.stroke()
  if (!mini && !isChange) _covLegend(ctx, W, H, [{ color: '#26a69a', label: 'Calls' }, { color: '#ef5350', label: 'Puts' }])
}

function _covHero_pcr(ctx, W, H, bars, chain, mini = false) {
  const pcrValues = _covFakeTimeSeries(bars, 1.1, 0.02, 99)
  const close     = bars.map(b => b.close)
  const n         = bars.length
  const pb        = mini ? 4 : 20
  const { toY: toYpcr } = _covScaleY(pcrValues, H, 4, pb)
  const { toY: toYp   } = _covScaleY(close, H, 4, pb)
  const toX = i => (i / (n - 1)) * W

  ctx.beginPath()
  ctx.moveTo(toX(0), toYpcr(pcrValues[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toYpcr(pcrValues[i]))
  ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = mini ? 1.4 : 1.8; ctx.lineJoin = 'round'; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(toX(0), toYp(close[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toYp(close[i]))
  ctx.strokeStyle = '#60c0f0'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]); ctx.stroke()
  ctx.setLineDash([])
  if (!mini) _covLegend(ctx, W, H, [{ color: '#a78bfa', label: 'PCR' }, { color: '#60c0f0', label: 'NIFTY', dashed: true }])
}

function _covHero_gammaExp(ctx, W, H, chain, mini = false) {
  const n      = chain.length
  const padT   = 4, padB = mini ? 4 : 14, padL = 4, padR = 4
  const innerW = W - padL - padR
  const atmI   = chain.findIndex(r => r.atm)
  const midY   = padT + (H - padT - padB) * 0.5
  const innerH = (H - padT - padB) * 0.5
  const groupW = innerW / n
  const barW   = Math.max(1, groupW * 0.7)

  const gexVals = chain.map((r, i) => {
    const dist  = (i - atmI) / chain.length
    const bell  = Math.exp(-18 * dist * dist)
    const side  = i >= atmI ? 1 : -1
    return side * bell * r.ce.oi * 0.0001
  })
  const maxG = Math.max(...gexVals.map(Math.abs), 1)

  gexVals.forEach((g, i) => {
    const cx  = padL + i * groupW + groupW / 2
    const gh  = (Math.abs(g) / maxG) * innerH
    ctx.fillStyle = g >= 0 ? 'rgba(38,166,154,0.75)' : 'rgba(239,83,80,0.75)'
    ctx.fillRect(cx - barW / 2, g >= 0 ? midY - gh : midY, barW, gh)
  })
  ctx.beginPath(); ctx.moveTo(padL, midY); ctx.lineTo(W - padR, midY)
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.stroke()
  if (!mini) _covLegend(ctx, W, H, [{ color: '#26a69a', label: 'Long γ' }, { color: '#ef5350', label: 'Short γ' }])
}

function _covHero_deltaProfile(ctx, W, H, chain, mini = false) {
  const n       = chain.length
  const pb      = mini ? 4 : 20
  const ceDelta = chain.map(r => r.ce.delta)
  const peDelta = chain.map(r => -Math.abs(r.pe.delta))
  const allD    = [...ceDelta, ...peDelta]
  const { toY } = _covScaleY(allD, H, 4, pb)
  const toX     = i => (i / (n - 1)) * W

  const zeroY = toY(0)
  ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W, zeroY)
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke()
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.moveTo(toX(0), toY(ceDelta[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(ceDelta[i]))
  ctx.strokeStyle = '#ef5350'; ctx.lineWidth = mini ? 1.4 : 1.8; ctx.lineJoin = 'round'; ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(toX(0), toY(peDelta[0]))
  for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(peDelta[i]))
  ctx.strokeStyle = '#26a69a'; ctx.lineWidth = mini ? 1.4 : 1.8; ctx.lineJoin = 'round'; ctx.stroke()
  if (!mini) _covLegend(ctx, W, H, [{ color: '#ef5350', label: 'Call Δ' }, { color: '#26a69a', label: 'Put Δ' }])
}

function _covLegend(ctx, W, H, items) {
  const dotR = 3, gap = 6, itemGap = 14
  const totalW = items.reduce((s, item) => s + dotR * 2 + gap + ctx.measureText(item.label).width + itemGap, 0)
  let x = (W - totalW) / 2
  const y = H - 6
  ctx.font = '9px system-ui'
  ctx.textBaseline = 'middle'
  items.forEach(item => {
    ctx.fillStyle = item.color
    ctx.beginPath(); ctx.arc(x + dotR, y, dotR, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(item.label, x + dotR * 2 + gap, y)
    x += dotR * 2 + gap + ctx.measureText(item.label).width + itemGap
  })
}
