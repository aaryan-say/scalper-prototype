# Design vs Prototype — Gap Analysis
_Compared reference images against live prototype. Grouped by severity._

---

## 🔴 Critical (wrong or missing entirely)

### 1. Order Overlay (OMS) — Wrong position + wrong content
**Reference (204646, 204653):**
- Appears as a floating card **overlaid on the chart body** itself, mid-right area
- NOT anchored to the buy/sell bar
- Fields: "Trigger at limit" (header), current trigger price (large bold), "Limit Price" input, "Trading %" input
- Two actions: "Add TP" (outlined secondary) + "Add To" (solid primary)
- Card is compact ~220px wide, dark bg, subtle border, no backdrop dimming

**What was built:**
- Appears near the buy/sell bar at the bottom
- Fields say "Limit Price" + "Slippage %" (wrong labels)
- Button says "Place Order" (wrong label — should be "Add To")
- Positioned wrong (bottom-anchored, not floating on chart)

---

### 2. Bottom tab bar on right chart — Missing entirely
**Reference (Frame 1597886680):**
- Below the right buy/sell bar, two small text tabs: `Option chain ✓` and `Strategies >`
- These are persistent shortcut links to the option chain panel and strategies panel
- Font ~10px, muted color, separated by `/`

**What was built:** Nothing. Not implemented.

---

### 3. Chart instrument label style — Wrong format
**Reference:**
- Left chart: `Spot ○` — where `○` is a small dropdown-indicator circle (suggesting the Spot/Futures toggle is a clickable selector)
- Right chart: `30 Mar 360 ○` then `PE ○` — strike AND option type are each separate selectors with dropdown indicators
- The `○` and `÷` symbols after each label indicate these are clickable dropdowns, not plain text

**What was built:**
- Left: plain "Spot" text + separate "NSE" badge
- Right: a button "30 Mar 360 ▾" + a static "PE" badge
- The option type (PE/CE) should also be a dropdown selector

---

## 🟠 High (visually noticeable)

### 4. Buy/Sell bar — Layout and button style differ
**Reference:**
- Buttons: `+ Buy` (green) then quantity as `— 235 +` (minus, number, plus inline) then `+ Sell` (red)
- The `+` icon before "Buy"/"Sell" is a small lightning or plus symbol
- "16 lots" sits BELOW the 235 number, centered
- Quantity number is larger (~14px bold) than the lots text (~9px muted)
- The stepper minus/plus are NOT part of a box — they are standalone icon buttons adjacent to the number

**What was built:** Similar structure but the minus/plus are inside a box container which makes it look boxier. Reference has more breathing room between elements.

---

### 5. Right "Portfolio & Orders" sidebar tab — Wrong width
**Reference:** The vertical tab on the far right is very thin — text is clearly `Portfolio & Orders` written vertically, and the tab is barely wider than the text (roughly 20px)

**What was built:** 24px wide tab — close but the text overflow and padding might make it look off.

---

### 6. P&L / Position panel (204743) — Different layout
**Reference:**
- Panel title shows instrument name: "TATAPOWER P&L"
- Shows "Realized P&L" label + value
- Shows the option contract separately: "TATAPOWER P&L" section header
- Position values show qty `← 243` format with arrow indicating direction

**What was built:** Generic "Portfolio & Orders" panel with different structure.

---

### 7. Sub-header exchange badge — Minor but visible
**Reference:** `NSE ℹ` — the info icon is smaller and the badge background is barely distinguishable from the sub-header background (nearly invisible border)

**What was built:** Slightly more prominent badge with a raised background.

---

## 🟡 Medium (styling differences)

### 8. Index ticker format in top bar
**Reference:** `NIFTY 50 ₹28,048.65 ▲ 241.25 (0.95%)` — the index name is in a slightly different weight than the price, and there's NO visible chip/card boundary around each index — they just sit as plain text groups separated by spacing

**What was built:** Similar but wrapped in `.index-chip` divs which may add visual separation not present in the reference.

---

### 9. Top bar PnL and Margin chips
**Reference:** `PnL: ₹0.00` and `Margin: ₹24.5k` are in small pill chips with very subtle borders — barely visible against the top bar background

**What was built:** Similar but the border and background contrast might be slightly more pronounced.

---

### 10. Signals badge
**Reference:** `• 24 signals` — the dot is amber/orange, badge text is `24 signals` in lowercase, very small (10px), background is very subtle (almost no visible chip)

**What was built:** Built with `::before` pseudo-element dot — likely close but font weight and badge prominence needs checking.

---

### 11. Chart volume bars — too prominent
**Reference:** Volume bars are very short and subtle — they occupy roughly the bottom 15% of the chart and are semi-transparent (low opacity)

**What was built:** `scaleMargins: { top: 0.8, bottom: 0 }` — this means volume takes 20% from bottom. Should be reduced to ~15%.

---

### 12. One-click toggle position
**Reference:** The "One-click" toggle sits at the very right of the sub-header with minimal gap from the `⋮` button

**What was built:** Similar positioning but spacing between the toggle label and the `⋮` may differ.

---

## 🟢 Minor / Polish

### 13. Context menu — Icon presence
**Reference context menus (204530, 204541):** Items have NO icons — they are clean text-only menu items. Reference shows plain text list, no SVG icons.

**What was built:** Icons added next to each menu item — this is not in the reference and makes the menu look more cluttered.

---

### 14. Chart current-price box color
**Reference:** The price box on the right axis is **bright green filled with white text** when price is up, **bright red** when down.

**What was built:** Lightweight Charts handles this automatically — should be correct. But worth verifying in browser.

---

### 15. Timeframe selector
**Reference:** `5m ÷` — uses a `÷` symbol (division sign), not a `▾` chevron

**What was built:** Uses `▾` — should be `÷` or similar separator symbol.

---

---

## 🔴 Gradient & Color Gaps (missing from original list)

### 16. Toggle ON color — Wrong colour entirely
**Reference (204914, sub-header):**
- Trailing SL toggle when ON: clearly **teal-blue** — approximately `#06B6D4` / `#3B82F6` (cyan-to-blue family)
- One-click toggle in sub-header: same teal-blue family when ON
- This is the most visible colour error in the whole prototype

**What was built:**
- All toggles use `var(--green)` (`#00C853`) when ON — bright green, completely wrong colour

---

### 17. Logo gradient — Wrong colour stops
**Reference (Navbar.png):**
- The flag/chart logo is a **teal body** with a white zigzag, gradient runs teal-green → cyan
- Approximate stops: `#20B2AA` (teal) → `#40E0D0` (turquoise) — a warm teal family
- The shape is a waving flag outline with a white chart line inside it

**What was built (ASSET_EXTRACTION_NOTES.md + tokens.css):**
- Codex extracted stops: `#90d0c0` → `#70c0e0` → `#60c0f0` — these are too pastel/washed out
- If the PNG asset loads, it's fine. If it fails the fallback CSS gradient looks wrong.

---

### 18. AI Sparkle gradient — Wrong colour stops
**Reference (Navbar.png):**
- 4-pointed star sparkle uses **vivid lime-green** at the tips → **medium green** at centre
- Approximate stops: `#22C55E` (bright green) → `#84CC16` (lime-yellow-green)
- The colour is clearly in the "grass green to lime" family, not teal

**What was built:**
- tokens.css fallback: `#20b080` → `#40a040` → `#60a030` — too teal/olive, not the right green family
- Again, PNG asset overrides this if it loads — but fallback is wrong

---

### 19. Navbar icon colour — Too dark
**Reference (Navbar.png):**
- All non-active icons (bookmark, cloud, f, archive, notebook, bell) are a **medium cool grey** — approximately `#9CA3AF` or `#A1A5B4`
- They are noticeably lighter than what feels like full muted grey

**What was built:**
- `--text-muted: #555870` used for icons — this is too dark, the reference icons are more visible/lighter

---

### 20. Chart background — Slightly different shade
**Reference:**
- Chart panel background appears to be approximately `#13141A` or `#14151B` — very slightly warmer/darker than what I have
- The panel has zero gradient — completely flat

**What was built:**
- `--bg-panel: #161820` — close but may read as slightly too blue/cool

---

### 21. Price axis label colour
**Reference:**
- Right-side price scale labels (1,392.00, 1,384.00 etc.) are in a very **muted warm grey** — approximately `#6B7280`
- They are barely readable, intentionally low contrast

**What was built:**
- Lightweight Charts `textColor: '#8B8FA8'` — this is slightly too bright/blue

---

### 22. Buy/Sell buttons — Flat, no gradient (confirm correct)
**Reference:** Both Buy (green) and Sell (red) buttons are **perfectly flat solid fills** — no gradient, no shadow, no glow
- Buy: flat `#00C853` ✓
- Sell: flat `#EF4444` ✓
- This is already correct in the prototype — just confirming

---

### 23. Current price highlight box on chart axis
**Reference:** The live price box on the right axis is a **solid flat green fill** with white text — no gradient, no glow
- Already handled by Lightweight Charts natively ✓

---

### 24. Modal backdrop
**Reference (204848, 204914):** The backdrop behind modals is a **very dark semi-transparent black** — approximately `rgba(0,0,0,0.72)` — darker than typical

**What was built:** `rgba(0,0,0,0.6)` — slightly too light, the background content is more visible than in reference

---

### 25. Grid lines on chart
**Reference:** Chart grid lines are extremely subtle — barely visible, approximately `#1E2232` or `rgba(255,255,255,0.04)`

**What was built:** `#2A2D3E` — too bright, grid lines are more visible than in the reference

---

## Summary — Fix Priority Order

| Priority | Item | Effort |
|----------|------|--------|
| 1 | **Toggle ON colour: green → teal-blue `#06B6D4`** | Trivial |
| 2 | **Chart grid lines: `#2A2D3E` → `#1E2232` (much subtler)** | Trivial |
| 3 | **Modal backdrop: `rgba(0,0,0,0.6)` → `rgba(0,0,0,0.72)`** | Trivial |
| 4 | **Navbar icon colour: `#555870` → `#9CA3AF` (lighter)** | Trivial |
| 5 | Order overlay: reposition onto chart body + fix fields + "Add To" | Medium |
| 6 | Bottom tab bar: "Option chain / Strategies" below right chart | Low |
| 7 | Context menu: remove icons (text only) | Low |
| 8 | Buy/sell bar: spacing and stepper style | Low |
| 9 | Timeframe selector: `÷` instead of `▾` | Trivial |
| 10 | Chart instrument label: make PE/CE a clickable selector | Low |
| 11 | Volume bars: reduce scaleMargins top from 0.8 → 0.85 | Trivial |
| 12 | Price axis label colour: `#8B8FA8` → `#6B7280` in chart config | Trivial |
| 13 | Logo/AI gradient fallback CSS stops (only affects PNG load failures) | Low |
| 14 | P&L panel: match reference layout | Medium |
