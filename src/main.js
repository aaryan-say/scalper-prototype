// ═══════════════════════════════════════════════════════════
//  MAIN.JS  —  bootstrap, wire everything together
// ═══════════════════════════════════════════════════════════
import { initCharts, updateCECandle, updateUnderlyingCandle, updatePECandle, switchCEChart, switchPEChart, drawOrderLine, updateOrderLine, removeOrderLine, drawPositionLine, subscribeChartCrosshair, getPriceY, getPriceFromY, resizeCharts } from './charts.js'
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
}
let _pinnedIndices = HEADER_INDEX_ITEMS.map(item => item.key)
let _enabledOptionMetrics = { pcr: true, maxPain: true, atmIv: true, ivPercentile: true }
let _optionMetricTimer = null

// Shared container for all chart overlays (position labels, "+" buttons, popups)
let _chartOverlayContainer = null
const _posOverlays = {}   // posId → { chartId, el, entryPrice, chartEl }
const _priceHandles = {}  // id → draggable limit / SL / TP chart handles

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
  wireDraggableTfSelectors()
  wireOrderOverlay()
  wirePnlPanel()
  wireDepth()
  wireTradePresets()
  loadTradingDefaultsIntoModal()
  wireCrosshairButtons()
  wireChartVisibility()
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
  store.updatePrice('NIFTY_27500CE', currentPrices.NIFTY_27500CE)
  store.updatePrice('NIFTY_27500PE', currentPrices.NIFTY_27500PE)

  priceEngine.on('tick', ({ id, price, bid, ask }) => {
    store.updatePrice(id, price, bid, ask)
    _checkRiskLevels(id, price)
    updateDepthOnTick(id, price, bid, ask)
    if (id === 'NIFTY')         { updateNiftyChip(price); updateUnderlyingHeader(price) }
    if (id === 'NIFTY_27500CE') { updateCEHeader(price); _updateTpaPrice('ce', price) }
    if (id === 'NIFTY_27500PE') { updatePEHeader(price); _updateTpaPrice('pe', price) }
    if (id === 'SENSEX')        updateSensexChip(price)
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

function renderFullOptionChain(chain) {
  const tbody = $('#oc-full-tbody')
  if (!tbody) return
  tbody.innerHTML = chain.map(row => {
    const rowCls = [
      row.atm ? 'atm' : '',
      row.ce.itm ? 'itm-call' : '',
      row.pe.itm ? 'itm-put' : '',
    ].filter(Boolean).join(' ')
    const cChg = row.ce.chgPct >= 0 ? 'up' : 'down'
    const pChg = row.pe.chgPct >= 0 ? 'up' : 'down'
    const cSign = row.ce.chgPct >= 0 ? '+' : ''
    const pSign = row.pe.chgPct >= 0 ? '+' : ''
    return `<tr class="${rowCls}" data-strike="${row.strike}">
      <td class="ft-oi-c" data-side="ce">${fmtOI(row.ce.oi)}</td>
      <td class="ft-price-c" data-side="ce">
        <div class="ft-val-wrap" style="align-items:flex-end">
          <span class="ft-p">${row.ce.price.toFixed(2)}</span>
          <span class="ft-chg ${cChg}">${cSign}${row.ce.chgPct}%</span>
        </div>
      </td>
      <td class="ft-strike">${row.strike}</td>
      <td class="ft-price-p" data-side="pe">
        <div class="ft-val-wrap" style="align-items:flex-start">
          <span class="ft-p">${row.pe.price.toFixed(2)}</span>
          <span class="ft-chg ${pChg}">${pSign}${row.pe.chgPct}%</span>
        </div>
      </td>
      <td class="ft-oi-p" data-side="pe">${fmtOI(row.pe.oi)}</td>
    </tr>`
  }).join('')

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', e => {
      const cell = e.target.closest('td')
      const side = cell?.dataset.side
      if (!side) return
      const strike = tr.dataset.strike
      const newHist = generateHistory(
        side === 'ce' ? currentPrices.NIFTY_27500CE : currentPrices.NIFTY_27500PE,
        0.028, 200, parseInt(strike) % 97 + 1
      )
      if (side === 'ce') {
        switchCEChart(newHist)
        $('#ce-chart-price').textContent = newHist.at(-1).close.toFixed(2)
        $('#switch-ce-btn').textContent  = `27 Mar ${strike} ▾`
        $('#trade-call-switch strong').innerHTML = `${strike} CALL <span>OTM 28</span>`
      } else {
        switchPEChart(newHist)
        $('#pe-chart-price').textContent = newHist.at(-1).close.toFixed(2)
        $('#switch-pe-btn').textContent  = `27 Mar ${strike} ▾`
        $('#trade-put-switch strong').innerHTML  = `${strike} PUT <span>OTM 13</span>`
      }
      closeOptionChainPanel()
    })
  })
}

// ── Sub-header ───────────────────────────────────────────────
function wireSubHeader() {
  const wrap  = $('#one-click-wrap')
  const track = $('#one-click-track')
  if (wrap) wrap.addEventListener('click', () => {
    oneClickOn = !oneClickOn
    track.classList.toggle('on', oneClickOn)
  })
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
        pcr: savedMetrics.pcr !== false,
        maxPain: savedMetrics.maxPain !== false,
        atmIv: savedMetrics.atmIv !== false,
        ivPercentile: savedMetrics.ivPercentile !== false,
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
      <div class="indices-section-title">Signal Modules</div>
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
  return `
    <button class="signal-toggle-btn${active ? ' active' : ''}" type="button" data-metric-toggle="${key}" aria-pressed="${active ? 'true' : 'false'}">
      <svg class="signal-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">${config.icon}</svg>
      <span class="signal-meta">
        <span class="signal-name">${config.label}</span>
        <span class="signal-value">${config.format(value)}</span>
      </span>
      <span class="signal-toggle-knob" aria-hidden="true"></span>
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

  if (key === 'ivPercentile') {
    chip.classList.toggle('is-high', next >= 70)
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

  let savedMode = 'manual'
  try { savedMode = localStorage.getItem('indexTickerMode') || 'manual' } catch {}
  setMode(savedMode === 'auto' ? 'auto' : 'manual')
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

function toggleOptionMetric(metricKey) {
  if (!OPTION_METRIC_CONFIG[metricKey]) return
  _enabledOptionMetrics[metricKey] = _enabledOptionMetrics[metricKey] === false
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

  // Toggle chart wrappers
  $('#ce-chart-wrapper')?.classList.toggle('cv-hidden', !ce)
  $('#underlying-chart-wrapper')?.classList.toggle('cv-hidden', !ul)
  $('#pe-chart-wrapper')?.classList.toggle('cv-hidden', !pe)

  // Divider visibility:
  //   div0 (between ce and ul): show when ce is visible and at least one chart follows
  //   div1 (between ul and pe): show when ul AND pe are both visible
  const dividers = $$('.chart-divider')
  if (dividers[0]) dividers[0].classList.toggle('cv-hidden', !(ce && (ul || pe)))
  if (dividers[1]) dividers[1].classList.toggle('cv-hidden', !(ul && pe))

  // Resize visible charts after layout reflow
  requestAnimationFrame(() => requestAnimationFrame(() => resizeCharts()))
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
}

// ── Switch Leg Panel ──────────────────────────────────────────
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

  // Footer "Option chain" link → open left panel
  $('#footer-option-chain')?.addEventListener('click', e => {
    e.preventDefault()
    toggleOptionChainPanel()
  })
}

function openSwitchLeg(leg = _switchingLeg, anchor = null) {
  _switchingLeg = leg
  const panel = $('#switch-leg-panel')
  const spot  = priceEngine.getPrice('NIFTY') || currentPrices.NIFTY
  const chain = buildOptionChain(spot)
  renderOptionChain(chain, leg)
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
  const sideLabel = leg === 'ce' ? 'CALLS' : 'PUTS'
  $('#sl-title').textContent = leg === 'ce' ? 'Switch Call Leg' : 'Switch Put Leg'
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th class="${leg === 'ce' ? 'calls-col' : 'puts-col'}" colspan="2">${sideLabel}</th>
        <th class="strike-col">Strike</th>
      </tr>
      <tr>
        <th>OI</th>
        <th>PRICE / CHG%</th>
        <th class="strike-col">STRIKE</th>
      </tr>`
  }
  tbody.innerHTML = chain.map(row => {
    const atmClass   = row.atm ? 'atm' : ''
    const side       = leg === 'ce' ? row.ce : row.pe
    const itmClass   = side.itm ? (leg === 'ce' ? 'itm-call' : 'itm-put') : ''
    const rowClass   = [atmClass, itmClass].filter(Boolean).join(' ')
    const chgCls     = side.chgPct >= 0 ? 'up' : 'down'
    const sideClass  = leg === 'ce' ? 'calls-side' : 'puts-side'
    return `
      <tr class="${rowClass}" data-strike="${row.strike}" style="cursor:pointer">
        <td class="oi-col ${sideClass}">${fmtOI(side.oi)}</td>
        <td class="price-change-col ${sideClass}">
          <span class="price-col">${side.price.toFixed(2)}</span>
          <span class="chg-col ${chgCls}">${side.chgPct >= 0 ? '+' : ''}${side.chgPct}%</span>
        </td>
        <td class="strike-col">${row.strike}</td>
      </tr>`
  }).join('')

  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => {
      const strike  = row.dataset.strike
      const newHist = generateHistory(
        _switchingLeg === 'ce' ? currentPrices.NIFTY_27500CE : currentPrices.NIFTY_27500PE,
        0.028, 200, parseInt(strike) % 97 + 1
      )
      if (_switchingLeg === 'ce') {
        switchCEChart(newHist)
        _ceBase = newHist.at(-1).close
        $('#ce-chart-price').textContent   = _ceBase.toFixed(2)
        $('#switch-ce-btn').textContent    = `27 Mar ${strike} ▾`
        $('#trade-call-switch strong').innerHTML = `${strike} CALL <span>OTM 28</span>`
      } else {
        switchPEChart(newHist)
        _peBase = newHist.at(-1).close
        $('#pe-chart-price').textContent   = _peBase.toFixed(2)
        $('#switch-pe-btn').textContent    = `27 Mar ${strike} ▾`
        $('#trade-put-switch strong').innerHTML = `${strike} PUT <span>OTM 13</span>`
      }
      closeSwitchLeg()
    })
  })
}

// ── Draggable timeframe selectors ────────────────────────────
function wireDraggableTfSelectors() {
  [
    { btnId: 'ce-tf-btn',         wrapperId: 'ce-chart-wrapper'         },
    { btnId: 'underlying-tf-btn', wrapperId: 'underlying-chart-wrapper' },
    { btnId: 'pe-tf-btn',         wrapperId: 'pe-chart-wrapper'         },
  ].forEach(({ btnId, wrapperId }) => {
    const btn     = $(`#${btnId}`)
    const wrapper = $(`#${wrapperId}`)
    if (!btn || !wrapper) return

    let isFloating = false

    btn.addEventListener('mousedown', e => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const bRect = btn.getBoundingClientRect()
      const wRect = wrapper.getBoundingClientRect()

      if (!isFloating) {
        isFloating = true
        const initLeft = bRect.left - wRect.left
        const initTop  = bRect.top  - wRect.top
        btn.style.position = 'absolute'
        btn.style.margin   = '0'
        btn.style.zIndex   = '10'
        wrapper.appendChild(btn)
        btn.style.left = initLeft + 'px'
        btn.style.top  = initTop  + 'px'
      }

      const bRect2 = btn.getBoundingClientRect()
      const offX   = e.clientX - bRect2.left
      const offY   = e.clientY - bRect2.top

      btn.classList.add('dragging')

      const onMove = ev => {
        const wR   = wrapper.getBoundingClientRect()
        const newL = ev.clientX - wR.left - offX
        const newT = ev.clientY - wR.top  - offY
        btn.style.left = Math.max(0, Math.min(newL, wR.width  - btn.offsetWidth))  + 'px'
        btn.style.top  = Math.max(0, Math.min(newT, wR.height - btn.offsetHeight)) + 'px'
      }

      const onUp = () => {
        btn.classList.remove('dragging')
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup',   onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup',   onUp)
    })
  })
}

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
  if ($('#pnl-panel').classList.contains('open')) closeDepthPanel()
  updateCompactMode()
}
function closePnlPanel() { $('#pnl-panel').classList.remove('open'); updateCompactMode() }

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
let _tradePreset = 'default'

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

    // ── SL button → open SL sub-form ──
    $(`#${side}-tpa-sl-open`)?.addEventListener('click', () => {
      $(`#${side}-tpa-main`)?.classList.add('hidden')
      const form = $(`#${side}-tpa-sl-form`)
      form?.classList.remove('hidden')
      // Pre-fill with a default SL price
      const pos = store.state.positions.find(p => p.instrumentId === instrId && p.side === _presetSide())
      const inp = $(`#${side}-tpa-sl-input`)
      if (pos && inp && !inp.value) {
        const defaultSl = roundToTick(pos.avgPrice * (1 - (store.tradingDefaults.sl?.triggerPct ?? 1) / 100))
        inp.value = defaultSl.toFixed(2)
      }
      $(`#${side}-tpa-sl-input`)?.focus()
    })

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
      // Sync the other panel's trail button to the same state
      _TPA_CFG.forEach(cfg => {
        const other = $(`#${cfg.side}-tpa-trail`)
        if (other) other.dataset.on = isOn ? 'false' : 'true'
      })
    })

    // Set SL
    $(`#${side}-tpa-set-sl`)?.addEventListener('click', () => {
      const inp = $(`#${side}-tpa-sl-input`)
      const slPrice = parseFloat(inp?.value)
      if (!slPrice || isNaN(slPrice)) return
      const pos = store.state.positions.find(p => p.instrumentId === instrId && p.side === _presetSide())
      if (!pos) return
      const slId = `risk-${pos.id}-sl`
      const chartId = side
      drawOrderLine(chartId, slId, slPrice, '#EF4444', 'SL')
      if (_priceHandles[slId]) { _priceHandles[slId].price = slPrice; _priceHandles[slId].dormant = false }
      else _priceHandles[slId] = { price: slPrice, dormant: false }
      $(`#${side}-tpa-sl-form`)?.classList.add('hidden')
      $(`#${side}-tpa-main`)?.classList.remove('hidden')
    })

    // ── TP button → open TP sub-form ──
    $(`#${side}-tpa-tp-open`)?.addEventListener('click', () => {
      $(`#${side}-tpa-main`)?.classList.add('hidden')
      $(`#${side}-tpa-tp-form`)?.classList.remove('hidden')
      $(`#${side}-tpa-tp-input`)?.focus()
    })

    $(`#${side}-tpa-tp-back`)?.addEventListener('click', () => {
      $(`#${side}-tpa-tp-form`)?.classList.add('hidden')
      $(`#${side}-tpa-main`)?.classList.remove('hidden')
    })

    // Set TP
    $(`#${side}-tpa-set-tp`)?.addEventListener('click', () => {
      const inp = $(`#${side}-tpa-tp-input`)
      const tpPrice = parseFloat(inp?.value)
      if (!tpPrice || isNaN(tpPrice)) return
      const pos = store.state.positions.find(p => p.instrumentId === instrId && p.side === _presetSide())
      if (!pos) return
      const tpId = `risk-${pos.id}-tp`
      const chartId = side
      drawOrderLine(chartId, tpId, tpPrice, '#00C853', 'TP')
      if (_priceHandles[tpId]) { _priceHandles[tpId].price = tpPrice; _priceHandles[tpId].dormant = false }
      else _priceHandles[tpId] = { price: tpPrice, dormant: false }
      $(`#${side}-tpa-tp-form`)?.classList.add('hidden')
      $(`#${side}-tpa-main`)?.classList.remove('hidden')
    })

    // ── Exit ──
    $(`#${side}-tpa-exit`)?.addEventListener('click', () => {
      const pos = store.state.positions.find(p => p.instrumentId === instrId && p.side === _presetSide())
      if (pos) store.squareOff(pos.id, 'Smart exit')
    })
  })

  store.on('positions:updated', _syncTpaBars)
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
      const popupW = 286
      let left = btnRect.left - popupW - 8
      if (left < rect.left + 8) left = btnRect.right + 8
      left = Math.max(72, Math.min(left, window.innerWidth - popupW - 16))
      let top = btnRect.top - 10
      top = Math.max(rect.top + 8, Math.min(top, rect.bottom - 178))
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
    // Mark dormant: visual reference only until user drags to set execution price.
    // Keeping the entry in _priceHandles so removePriceHandle can clean up the DOM element.
    if (_priceHandles[id]) _priceHandles[id].dormant = true
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
        setTimeout(() => store.squareOff(pos.id, 'SL triggered'), 0)
        continue
      }
    }

    const tpHandle = _priceHandles[`risk-${pos.id}-tp`]
    if (tpHandle && !tpHandle.dormant) {
      const tpHit = pos.side === 'BUY' ? price >= tpHandle.price : price <= tpHandle.price
      if (tpHit) {
        pos._squaringOff = true
        setTimeout(() => store.squareOff(pos.id, 'TP triggered'), 0)
      }
    }
  }
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
