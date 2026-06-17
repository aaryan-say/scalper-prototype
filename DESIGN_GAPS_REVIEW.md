# Design Gaps Review - Current Claude Build

Reviewed against:

- `reference-images-from-design-team/Frame 1597886680.png`
- `reference-images-from-design-team/Screenshot 2026-06-14 204444.png`
- `DESIGN_BRIEF.md`
- Current rendered app at `http://localhost:5173/`
- Screenshot captured as `review-default.png`

## Summary

Claude's build has the right broad structure: top bar, left nav, stock header, dual charts, buy/sell controls, modals, switch-leg panel, and side panel. The main gap is that it behaves and looks like a generic functional trading app instead of a pixel-faithful mock of the supplied design.

The highest-priority correction is to freeze the default screen to match the reference visually before improving interactions.

## Critical Gaps

### 1. App frame is wrong

Current:

- App fills the entire browser edge-to-edge.
- No rounded outer application shell.
- No visible outer stroke/shadow like the master frame.

Reference:

- App is a rounded dark terminal window inside the viewport.
- Outer radius is around 12-16px.
- There is a subtle border and shadow around the whole product surface.

Required change:

- Add a centered `.app-shell`/outer wrapper or style `#app` with inset margin, border radius, border, and shadow.
- Body should show a neutral dark/gray surrounding background.

### 2. Static values do not match reference

Current rendered values:

- TATAPOWER: `Rs 348.50`
- Spot chart: around `358.35`
- Option chart: `35.20`, current around `24.52`
- NIFTY: `Rs 24,186.00`
- SENSEX: `Rs 79,501.00`
- Margin: `Rs 5.00L`

Reference values:

- Header: `TATAPOWER Rs 1,293.65 +12.25 (0.95%)`
- Left chart label: `Spot`, `345.30 +12.25 (0.25%)`
- Left current price marker: `1,376.00`
- Right chart: `30 Mar 360 PE`, `210.10 +65.21 (14.22%)`
- Right current price marker: `498.50`
- NIFTY: `Rs 28,048.65 +241.25 (0.95%)`
- SENSEX: `Rs 25,048.65 -14.87 (3.48%)`
- Margin: `Rs 24.5k`

Required change:

- For design fidelity, stop using generated live/random data on the default screen.
- Use hardcoded mock values that match the screenshots.
- Live movement can be optional later, but the first visual state must match the design.

### 3. Chart visual direction and scale are wrong

Current:

- Left chart is volatile and ends near the middle.
- Right chart trends downward and ends low.
- Grid lines are too bright and rectangular.
- Lightweight Charts watermark/logo is visible in both charts.
- Price axis values are not the same range as the reference.

Reference:

- Both charts show a strong upward move with consolidation near the top-right.
- Left chart price axis ranges roughly `1,304` to `1,392`.
- Right chart price axis ranges roughly `450` to `530`.
- Candles are smaller and visually denser.
- No visible third-party chart watermark.
- Background has a softer navy-to-black terminal depth.

Required change:

- Replace the default generated chart data with fixed OHLC arrays shaped like the reference.
- Hide/remove chart attribution if license permits, or avoid the library and use SVG/canvas mock chart.
- Reduce grid contrast.
- Match price ranges and end-state positions.

### 4. Buy/Sell controls are not placed like reference

Current:

- Buy/Sell controls sit in a full-width bottom strip per chart.
- Buttons are attached to the chart footer line.
- Quantity block is a separate dark rectangle.

Reference:

- Trade controls are floating rounded capsules inside the lower chart area.
- Each chart has one compact pill: Buy, minus, quantity, plus, Sell.
- The pill has a black raised container with a subtle border.
- It does not span the entire chart width.

Required change:

- Make `.buy-sell-bar` position absolute near bottom center of each chart panel.
- Remove the full-width footer-strip look.
- Use one rounded black container around Buy/qty/Sell.
- Bottom footer shortcuts should live separately below the charts.

### 5. Missing bottom footer shortcuts

Current:

- No visible `Option chain` / `Strategies` shortcuts in the captured default screen.

Reference:

- Bottom-right footer contains `Option chain > | Strategies >`.
- Footer is a dark strip below the chart panels.

Required change:

- Add persistent bottom footer strip.
- Right-align `Option chain` and `Strategies` with muted icons/text.

### 6. Navbar icon set is not faithful

Current:

- Logo crop is used, which is good.
- Third icon is a cloud.
- Spacing/sizing feels a little compressed.
- Some icons are generic and do not match the reference sequence.

Reference:

- Icons: logo, bookmark, chain-link, script/f, archive/tray, notebook.
- Bottom: AI sparkle, bell, avatar.
- The chain-link icon appears active/white in default screenshots.

Required change:

- Replace cloud icon with chain-link icon.
- Make chain-link the active/white nav item.
- Keep cropped logo, AI sparkle, and avatar.
- Bell can be cropped or vector, but size should match the reference.

### 7. Right sidebar tab is too flat and too large

Current:

- Full-height vertical strip.
- Text is centered and stretched across the whole right edge.

Reference:

- A compact vertical tab attached near the upper-middle/right edge.
- Text `Portfolio & Orders` is vertical with a small icon.
- It appears as a rail/tab, not a full side column.

Required change:

- Convert right tab into an absolutely positioned vertical pill/rail.
- Width around 28px, height around 170-190px.
- Position from top around the chart header area.

### 8. P&L panel interaction is wrong

Current:

- P&L detail seems implemented as a full right side panel via `#pnl-panel`.
- Trigger is the right sidebar tab.

Reference:

- P&L chip in the top bar opens a small dropdown.
- Dropdown content: Today's P&L, Realised P&L, Unrealised P&L, then TATAPOWER P&L rows.
- It floats under/near the PnL chip, not as a full right drawer.

Required change:

- Add top PnL dropdown behavior.
- Keep `Portfolio & Orders` side panel optional, but it should not replace the reference P&L dropdown.

### 9. Switch Leg panel is wrong shape and placement

Current:

- `#switch-leg-panel` is a full-height right drawer: `top: var(--top-bar-h)`, `right: 0`, `height: calc(100vh - topbar)`, `width: 400px`.
- Tab label says `Surfbase`.

Reference:

- Switch Leg is a floating rounded panel over the right chart.
- Width around 320-340px.
- It does not cover the whole height.
- Tab label is `Surfaces`, not `Surfbase`.
- It has either Option chain table or Surfaces heatmap.

Required change:

- Reposition as fixed/absolute floating card inside/right over chart area.
- Use `Surfaces`.
- Add the top controls: Calls, date dropdown, Puts.
- Add highlighted ATM row and center strike marker `22476`.

### 10. Context menu content and hierarchy need refinement

Current:

- One combined context menu has all items.
- Menu rows are generic.

Reference:

- There are at least two menu states:
  - Small menu: `Set alert`, `Layout` with subtitle, `Set trading defaults`.
  - Chart menu: `Duration`, `Interval`, divider, `Draw`, `Add indicators`, `Indicator templates`, divider, `Chart type`, `Chart settings`.

Required change:

- Implement separate menu variants depending on trigger.
- Add subtitles under Duration/Interval/Layout/Chart type.
- Match menu width, row height, and chevrons.

### 11. Trading Defaults modal is close structurally but not pixel-faithful

Current:

- Modal exists with tabs and fields.
- Tab active state uses green underline.
- Modal title appears slightly small.
- Quantity lot counts differ by instrument.

Reference:

- Active tab underline is white.
- Modal title is about 16px, semibold.
- Quantity tab shows `235` and `16 lots` consistently in the screenshot.
- Body rows are more spacious and minimal, with less boxed stepper treatment.
- Footer buttons are wider and more prominent.

Required change:

- Change active tab underline to white.
- Increase title to 16px.
- Match row heights and spacing.
- Use reference lot counts for the visual state.
- Ensure modal is centered slightly above visual center with dimmed backdrop.

### 12. Inline order overlay does not match reference

Current:

- Generic order overlay: `BUY LIMIT - TATAPOWER`, current price, limit price, slippage, Place Order.

Reference:

- Inline editor is attached to TP/SL chart tags.
- TP editor has `Trigger at limit`, price/percent, `Estd. Loss`, `Limit Price`, `Add TP`.
- SL editor also has `Trailing SL` toggle and stepper, `Add SL`.

Required change:

- Replace generic order overlay with TP/SL-specific floating cards.
- Anchor visually to chart annotation tags.

### 13. Encoding artifacts in source

Current:

- HTML source contains mojibake such as `â‚¹`, `â–²`, `Ã—`, `â‹®`, `ï¼‹`.
- Browser may render some text acceptably depending on decoding, but source is corrupted and risky.

Reference:

- Uses rupee symbol, arrows, multiplication/close icons, chevrons, and lightning symbols cleanly.

Required change:

- Replace corrupted symbols with clean Unicode or HTML entities.
- Examples:
  - `₹` or `&#8377;`
  - `▲` / `▼`
  - `×`
  - `⋮`
  - `⚡`

## Recommended Fix Order

### Phase 1 - Default screen fidelity

1. Make the app a rounded terminal shell, not full-bleed.
2. Replace all default mock values with screenshot values.
3. Replace/generated chart data with fixed reference-shaped chart data.
4. Remove chart watermark or switch to custom SVG/canvas mock.
5. Convert Buy/Sell bars into floating capsules.
6. Add bottom-right `Option chain` / `Strategies` footer.
7. Fix nav icon sequence and active state.

### Phase 2 - Overlay fidelity

1. Split context menu into correct variants.
2. Convert Switch Leg drawer into floating panel.
3. Add top PnL dropdown.
4. Polish Trading Defaults modal.
5. Replace generic order overlay with TP/SL editor cards.

### Phase 3 - Final polish

1. Reduce grid contrast.
2. Tune navy/black gradients.
3. Tune font sizes and weights.
4. Fix all corrupted symbols.
5. Compare screenshots side-by-side at 976x726 and 1186x880.

## Design Verdict

Current build is a useful functional scaffold, but not yet close enough to the reference visually. It should be treated as a component base, then restyled and frozen into a screenshot-faithful prototype.
