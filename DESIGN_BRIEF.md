# Design Brief — Trading Platform Prototype

Extracted from 23 reference images. This is the single source of truth for both Claude and Codex.

---

## 1. Product Overview

A **dark-theme Indian stock & options trading platform** (NSE/BSE, prices in INR ₹).  
Core UX pattern: a **dual-chart split view** — left chart shows the underlying spot/stock, right chart shows a selected options contract — with Buy/Sell actions pinned to the bottom of each chart.  
The product appears to be a web app (browser-rendered, not native).

---

## 2. Color System

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#0D0F14` | Page/app background |
| `bg-panel` | `#161820` | Chart panels, sidebars |
| `bg-card` | `#1E2029` | Modals, dropdowns, overlays |
| `bg-card-raised` | `#252838` | Active tabs, hover states in cards |
| `text-primary` | `#E8E9F0` | Main readable text |
| `text-secondary` | `#8B8FA8` | Labels, subtitles, muted |
| `text-muted` | `#555870` | Disabled, placeholder |
| `green` | `#00C853` | Positive P&L, Buy button, up candles |
| `green-subtle` | `#0D2E1A` | Green candle fill / positive bg tint |
| `red` | `#EF4444` | Negative P&L, Sell button, down candles |
| `red-subtle` | `#2E0D0D` | Red candle fill / negative bg tint |
| `amber` | `#F59E0B` | Signal badge dot, warning states |
| `border` | `#2A2D3E` | Card borders, dividers |
| `border-subtle` | `#1E2029` | Inner panel separators |
| `white` | `#FFFFFF` | Button labels on dark, active prices |

**Gradient** (logo, AI icon): linear-gradient from `#00C9A7` (teal-green) → `#4F8EF7` (blue)

---

## 3. Typography

Font family: **Inter** (or equivalent geometric sans-serif with tabular figures)

| Role | Size | Weight | Color |
|------|------|--------|-------|
| Index ticker values | 11px | 500 | `text-primary` |
| Stock name (TATAPOWER) | 17px | 600 | `#FFFFFF` |
| Price (large) | 15px | 600 | `#FFFFFF` |
| Price change | 13px | 500 | `green` or `red` |
| Chart axis labels | 11px | 400 | `text-secondary` |
| Modal title | 16px | 600 | `text-primary` |
| Tab label | 13px | 500 | `text-primary` |
| Table header | 11px | 600 | `text-secondary` |
| Table cell | 12px | 400 | `text-primary` |
| Badge text | 10px | 600 | varies |
| Button label | 13px | 600 | `#FFFFFF` or `#000000` |
| Subsection header | 11px | 600 | `text-secondary` uppercase |
| Input label | 12px | 500 | `text-secondary` |
| Input value | 13px | 500 | `text-primary` |

---

## 4. Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  GLOBAL TOP BAR (32px)                                   │
├──┬──────────────────────────────────────────────────────┤
│  │  STOCK SUB-HEADER (40px)                             │
│N │──────────────────────────────────────────────────────│
│A │                                                       │
│V │  CHART AREA (flex row, full remaining height)        │
│B │  ┌──────────────────────┐ ┌──────────────────────┐  │
│A │  │  LEFT CHART (spot)   │ │  RIGHT CHART (option)│  │
│R │  │                      │ │                       │  │
│  │  │  candlestick + vol   │ │  candlestick + vol   │  │
│4 │  ├──────────────────────┤ ├──────────────────────┤  │
│8 │  │ BUY | QTY | SELL    │ │ BUY | QTY | SELL    │  │
│p │  └──────────────────────┘ └──────────────────────┘  │
│x │                                                       │
└──┴──────────────────────────────────────────────────────┘
```

---

## 5. Component Specifications

### 5.1 Global Top Bar
- Height: 32px
- Background: `#0A0B0F` (slightly darker than base)
- Left: Search input (`🔍 Search stocks`) — dark fill `#1A1C24`, rounded pill, ~180px wide
- Center: Index chips — "NIFTY 50 ₹28,048.65 ▲ 241.25 (0.95%)" — white name, green delta
  - Format: `[NAME] [PRICE] [▲/▼] [CHANGE] ([PCT%])`
  - Positive: `text-primary` + `green` for delta; Negative: `red`
- Right: `PnL: ₹0.00` chip, `Margin: ₹24.5k` chip — both in `bg-card` pill with `text-secondary` label and `text-primary` value
- Far right: `⋮` icon button

### 5.2 Left Navigation Bar (Sidebar)
- Width: 48px
- Background: `bg-panel`
- All icons: outline style, `text-secondary`, 20px
- Active icon: `text-primary` or gradient fill
- Top group (top to bottom):
  1. **Logo** — custom gradient flag/chart icon (teal→blue), 28px
  2. **Bookmark** — watchlist
  3. **Cloud** — scanners or strategies
  4. **ƒ (script f)** — fundamentals
  5. **Archive box** — history or orders archive
  6. **Notebook** — trade journal
- Bottom group:
  7. **Sparkle ✦** — AI assistant (gradient fill, teal→blue)
  8. **Bell 🔔** — notifications (outline)
  9. **Avatar** — circular user photo, 28px diameter

### 5.3 Stock Sub-Header
- Height: 40px
- Background: `bg-panel` with bottom border `border`
- Left: `←` back, then `TATAPOWER` (bold white 17px), then `• 24 signals` badge (amber dot + gray text 10px, `bg-card` pill), then price `₹1,293.65`, change `▲ 12.25 (0.95%)` in green
- Exchange badge: `NSE` in `bg-card-raised` pill + `ⓘ` icon
- Right: `One-click` toggle (pill toggle, dark track, white thumb when off, green when on), `⋮` menu icon

### 5.4 Chart Panel (applies to both Left and Right)
- Background: `bg-panel`
- Top-left corner: instrument label ("Spot" / "30 Mar 360"), exchange ("NSE"), price, change
  - Instrument label: 12px, `text-secondary`
  - Exchange: 10px badge
  - Price: 13px bold
  - Change: 12px, green/red
- Top-right corner: timeframe selector `5m ⌄` — `bg-card` pill, 12px
- Chart body: candlestick chart with OHLCV candles
  - Up candle: green body, green wick
  - Down candle: red body, red wick
  - Current price line: dashed horizontal, with price box on right axis (green bg, white text)
- Volume bars: bottom 20% of chart area, same color as candle direction
- Right price axis: `text-muted` 10px labels, right-aligned
- Bottom time axis: `text-muted` 10px labels, "10:30", "12:00", "14:00" etc.
- Thin vertical separator between left/right charts: `border` color

### 5.5 Buy/Sell Action Bar
- Height: 44px
- Background: `bg-base` (slightly darker than panel)
- Layout: `[Buy btn] [— qty stepper +] [Sell btn]`
- **Buy button**: `bg: #00C853`, white text "＋ Buy", 13px bold, 8px border-radius, ~80px wide
- **Sell button**: `bg: #EF4444`, white text "＋ Sell", same spec
- **Quantity stepper**: "—" (minus icon btn) | "235" (white text, center, 14px bold) | "+" (plus icon btn)
  - Below quantity: "16 lots" in `text-muted` 10px

### 5.6 Context Menu (Three-dot ⋮)
- `bg-card` background, `border` border, 8px border-radius, ~160px wide
- Shadow: `0 8px 24px rgba(0,0,0,0.5)`
- Menu items (12px, `text-primary`, 32px row height, hover: `bg-card-raised`):
  - Set alert
  - Layout
  - Set trading defaults
  - _(divider)_
  - Draw
  - Add Indicators
  - Indicator Templates
  - Chart type
  - Chart settings

### 5.7 Limit Order Inline Overlay
- Appears anchored to chart, floating card
- `bg-card`, `border`, 8px radius
- "Trigger at limit" label (11px, `text-secondary`)
- Price display: `₹1,376,375.46` (14px bold)
- "Limit Price" label + `%` input (small, `bg-base` bg)
- "Add TP" button — outlined, small, 11px
- Confirm/dismiss affordance

### 5.8 Switch Leg Panel
- Right-side slide-in panel or overlay (~380px wide)
- Title: "Switch Leg" (16px, 600 weight)
- Tabs: `Option chain` | `Surfbase` — pill tab style, active tab `bg-card-raised`
- Option chain table:
  - Three column groups: **Calls** | **Strike** | **Puts**
  - Sub-columns: OI, Chg%, Price | Strike | Price, Chg%, OI
  - Headers: 10px `text-secondary` uppercase
  - Rows: 12px, alternating subtle bg tint, ITM rows have stronger tint
  - ATM row: slightly brighter, may have a horizontal rule
  - Row height: ~28px
  - Scrollable list

### 5.9 Trading Defaults Modal
- Centered modal, ~380px wide, max-height ~480px
- Overlay: `rgba(0,0,0,0.6)` backdrop
- Container: `bg-card`, `border`, 12px border-radius
- Header: "Trading Defaults" (16px, 600) left | "Reset" link (`text-secondary` 12px, underline) + "×" icon right
- Tabs: `Quantity` | `Price` | `SL & TP` — pill tabs, active: `bg-card-raised`
- **Quantity Tab**:
  - Section label: "Indices" (10px, uppercase, `text-muted`)
  - Rows: instrument name (13px) | `—` stepper value `+` (value 14px bold, buttons 20px) | lot count (10px muted)
  - Instruments: NIFTY, BANKNIFTY, FINNIFTY, SENSEX
  - Row height: 44px, bottom divider `border-subtle`
- **Price Tab**:
  - Section labels: "Stocks", "Options", "Futures"
  - Each section: "Price type" label + dropdown (`at market` / `at limit`)
  - When "at limit": "Limit price" label + input with `%` suffix
  - Dropdown: `bg-base` bg, `border`, 6px radius, chevron icon, 13px text
- **SL & TP Tab**:
  - Stoploss section:
    - "SL price type" dropdown
    - "SL trigger price" row: label + `%` input
    - "Trailing SL" row: label + toggle switch + `— 1 +` stepper
    - Sub-label: "Update every 1 pt" (10px muted)
  - Target Profit section:
    - "TP price type" dropdown
    - "TP trigger price" row: label + `%` input
- Footer: `Cancel` button (outlined, `border` border, `text-primary`, 40px height) | `Apply` button (solid `#FFFFFF` bg, `#000000` text, 40px height)

### 5.10 Right Sidebar Tab (Portfolio & Orders)
- Tab label runs vertically on far right edge: "Portfolio & Orders" text rotated 90°
- 12px, `text-secondary`
- Clicking expands a side panel (not fully shown in designs)

---

## 6. Interaction States

| Element | Default | Hover | Active | Disabled |
|---------|---------|-------|--------|----------|
| Button (Buy/Sell) | solid color | brightness +10% | brightness -5% | opacity 0.4 |
| Icon button | `text-secondary` | `text-primary` | `text-primary` | opacity 0.3 |
| Menu item | transparent | `bg-card-raised` | `bg-card-raised` | — |
| Tab | `text-secondary` | `text-primary` | `bg-card-raised` + `text-primary` | — |
| Toggle (on) | green track | — | — | — |
| Toggle (off) | `border` track | — | — | — |
| Input | `bg-base` border `border` | border `text-secondary` | border white | — |

---

## 7. Screens Identified

| # | Screen / View | File(s) |
|---|---------------|---------|
| 1 | Main dual-chart trading view | Frame 1597886680.png, 204444, 204802, 204817 |
| 2 | Three-dot context menu — chart options | 204530, 204541 |
| 3 | Three-dot context menu — trading defaults shortcut | 204530 |
| 4 | Limit order inline overlay (on chart) | 204646, 204653 |
| 5 | Switch Leg panel — option chain tab (compact) | 204707 |
| 6 | Switch Leg panel — option chain tab (expanded) | 204723, 204733 |
| 7 | Position P&L summary side panel | 204743 |
| 8 | Trading Defaults modal — Quantity tab | 204833, 204848 |
| 9 | Trading Defaults modal — Price tab (at market) | 204856 |
| 10 | Trading Defaults modal — Price tab (at limit) | 204905 |
| 11 | Trading Defaults modal — SL & TP tab (SL section) | 204914 |
| 12 | Trading Defaults modal — SL & TP tab (TP section) | 204923 |
| 13 | Left Navbar icons | Navbar.png |

---

## 8. Scope of Work

### Priority 1 — Core Shell (must ship first)
These are the structural pieces everything else mounts inside.

- [ ] **Global layout** — top bar + left navbar + main content area
- [ ] **Top bar** — search, index ticker chips (NIFTY/SENSEX), PnL chip, Margin chip
- [ ] **Left navbar** — icons with correct visual, bottom group, hover states
- [ ] **Stock sub-header** — back, name, signals badge, price, exchange badge, one-click toggle

### Priority 2 — Main Trading View
The primary user-facing screen.

- [ ] **Dual chart grid** — two equal-width chart panels side by side
- [ ] **Chart panel shell** — instrument label, exchange, price, timeframe selector
- [ ] **Candlestick chart** — OHLCV candles, volume bars, price axis, time axis, current price line with price box
- [ ] **Buy/Sell action bar** — buy/sell buttons, quantity stepper, lot count label

### Priority 3 — Overlays & Modals
All the interactive layers that float above the chart.

- [ ] **Context menu** — three-dot trigger, 9 menu items with divider
- [ ] **Trading Defaults modal** — 3 tabs, all field types (stepper, dropdown, toggle, % input, stepper)
- [ ] **Switch Leg panel** — title, two tabs, option chain table with Calls/Strike/Puts layout

### Priority 4 — Inline Order Flow
- [ ] **Limit order overlay** — anchored to chart, trigger price, limit % input, Add TP button

### Priority 5 — Supporting Panels
- [ ] **Position P&L side panel** — realized/unrealized P&L rows, instrument name
- [ ] **Portfolio & Orders sidebar tab** — vertical label, expand/collapse

---

## 9. What is NOT in scope (for prototype)

- Real market data / WebSocket feeds — use hardcoded mock data
- Authentication / login flow
- Order execution (Buy/Sell actually fires) — buttons are visual only
- Real candlestick charting library integration — use a static SVG or lightweight mock chart
- Responsive / mobile layout — desktop only (min-width ~1200px)
- All indicator overlays (ATR, RSI etc.) — chart body is decorative for prototype
