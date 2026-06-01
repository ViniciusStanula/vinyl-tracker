---
name: Garimpa Vinil
description: Vinyl record price tracker for Amazon Brazil — find deals, discover artists, buy at the right moment.
colors:
  record: "#0c0a08"
  sleeve: "#171210"
  label: "#201614"
  groove: "#2b1e17"
  wax: "#3d2c21"
  patina: "#5a4232"
  gold: "#d98f0e"
  goldlit: "#f0ab28"
  goldmute: "#7a4f0e"
  cut: "#b81828"
  deal: "#1e7a50"
  deallit: "#35c47a"
  cream: "#f0e6d0"
  parchment: "#b8936a"
  dust: "#957060"
  ash: "#3d2a20"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "normal"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
  price:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 900
    lineHeight: 1.2
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    letterSpacing: "0.2em"
  caption:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.record}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.goldlit}"
    textColor: "{colors.record}"
  button-primary-disabled:
    backgroundColor: "{colors.goldmute}"
    textColor: "{colors.dust}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cream}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-ghost-hover:
    backgroundColor: "{colors.groove}"
    textColor: "{colors.cream}"
  chip-active:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.record}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  chip-inactive:
    backgroundColor: "{colors.groove}"
    textColor: "{colors.parchment}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  chip-inactive-hover:
    backgroundColor: "{colors.groove}"
    textColor: "{colors.cream}"
  card-album:
    backgroundColor: "{colors.sleeve}"
    rounded: "{rounded.lg}"
  input-search:
    backgroundColor: "{colors.sleeve}"
    textColor: "{colors.cream}"
    rounded: "{rounded.full}"
    padding: "8px 16px 8px 40px"
---

# Design System: Garimpa Vinil

## 1. Overview

**Creative North Star: "The Crate Digger's Den"**

Garimpa Vinil runs on the obsessive energy of flicking through record sleeves in a warm, dim shop — the kind where the owner knows every pressing and the last time a title dipped below R$80. The design doesn't simulate a streaming service or an e-commerce storefront. It simulates that shop: warm-dark surfaces, amber light catching the edge of a sleeve, deals surfaced with the quiet confidence of someone who has been watching prices for years.

The palette is the Den itself: near-black warm backgrounds layered from deep to slightly-less-deep, with amber gold as the single voice of action and value. Text lives on a warm cream-to-amber ramp, so every level of hierarchy reads as the same material, not a different page. Status signals (discount red, deal green) enter only when data warrants — never as decoration. A 3.5% grain overlay across the entire surface simulates the texture of printed paper without visual noise: the physical world of records bleeding into the digital tracker.

This system is built mobile-first for casual discovery, but its density and precision serve the obsessive collector equally. The deal is always the hero. Fraunces — a variable optical-size serif — carries display headings, album titles, and price figures: wherever the data is the content. DM Sans handles everything else without asking to be noticed. Components are tactile and confident: the gold primary button sits visually forward on any dark surface and feels pressable. Cards feel like objects, not rows.

This system explicitly rejects: SaaS hero-metric layouts with purple gradients and feature grids; Spotify green or Apple Music pink streaming aesthetics; Amazon and Mercado Livre blue-and-orange price-tag utilitarianism; glassmorphism used decoratively; and any interface legible as "generic music product."

**Key Characteristics:**
- Warm-dark tonal layering without drop shadows; depth through surface steps (Record → Sleeve → Label → Groove → Wax)
- Gold accent reserved for primary action and deal signal only; its scarcity is what makes deals visible
- Fraunces for display, album titles, and prices; DM Sans for all UI chrome — never mixed
- Touch-native density: readable at arm's length, tappable at 44px minimum
- Grain overlay at 3.5% opacity across the body; vinyl-groove radial decoration on hero surfaces
- Motion is functional: state feedback and page transitions only; no orchestrated page-load choreography

## 2. Colors: The Crate Digger's Den Palette

A six-step warm-dark neutral stack, one amber accent, two semantic signals, and a three-weight warm text ramp. Every color earns its place by function.

### Primary
- **Crate Gold** (`#d98f0e`): The single action color. Primary buttons, active filter chips, current price display, deal badges, brand logo. Signals "act on this" or "this is a deal." Present on ≤15% of any given surface. Its rarity is enforced, not aspirational.
- **Goldlit** (`#f0ab28`): Hover and active state of Crate Gold. Never appears at rest. Its higher brightness reserves itself for the instant of interaction.
- **Goldmute** (`#7a4f0e`): Disabled or suppressed gold. Loading state buttons, inactive deal badges.

### Secondary
- **Deal Bright** (`#35c47a`): Positive signal for sparkline lines when a price is below its historical average. Also "Ótima Oferta" badge on cards when price history is visible.
- **Deal Muted** (`#1e7a50`): Background for the "Ótima Oferta" badge. Never decorative.
- **Cut Red** (`#b81828`): Discount percentage badge only. Signals financial savings, not danger or error. Applied with a `box-shadow: 0 4px 8px rgba(184,24,40,0.3)` to separate it from dark album art.

### Neutral
- **Record Black** (`#0c0a08`): The deepest surface. Page background, sticky nav (at 95% opacity), the floor of the depth stack.
- **Sleeve Brown** (`#171210`): Card backgrounds, form control fills. First step up from Record Black; where the album lives.
- **Label Dark** (`#201614`): Elevated card surfaces (image placeholder, raised panels). Second step up.
- **Groove** (`#2b1e17`): Borders, dividers, hovered list surfaces. The visual line between things.
- **Wax** (`#3d2c21`): Stronger borders, hover surface fill. Active state of a Groove-level element.
- **Patina** (`#5a4232`): Muted foreground elements, scrollbar thumb, empty-state illustrations.
- **Cream** (`#f0e6d0`): Primary text. All body copy, headings, active-state labels.
- **Parchment** (`#b8936a`): Secondary text. Artist names on cards, secondary labels, link text at rest.
- **Dust** (`#957060`): Muted and placeholder text. Captions, metadata, footer body, input placeholders. Minimum-contrast text color in the system; passes 4.5:1 on Record Black. Never go lighter.
- **Ash** (`#3d2a20`): Near-invisible muted surface. Subtle dividers that should barely register.

### Named Rules
**The One Voice Rule.** Gold (`#d98f0e`) is the only warm-bright accent in the entire system. It appears on primary buttons, active filter chips, current price figures, and the brand logo — nothing else. Decorative highlights, hover backgrounds, typographic flair: all prohibited. Its scarcity is what makes the deal visible.

**The Depth-Without-Shadows Rule.** Visual depth is created by stepping through the neutral stack (Record → Sleeve → Label → Groove → Wax), not by drop shadows. Hover states shift the border one step warmer. Active states shift the background fill one step up. The only drop shadows in the system: the Cut Red badge (`rgba(184,24,40,0.3)`) and the gold ring on top-deal cards. Everything else is flat.

**The Dust Floor Rule.** Dust (`#957060`) is the lightest permissible text color on dark surfaces. It is the system's WCAG AA floor. Below it — lighter, more muted — text fails contrast and is prohibited. If a text element needs to "feel quieter," use a smaller size or lighter weight; never a lighter hue than Dust.

## 3. Typography

**Display Font:** Fraunces (with Georgia, serif as fallback)
**Body Font:** DM Sans (with system-ui, sans-serif as fallback)

**Character:** Fraunces is a variable optical-size serif: expressive and warm at large scale, tighter and more refined at small scale. DM Sans is a clean humanist sans that disappears into function. The pairing works on a contrast axis (editorial serif vs. utility sans), not a similarity axis. Fraunces tells the story. DM Sans moves the user. They never appear in the same role.

### Hierarchy
- **Display** (Fraunces, 900 weight, `clamp(1.875rem, 5vw, 3.75rem)`, line-height 0.95): Hero headlines and the brand wordmark only. Italic variant for evocative phrases ("O Garimpo do Vinil"), upright for declarative payoffs ("Começa Aqui."). Never in UI chrome, buttons, or labels.
- **Price** (Fraunces, 900 weight, 1.25rem, line-height 1.2, tabular-nums): Current price on album cards. The most-scanned data point on any screen. Fraunces gives the number character without sacrificing legibility. Gold color only.
- **Title** (Fraunces, 600 weight, 0.875rem, line-height 1.3, line-clamp 2): Album title on cards. Uses Fraunces for warmth and editorial character at small sizes; minimum height 2.5rem to prevent card layout shift.
- **Headline** (DM Sans, 700 weight, 1.125rem–1.5rem, line-height 1.3): Page and section headings. Ratio to body ≥1.25.
- **Body** (DM Sans, 400 weight, 0.875rem–1rem, line-height 1.6): Body copy in guide prose and descriptions. Cap line length at 65–75ch for prose contexts.
- **Label** (DM Sans, 700 weight, 0.625rem, letter-spacing 0.2em, uppercase): Artist names on cards, footer section headers, filter/sort labels. ≤4 words. Never on full sentences.
- **Caption** (DM Sans, 400–500 weight, 0.75rem, line-height 1.4): Metadata, timestamps, status text, footnotes. Uses Dust color minimum.

### Named Rules
**The Fraunces Reservation Rule.** Fraunces appears in exactly three contexts: display/hero headings, album titles on cards, and current price figures. It is prohibited in navigation, buttons, labels, captions, form controls, filter chips, sort selects, or any UI chrome. Its presence signals "this is the content, not the container."

**The Uppercase Ceiling Rule.** Uppercase text is reserved for: artist name labels (≤4 words, tracked at 0.2em), filter and sort label eyebrows (≤4 words, tracked), and deal badge text. Never uppercase for body copy, album titles, or headings.

## 4. Elevation

This system is flat by design. Depth is expressed through the tonal surface stack — not through drop shadows. A card sits on Record Black; its Sleeve Brown background reads as elevated. Inside the card, the Label Dark image placeholder reads as one step further elevated still. No shadows required.

The two functional exceptions: the Cut Red discount badge uses `box-shadow: 0 4px 8px rgba(184,24,40,0.3)` to separate it from dark album covers; the top-deal card ring uses `box-shadow: 0 0 0 1px rgba(217,143,14,0.4)` to signal tier-3 deal status.

Focus and hover depth: ring utilities (`ring-2 ring-gold/20`) on focused inputs and buttons; `ring-1 ring-gold/40` on top-deal cards at rest.

Backdrop blur (`backdrop-blur-md`, 12px) is used on the sticky navbar and mobile overlay — functional legibility where content scrolls underneath.

### Named Rules
**The Flat-By-Default Rule.** No drop shadows on cards, modals, drawers, or containers at rest. Before reaching for `box-shadow`, ask whether a border-color shift or background-fill step does the job. It almost always does.

## 5. Components

### Buttons

Tactile and confident. The gold primary sits visually forward on any dark surface and feels pressable. Ghost buttons are invisible until needed.

- **Shape:** Gently rounded (12px, rounded-xl). Not pill-shaped; pill is reserved for the search form.
- **Primary:** Gold (`#d98f0e`) background, Record Black (`#0c0a08`) text. DM Sans 700, 0.875rem. Padding 12px × 24px.
- **Primary Hover:** Background shifts to Goldlit (`#f0ab28`). Transition: `background-color 150ms ease`.
- **Primary Disabled:** Background Goldmute (`#7a4f0e`), text Dust (`#957060`), `cursor: not-allowed`.
- **Ghost:** Transparent background, Wax border (`#3d2c21`), Cream text. Same shape and padding as primary. Hover: Groove fill (`#2b1e17`).
- **Focus (all variants):** `box-shadow: 0 0 0 2px rgba(217,143,14,0.2)`. No outline override.

### Filter Chips

Toggle-style in the SortBar. One active, rest inactive.

- **Active:** Gold background and border, Record Black text. DM Sans 700, 0.75rem, rounded-lg (8px), padding 10px × 12px.
- **Inactive:** Groove background, Wax/60 border, Parchment text. Hover: Wax border, Cream text.
- **Focus:** `box-shadow: 0 0 0 2px rgba(217,143,14,0.2)` on `:focus-visible`.
- **Loading/pending:** Whole SortBar fades to 55% opacity via `opacity: 0.55` during router transition.

### Album Card

The primary content unit. Warm, dense, informative.

- **Container:** Sleeve background, Groove border, rounded-xl (12px). Hover: border shifts to Wax (200ms ease). Top-deal variant adds `ring-1 ring-gold/40`.
- **Album art:** Full-bleed `aspect-ratio: 1`. On hover: image scales to 106% (ease-out, 500ms). Gradient overlay (Record Black to transparent) appears at image bottom on hover — legibility, not decoration.
- **Discount badge (top-left):** Cut Red background, 0.75rem DM Sans 900, rounded-sm (4px), colored shadow. Suppressed when price history is hidden.
- **Deal badge (bottom-left):** 9px DM Sans 700 uppercase. Tier 3: Gold/90 + Record Black text. Tier 2: Deal/90 + Cream text. Tier 1: Record/70 + Parchment text + backdrop-blur.
- **Amazon link (top-right):** Opacity 0 at rest, 100 on hover (always visible on touch). Record/80 background + backdrop-blur, Cream text, rounded-md.
- **Info panel:** `padding: 16px`. Artist in Label style (Parchment). Title in Fraunces 600 0.875rem (Cream, line-clamp-2). Price in Fraunces 900 1.25rem (Gold), pushed to bottom with `margin-top: auto`.

### Search Field

Pill-shaped combined input + submit. Full-width in the navbar.

- **Input:** Sleeve background, Groove border, `border-radius: 9999px 0 0 9999px`. Left padding 40px for icon. Cream text, Dust placeholder. Focus: Gold border + `ring-2 ring-gold/20`.
- **Submit button:** Gold background, Record Black bold text, `border-radius: 0 9999px 9999px 0`. Hover: Goldlit. Matches input height exactly.
- **Loading state:** Gold animated spinner replaces search icon; input opacity drops to 60%.

### Sort Select

Native `<select>` styled to match the system surface vocabulary.

- **Default:** Groove background, Cream text, Wax/60 border, rounded-lg (8px). DM Sans, 0.875rem.
- **Focus:** Gold border, `ring-2 ring-gold/20`.

### Navigation

Sticky, always present, warm-dark.

- **Container:** Record Black/95 background, `backdrop-filter: blur(12px)`, Groove/60 bottom border. Height 62px. z-index 50.
- **Brand:** Vinyl SVG logo (Gold concentric circles over Record Black center) + Fraunces 900 "Garimpa" in Gold. The only Fraunces instance in the navbar.
- **Desktop links:** DM Sans 700, 0.75rem, uppercase, letter-spacing 0.05em. Dust at rest. Hover: Gold text + Groove/40 background fill. Active page: Cream, no background.
- **Mobile drawer:** Sleeve background, `box-shadow: 0 25px 50px rgba(0,0,0,0.5)`. Links scale to 1rem, full-width, rounded-xl. Active: Wax fill, Cream text.

### Deal Badge (Signature Component)

The most visible data signal on the album card. Three tiers at a glance — no numbers needed.

- **Tier 3 — Melhor Preço:** `✦` icon prefix. Gold/90 background, Record Black text. Paired with `ring-1 ring-gold/40` on the card container.
- **Tier 2 — Ótima Oferta:** `✓` icon prefix. Deal/90 background, Cream text.
- **Tier 1 — Boa Oferta:** No icon. Record/70 background, Parchment text, `backdrop-filter: blur(4px)`.
- **All tiers:** DM Sans 700, 9px, uppercase, `letter-spacing: 0.05em`. `border-radius: 4px`. Positioned bottom-left over album art at z-index 20.
- **Gate:** All deal badges and discount percentages are suppressed globally when `NEXT_PUBLIC_HIDE_PRICE_HISTORY` is active (Amazon Associates compliance). Zero badge rendering in that mode.

## 6. Do's and Don'ts

### Do:
- **Do** use Gold (`#d98f0e`) exclusively for primary actions, active states, current prices, and the brand logo. The One Voice Rule: its scarcity is what makes deals visible.
- **Do** express depth through tonal surface steps (Record → Sleeve → Label → Groove → Wax). Step the border one stop warmer on hover; step the background fill one level up on active.
- **Do** use Fraunces for hero headings, album titles, and price figures only. DM Sans handles every other text role. The Fraunces Reservation Rule.
- **Do** ensure minimum text contrast: Dust (`#957060`) on Record Black (`#0c0a08`) is the WCAG AA floor — 4.5:1. Never use a lighter text color for readable content.
- **Do** size all tap targets to minimum 44px height for mobile-first touch use.
- **Do** include `@media (prefers-reduced-motion: reduce)` alternatives for every animation: crossfade or instant for `fade-in-up`; stop pulsing for `vinyl-pulse`; instant progress for the nav bar.
- **Do** use `text-wrap: balance` on h1–h3 and `text-wrap: pretty` on prose paragraphs in guide content.
- **Do** gate all deal badges and price-history features behind `NEXT_PUBLIC_HIDE_PRICE_HISTORY` — this is an Amazon Associates compliance requirement, not a feature flag.

### Don't:
- **Don't** use Gold as a decorative highlight, section divider tint, or background wash. The One Voice Rule: it signals action or value, nothing else.
- **Don't** use Fraunces in navigation, buttons, filter chips, form controls, labels, or any UI chrome. The Fraunces Reservation Rule.
- **Don't** add drop shadows to cards, containers, or layout surfaces. The Flat-By-Default Rule: tonal stepping and border shifts carry depth.
- **Don't** make this look like a SaaS product. No hero metrics (big number + small label + gradient accent), no purple/blue/teal brand colors, no feature-grid layouts, no buzzword copy ("supercharge," "empower," "seamless").
- **Don't** make this look like a streaming service. No Spotify green, no Apple Music pink, no play-button affordances, no playlist-card visual language.
- **Don't** make this look like an e-commerce giant. No Amazon/Mercado Livre blue-and-orange, no "Adicionar ao Carrinho" button language, no star-rating rows beside prices, no product-grid sameness.
- **Don't** use `border-left` greater than 1px as a colored accent stripe on cards, callouts, or list items. Use full borders, background tints, or leading icons instead.
- **Don't** use `background-clip: text` with a gradient fill. Gold is always solid.
- **Don't** use glassmorphism decoratively. Backdrop blur is reserved for the sticky navbar and mobile overlay where it serves legibility — not cards, modals, or decorative surfaces.
- **Don't** add orchestrated page-load motion sequences. This is a product tool; users land in a task. State-change feedback and page transitions only; 150–250ms on most transitions.
- **Don't** use text lighter than Dust (`#957060`) on dark surfaces. Below Dust, contrast fails WCAG AA. The Dust Floor Rule.
- **Don't** show deal badges or discount percentages when `NEXT_PUBLIC_HIDE_PRICE_HISTORY` is true. Amazon Associates Operating Agreement prohibits displaying monitored price history from a single retailer.
