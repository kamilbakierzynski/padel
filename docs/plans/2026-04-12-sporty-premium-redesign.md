# Padel Parade — Sporty Premium Redesign

**Date:** 2026-04-12  
**Status:** Validated design  
**Target:** iPad-first (landscape), touch-optimized

---

## Design Direction

| Dimension      | Choice                                                                 |
|----------------|------------------------------------------------------------------------|
| Vibe           | ⚡ Sporty Premium — Nike Run Club × ESPN                               |
| Colors         | 🟠 Bold Orange Evolution — darker backgrounds, electric orange pops    |
| Typography     | CONDENSED & BOLD — stadium scoreboard energy                           |
| Layout         | 👆 Swipe Flow — one screen, one focus, swipe between                   |
| Scoring        | 🎚️ Drag Slider — visual tug-of-war point distribution                 |
| Personality    | ✨ Subtle Delight — smooth micro-animations, tasteful emoji            |
| Dashboard      | 🏆 Hero Active Tournament — live game dominates home                   |
| Standings      | 🥇 Podium — top 3 elevated, rest ranked below                         |
| Navigation     | 👇 Bottom Tab Bar — thick, thumb-reachable, iOS-native                 |

---

## 1. Visual Foundation & Color System

### Background

Deep warm charcoal base replaces light cream/sand. Orange gets room to scream against darker surfaces.

### Palette

| Token            | Value     | Role                                        |
|------------------|-----------|---------------------------------------------|
| `surface-0`      | `#1A1614` | Base background                              |
| `surface-1`      | `#242220` | Cards, panels                                |
| `surface-2`      | `#2E2C2A` | Elevated elements, modals, bottom sheets     |
| `electric-orange` | `#FF6B1A` | CTAs, active states, primary accent          |
| `ember-glow`     | `#FF8F4F` | Gradients, highlights, warm supporting orange |
| `text-primary`   | `#F5F0EB` | Warm white — primary text                    |
| `text-muted`     | `#8A8480` | Warm gray — secondary text                   |
| `court-teal`     | `#2DD4A8` | Positive states (wins, points up)            |
| `rally-red`      | `#FF4757` | Alerts, losses                               |
| `gold`           | `#FFD43B` | #1 ranked player, champion moments           |

### Typography

- **Headlines & Scores:** Barlow Condensed — Bold/Black weight, all-caps, `tabular-nums` for score alignment
- **Body text:** Inter — clean readability
- Score numbers at `3rem–4rem`, hero titles at `2.5rem`

### Corners & Shapes

Sportier, sharper radii replacing ultra-rounded 2rem:
- Cards: `0.75rem`
- Buttons: `0.5rem`
- Pills & avatars: `9999px`

---

## 2. Layout System & Navigation

### iPad Landscape Optimization

Designed for 1024×768+ in landscape orientation.

### Bottom Tab Bar

- **64px tall**, full width, `surface-1` background
- **48px touch targets** — large and thumb-friendly
- Icon + short label per tab
- Active tab: orange pill background with subtle glow

**Tabs inside a tournament:**
- 🏠 Home — back to dashboard
- 🎾 Rounds — the swipe-flow match view
- 🏆 Standings — podium + ranked list
- ⚙️ Settings — tournament info, edit players

**Tabs on dashboard (no active tournament):**
- 🏠 Tournaments
- ➕ New

### Swipe Flow

- Each round is a **full-screen page**
- Swipe left/right to move between rounds
- **Round indicator** (numbered pills) sits above the tab bar: current round highlighted in orange
- CSS `scroll-snap-type: x mandatory` for native swipe physics

### Floating Header

- Tournament name + round number overlaid at top as translucent bar
- Fades out during scroll/interaction to maximize content space

### Safe Areas

Proper `env(safe-area-inset-*)` padding on all sides.

### Transitions

- Swiping: parallax-style horizontal slide (outgoing 1x, incoming 0.85x)
- Tab switches: fade + lift (opacity + 8px translateY)

---

## 3. Dashboard — Hero Active Tournament

### State A — Active Tournament Exists

**Hero Card** fills ~65% of viewport:
- Gradient border (orange → ember) with animated shimmer
- Tournament name in giant condensed caps (`2.5rem`)
- Live status pill: `🔴 ROUND 3 OF 6` in glowing orange badge
- Quick stats row: `8 Players · 2 Courts · Mexicano` as muted text chips
- Mini-standings preview: top 3 as horizontal bars (race chart style), #1 with gold accent
- Full-width **"Continue"** orange gradient pill button

**Past Tournaments** below hero: horizontal scrollable chips (name, date, winner). Tapping opens read-only summary.

### State B — Empty State (No Tournaments)

- Centered padel racket icon with bouncing ball animation
- `"LET'S PLAY"` in massive condensed caps
- Subtitle in muted body text
- Giant ➕ **New Tournament** orange pill button

### Micro-Delight

On tournament completion, the next active tournament's card scales up from the past tournaments row into the hero position.

---

## 4. Match Cards & Round View

### Layout

Full-screen page per round. Matches displayed as large stacked cards — one per court. On iPad landscape with 2 courts, each card gets ~40% of content area height.

### Match Card Anatomy

```
┌─────────────────────────────────────────────┐
│  COURT 1                          🎾        │
│                                             │
│   ALICE  &  BOB          12 ◄━━━━━► 9      │
│        vs                                   │
│   CAROL  &  DAVE         9  ◄━━━━━► 12     │
│                                             │
│   [ Tap to enter score ]                    │
└─────────────────────────────────────────────┘
```

- **Court label:** top-left, muted condensed caps + 🎾
- **Team names:** large bold, connected with `&`, left-aligned
- **`vs`:** between teams, muted small text
- **Scores:** right side, huge tabular numbers (`3rem`). Winner glows Electric Orange, loser muted
- **Unscored match:** pulsing `TAP TO SCORE` button in orange outline

### Bye Players

Slim banner below match cards: `😴 BYE: Erik` in muted `surface-2` strip with dashed border.

### Round Completion

All matches scored → **"Generate Next Round"** button bounces in from bottom: `⚡ GENERATE ROUND 4` — fat orange pill.

### Round Header (Floating)

`ROUND 3` in big condensed text + source pill: `STANDINGS` / `RANDOM` / `DETERMINISTIC` in tiny muted caps.

---

## 5. Score Slider — Scoring Experience

### Bottom Sheet

Tapping a match card opens a bottom sheet covering ~60% of screen. Slide-up with spring animation. Frosted glass `surface-2` with blur. Drag handle at top.

### The Slider

- Wide horizontal track (80% width, 56px tall) with chunky 48px draggable orange thumb
- **Tug-of-war visualization:** left fills with Team A color (orange gradient), right with Team B color (teal)
- Track ends show `0` and `21`
- Colors push each other as you drag — territory battle

### Score Display

Two massive numbers (`4rem`, condensed bold) above slider, one per team side:
- Animate in real-time as you drag
- Winning side in Electric Orange, other muted
- Spring animation makes numbers feel bouncy

### Quick-Pick Chips

Row below slider for common scores: `21-0 · 15-6 · 12-9 · 11-10` — tapping snaps slider with ease-out animation.

### Save / Update

- Full-width orange pill: `💾 SAVE RESULT`
- On save: sheet slides down, match card scale-pulses to confirm
- Edit mode: slider starts at saved position, button reads `✏️ UPDATE RESULT`
- Mexicano warning if editing affects later rounds: `⚠️ Updating will recalculate later rounds` in amber

---

## 6. Standings & Podium View

### Zone 1 — The Podium (top ~45%)

Three elevated pillars:

```
              ┌─────────┐
              │  🥇 #1  │
     ┌────┐  │  ALICE   │  ┌────┐
     │ #2 │  │  48 pts  │  │ #3 │
     │BOB │  │          │  │CAR │
     │42pt│  │          │  │38pt│
     └────┘  └──────────┘  └────┘
```

- **#1:** tall center pillar, gold gradient background, ✨ shimmer animation, 🥇 crown, name + points + W-L
- **#2 / #3:** shorter pillars, `surface-2`, silver/bronze accent lines
- Subtle 3D perspective tilt via `transform: perspective(800px) rotateX(2deg)`
- Points differential badge: `+12` in teal or `-3` in rally red

### Zone 2 — Ranked List (#4 onward, scrollable)

- Each row: rank number (condensed, muted) | player name (bold) | stats pills (`W:3 L:1`, `PTS: 34`, `DIFF: +6`)
- Alternating `surface-1` / `surface-0` backgrounds
- Movement arrows: ▲ teal (up), ▼ muted red (down)
- Bye indicator: `😴` emoji next to stats

### Animations

- First visit: podium pillars grow upward from zero (staggered, ~800ms total)
- Rank arrows slide in from the side
- Subsequent visits: instant

### Tournament Complete

- #1 pillar gets pulsing gold border
- `🏆 CHAMPION` appears above name in condensed gold text

---

## 7. Create Tournament Flow

Multi-step wizard — each step is a full-screen focused moment.

### Step 1 — Mode Selection

Two massive side-by-side tappable cards:

```
┌──────────────────┐  ┌──────────────────┐
│    🔄 AMERICANO  │  │    🌮 MEXICANO   │
│                  │  │                  │
│  "Fixed partner  │  │  "Teams remix    │
│   rotation"      │  │   from standings"│
│                  │  │                  │
│   [ SELECT ]     │  │   [ SELECT ]     │
└──────────────────┘  └──────────────────┘
```

- Selected: orange border glow + checkmark badge
- Unselected: dims to `surface-0`

### Step 2 — Tournament Name

- Single centered large text input, orange bottom-border (no box), `2rem` text
- Placeholder: `"Sunday Smash 🏆"`
- Label: `NAME YOUR TOURNAMENT` condensed muted caps

### Step 3 — Courts

- Horizontal row of tappable square tiles: `1`, `2`, `3`, `4`
- Selected count: orange fill
- Dynamic helper: `"2 courts → 8-12 players ideal"`

### Step 4 — Players

- Large text area, one player per line, generous line-height
- Live counter pill: `👥 8 PLAYERS`
- Validation: ✅ `"Perfect for 2 courts"` (teal) or ⚠️ `"Need at least 4 players"` (amber)

### Wizard Navigation

- Progress dots (4) at bottom
- `NEXT →` orange pill on right
- Final step: `🎾 START TOURNAMENT` with full-screen orange flash transition

---

## 8. Animations, Micro-Interactions & Polish

### Page Transitions

| Interaction      | Animation                                                     |
|------------------|---------------------------------------------------------------|
| Tab switch       | Fade + lift (150ms ease-out, 8px translateY)                  |
| Round swipe      | Parallax horizontal (outgoing 1x, incoming 0.85x)            |
| Bottom sheet     | Spring slide-up with overshoot, backdrop dims to 50% black    |

### Score Slider Feedback

- Thumb scales 1.0 → 1.2 on grab
- Score numbers: rolling odometer animation
- On release: snap to nearest integer with bounce
- Tug-of-war gradient blur at color meeting point

### Match Card Interactions

- Unsaved: breathing orange border pulse (2s loop)
- On score save: scale pulse (1.0 → 1.02 → 1.0, 200ms)
- First-time score display: count-up from 0

### Standings Animations

- Podium pillars grow from bottom (staggered, #1 → #2 → #3)
- Rank arrows slide in from side
- Champion shimmer: CSS `linear-gradient` sweep — no JS

### Haptic-Style Visual Feedback

All tappable elements: `active:scale-[0.97]` with 100ms transition. Every tap feels physical.

### Performance Rule

All animations use exclusively `transform` and `opacity` (GPU-composited). Swipe physics via CSS `scroll-snap`, not JS animation libraries. `will-change: transform` where needed. Target: 60fps on all iPads.
