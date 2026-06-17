# Asset Extraction Notes

Use this file with `DESIGN_BRIEF.md` when building the prototype.

## Directly Cropped Assets

The following assets were extracted from `reference-images-from-design-team/Navbar.png` and saved in `assets/`:

| Asset | File | Why use image asset |
|-------|------|---------------------|
| Logo | `assets/logo.png` | Brand-specific shape and gradient should remain exact. |
| AI sparkle | `assets/ai-sparkle.png` | Custom gradient icon, not a generic icon. |
| Bell | `assets/bell.png` | Can be reused directly, though lucide bell is acceptable if layout needs vector sizing. |
| Avatar | `assets/avatar.png` | Must be an image crop, not recreated. |

## What To Recreate In CSS / Icons

- Search icon, chevrons, menu dots, plus/minus, bookmark, link, archive, notebook, close icon, and toggle controls can be recreated with icon components or CSS.
- Buy/Sell lightning symbols can be text/icon glyphs; exact brand fidelity is less important than size, color, and spacing.
- Candlestick charts should be drawn as mock SVG/canvas/HTML elements, not cropped from screenshots, so the UI can support overlay states.

## Gradient Accuracy

Sampled from the real cropped assets:

- Logo approximate stops: `#90D0C0`, `#70C0E0`, `#60C0F0`, with light mint highlights around `#A0E0B0`.
- AI sparkle approximate stops: `#20B080`, `#20A060`, `#40A040`, `#60A030`.

Recommended CSS variables:

```css
:root {
  --brand-mint: #90d0c0;
  --brand-cyan: #70c0e0;
  --brand-blue: #60c0f0;
  --ai-teal: #20b080;
  --ai-green: #40a040;
  --ai-lime: #60a030;
  --gradient-logo: linear-gradient(135deg, #90d0c0 0%, #70c0e0 55%, #60c0f0 100%);
  --gradient-ai: linear-gradient(135deg, #20b080 0%, #40a040 58%, #60a030 100%);
}
```

For pixel fidelity, prefer the cropped PNGs for the logo and AI sparkle. Use the gradients only for nearby glow, active state accents, or fallback vector icons.

## Practical Rule

If an element is brand-specific or photographic, crop it from the reference. If it is a common UI control, recreate it in CSS/vector so it scales cleanly and can respond to hover/active states.
