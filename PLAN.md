# Prototype Build Plan

Full plan for the trading platform prototype with live fake data, order simulation, and P&L tracking.

---

## 1. Goals

| Goal | Detail |
|------|--------|
| Look real | Pixel-faithful to the design brief |
| Feel real | Prices move live, orders execute, P&L updates in real time |
| Self-contained | Runs on `localhost`, no external APIs, no auth |
| Shareable | `npm install && npm run dev` and it works |

---

## 2. Tech Stack Decision

| Layer | Choice | Why |
|-------|--------|-----|
| Dev server | **Vite** | Zero config, instant HMR, no build complexity |
| Frontend | **Vanilla HTML + CSS + JS** (ES modules) | No framework overhead, fast to prototype, matches existing file structure |
| Charts | **TradingView Lightweight Charts** (v4, free OSS) | Looks identical to the reference images, handles real-time tick updates natively |
| Fake data | Custom **price simulation engine** (JS) | Full control over price movement, spreads, option premium decay |
| State | **In-memory JS store** (no DB) | Fast, simple, resets on page reload like a real trading session |
| Persistence | **localStorage** for trading defaults only | Settings survive refresh; positions intentionally reset |

No React, no Vue, no Redux. The prototype complexity does not justify a framework.

---

## 3. Repository Structure

```
prototyping/
├── index.html                  # Entry point
├── package.json
├── vite.config.js
├── styles/
│   ├── tokens.css              # All CSS variables (colors, fonts, spacing)
│   ├── layout.css              # Global layout, navbar, top bar
│   ├── chart.css               # Chart panel styles
│   ├── modals.css              # All modal/overlay styles
│   └── components.css          # Buttons, inputs, badges, toggles, tables
├── src/
│   ├── main.js                 # App bootstrap
│   ├── data/
│   │   ├── instruments.js      # Static instrument definitions
│   │   ├── mockHistory.js      # Pre-generated historical OHLCV candles
│   │   ├── optionChain.js      # Fake option chain snapshot generator
│   │   └── priceEngine.js      # Live tick simulation (random walk)
│   ├── store/
│   │   ├── index.js            # Central state store
│   │   ├── positions.js        # Open positions + P&L calc
│   │   ├── orders.js           # Order book (pending + executed)
│   │   ├── funds.js            # Margin + available funds
│   │   └── tradingDefaults.js  # Quantity/Price/SL-TP settings (localStorage)
│   ├── charts/
│   │   ├── chartManager.js     # Manages both chart instances
│   │   ├── spotChart.js        # Left chart (spot)
│   │   └── optionChart.js      # Right chart (option contract)
│   ├── ui/
│   │   ├── topBar.js
│   │   ├── navbar.js
│   │   ├── subHeader.js
│   │   ├── buySellBar.js
│   │   ├── contextMenu.js
│   │   ├── tradingDefaultsModal.js
│   │   ├── switchLegPanel.js
│   │   ├── orderOverlay.js
│   │   └── pnlPanel.js
│   └── utils/
│       ├── format.js           # ₹ formatting, % formatting, lot calc
│       └── dom.js              # querySelector helpers
├── DESIGN_BRIEF.md
├── PLAN.md
└── COLLAB.md
```

---

## 4. Fake Data Architecture

### 4.1 Static Historical Data (`mockHistory.js`)
Pre-generate ~200 candles of OHLCV data at startup using a seeded random walk.

```
Spot (TATAPOWER): base price ~₹345, volatility ~0.8% per candle
Option (30 Mar 360 PE): base price ~₹210, higher volatility ~2.5% per candle
```

Each candle:
```js
{ time: unix_timestamp, open, high, low, close, volume }
```

Generated once when the module loads (deterministic seed so the chart always looks the same on first load).

### 4.2 Live Price Engine (`priceEngine.js`)
A tick generator that runs on `setInterval` (every 1 second by default, configurable).

**Algorithm: Geometric Brownian Motion (simplified)**
```
newPrice = lastPrice × (1 + drift + volatility × randomNormal())
```
- `drift`: small positive bias (~+0.0001 per tick, simulates slight uptrend during market hours)
- `volatility`: ~0.002 for spot, ~0.006 for options (options move more)
- New tick updates the current open candle's `high`/`low`/`close`
- Every N ticks (N = candle period in seconds, e.g. 300 for 5m), closes current candle and opens a new one

**Events emitted:**
```js
priceEngine.on('tick', ({ instrument, price, change, changePct }) => { ... })
priceEngine.on('candleUpdate', ({ instrument, candle }) => { ... })
priceEngine.on('newCandle', ({ instrument, candle }) => { ... })
```

### 4.3 Option Chain Generator (`optionChain.js`)
Static snapshot of strike prices around ATM, with fake OI and premium data.

For TATAPOWER @ ₹345:
- Strikes: 300, 310, 320, 330, 340, **350 (ATM)**, 360, 370, 380, 390, 400
- Each strike has: CE price, PE price, CE OI, PE OI, CE Chg%, PE Chg%
- Premiums computed from a simplified Black-Scholes approximation (no actual BSM needed — just make them look realistic)
- OI data: fake but shaped like real data (ATM has highest OI, falls off at wings)

### 4.4 Index Tickers (Top Bar)
NIFTY 50 and SENSEX run their own price engines with:
- NIFTY base: ₹28,048, volatility ~0.05% per tick
- SENSEX base: ₹25,648, volatility ~0.05% per tick

---

## 5. State Store

### 5.1 Positions Store
```js
{
  open: [
    {
      id: 'pos_001',
      instrument: 'TATAPOWER',
      type: 'spot' | 'option',
      side: 'BUY' | 'SELL',
      qty: 235,
      lots: 16,
      avgPrice: 344.50,
      currentPrice: 347.20,   // updates with each tick
      unrealizedPnL: 634.50,  // (currentPrice - avgPrice) × qty × side_multiplier
      realizedPnL: 0,
      timestamp: '10:30:00'
    }
  ],
  closed: [...],              // squared-off positions
  totalUnrealizedPnL: 0,
  totalRealizedPnL: 0,
}
```

### 5.2 Orders Store
```js
{
  pending: [
    {
      id: 'ord_001',
      type: 'LIMIT' | 'MARKET',
      side: 'BUY' | 'SELL',
      instrument: 'TATAPOWER',
      qty: 235,
      limitPrice: 344.00,      // for limit orders
      triggerPrice: null,
      status: 'PENDING',
      placedAt: '10:32:15'
    }
  ],
  executed: [...],
  cancelled: [...]
}
```

**Order execution logic:**
- **Market order**: executes immediately at current tick price + slippage (±0.05%)
- **Limit order**: placed in pending queue, engine checks every tick if price crosses trigger → auto-executes
- On execution: position is created/updated, margin is debited, order moves to `executed`

### 5.3 Funds Store
```js
{
  totalFunds: 500000,          // ₹5,00,000 starting capital
  usedMargin: 0,               // increases as positions open
  availableMargin: 500000,     // totalFunds - usedMargin
  pnl: 0,                      // totalRealizedPnL
  unrealizedPnL: 0,
}
```

Margin calculation (simplified):
- Equity/Futures: 15% of position value
- Options Buy: full premium × qty
- Options Sell: 15% of underlying value × qty

---

## 6. P&L Engine

P&L updates run on every price tick:

```
For each open position:
  unrealizedPnL = (currentPrice - avgEntryPrice) × qty × direction
  where direction = +1 for BUY, -1 for SELL

totalUnrealizedPnL = sum of all open position unrealizedPnL
displayPnL = totalRealizedPnL + totalUnrealizedPnL
```

**Top bar "PnL" chip** updates in real time (green when positive, red when negative).

**Trailing SL logic** (from Trading Defaults):
- If trailing SL is enabled, as price moves favorably, the SL trigger price tracks at `triggerPrice%` below the high watermark
- Checked on every tick, auto-squares position if breached

---

## 7. UI Interactivity Map

| Action | What happens |
|--------|-------------|
| Click Buy (market) | Market order created → executes at current price → position opens → margin debited → P&L panel updates |
| Click Sell (market) | Same but short side |
| Click Buy (one-click OFF) | Opens limit order overlay on chart → user sets price → confirm → limit order placed in pending queue |
| Quantity stepper +/— | Updates qty in store (persists across both charts) |
| One-click toggle | Switches between immediate market order vs order form |
| ⋮ → Set trading defaults | Opens Trading Defaults modal, loads from localStorage |
| Trading Defaults → Apply | Saves to localStorage, updates quantity steppers live |
| ⋮ → Set alert | Placeholder (visual only) |
| Switch Leg | Opens Switch Leg panel, loads option chain table, clicking a row switches the right chart to that contract |
| Timeframe selector | Switches candle period (5m / 15m / 1h), regenerates historical data for that TF, restarts tick engine |
| Back arrow | Returns to a hypothetical watchlist (can be a placeholder screen) |

---

## 8. Build Order (Phase by Phase)

### Phase 1 — Foundation (P1)
Owner: **Codex** (propose)
Files: `index.html`, `styles/tokens.css`, `styles/layout.css`, `src/main.js`, `package.json`, `vite.config.js`

Deliverable: blank dark-theme app shell loads in browser with correct layout grid, navbar icons, top bar structure visible. No data yet.

### Phase 2 — Data Engine (P1)
Owner: **Claude** (propose)
Files: `src/data/`, `src/store/`

Deliverable: `priceEngine.js` emitting ticks in console, store modules with getters/setters, option chain snapshot loadable.

### Phase 3 — Charts (P2)
Owner: Coordinate — Lightweight Charts lib setup + feed from price engine
Files: `src/charts/`, `styles/chart.css`

Deliverable: Both charts render historical candles, live ticks update the current candle in real time.

### Phase 4 — Buy/Sell + Order Flow (P2)
Owner: **Claude** (propose)
Files: `src/ui/buySellBar.js`, `src/ui/orderOverlay.js`

Deliverable: Market orders execute, position opens, top-bar PnL updates.

### Phase 5 — Modals (P3)
Owner: Split
- Trading Defaults modal → **Codex** (pure UI, no data complexity)
- Switch Leg panel + option chain table → **Claude**

### Phase 6 — P&L Panel + Polish (P4/P5)
Owner: coordinate at that point

---

## 9. Open Decisions (resolve before starting)

| # | Decision | Options | My recommendation |
|---|----------|---------|-------------------|
| 1 | Chart library | Lightweight Charts vs Canvas mock vs Chart.js | **Lightweight Charts** — open source, looks identical to reference, handles real-time natively |
| 2 | JS module approach | ES modules (import/export) vs bundled | **ES modules via Vite** — cleaner, Vite handles it |
| 3 | Tick speed | 1s, 500ms, configurable | **1s default**, configurable constant at top of priceEngine.js |
| 4 | Starting capital | Any amount | **₹5,00,000** — round, realistic for retail trader |
| 5 | Candle period for 5m | 300 ticks at 1s = 5 minutes real time (too slow for demo) | **Accelerated mode**: 1 "candle" every 30 seconds of wall clock time, labeled as "5m" |

---

## 10. What the Final Prototype Can Do

When you open `localhost:5173`:

1. Two live charts are running with TATAPOWER spot and 30 Mar 360 PE — candles updating every second
2. NIFTY and SENSEX tickers in the top bar are ticking live
3. You can toggle One-click ON/OFF
4. With One-click ON: hit Buy → market order fires → position appears in P&L panel → top bar PnL updates
5. With One-click OFF: hit Buy → limit order overlay appears on chart → set your price → confirm → order sits pending → auto-executes when price crosses
6. You can open Trading Defaults → change qty/lot/price type/SL-TP → Apply → steppers update
7. Switch Leg panel opens, shows option chain, click a strike → right chart switches to that contract
8. P&L panel shows unrealized + realized breakdown per position
9. Trailing SL auto-squares a position if price reverses past your configured %
