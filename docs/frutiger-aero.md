# Frutiger Aero kit

The live skin is `frontend/src/styles/aero.css`. This sheet is the full inventory: principles, tokens, controls, surfaces, scene, marks, and the motion rules. The web guide it follows is the design-it Frutiger Aero skill (glossy plastic, clear water, blue skies, eco-friendly technology). Mobile and native samples from that guide are not part of this app.

## Principles

- Wet-plastic gloss. Buttons are convex gel, with a hard color break at 50% and a white specular cap.
- Nature plus glass. Sky, grass, water, and leaves sit behind frosted panels.
- Saturated frost. Panels are brighter and more reflective than flat modern glass.
- No dark theme. The page stays sky, glass, and grass.
- No flat surfaces. Every control has a highlight and a shadow.

## Color

Tokens in `:root`:

| Token | Hex | Use |
| --- | --- | --- |
| `--sky-top` | `#87ceeb` | Top of the page gradient |
| `--sky-mid` | `#e0f6ff` | Middle of the page gradient, 60% down |
| `--grass` | `#98fb98` | Bottom of the page gradient and the footer hill |
| `--ink` | `#0b2e4f` | Body text on glass. About 7.9:1 on sky-top and 12.4:1 on sky-mid |
| `--ink-muted` | `#3b607f` | Secondary text on glass. About 5.9:1 on sky-mid |
| `--link` | `#0054e3` | PDF links. About 5.6:1 on sky-mid |
| `--focus` | `#ffb000` | Focus ring and the Draft badge |

Gel buttons and window bars use the skill gel, with white labels and an etched shadow:

`#73c8f8` 0%, `#1583d7` 50%, `#0361a3` 50%, `#299eef` 100%. Border `#024b7f`.

Light gel chips keep dark ink:

`#e9f8ff` 0%, `#bfe6f7` 50%, `#9bd9fb` 50%, `#73c8f8` 100%. Border `#3b8fc0`.

## Type

Trebuchet MS, the Windows XP humanist face, then Tahoma, then Verdana. Labels on gel buttons are weight 800, with an etched shadow `0 -1px 1px rgba(0, 0, 0, 0.5)`. Body copy sits on a glass panel. It never sits directly on the wallpaper.

## Controls

- Gel button (`.gel-btn`): skill gel stops, white label inside `.gel-label`, 25px radius, a 1.5px white top stroke, a `::after` gloss cap above the fill, and a deep drop shadow.
- Light gel chip (`.gel-btn-light`, `.topic-chip`): same shine, dark ink, `aria-pressed` when selected. A selected chip adds a 3px amber ring.
- Etched label: the negative text-shadow on the skill gel.
- Focus ring: `outline: 3px solid var(--focus)` with a 2px offset on `:focus-visible`. Every control is a real `button` or `a`.

## Surfaces

- Glass panel (`.glass-panel`): `rgba(255, 255, 255, 0.55)`, 12px backdrop blur, 16px radius, and a white top edge.
- Window bar (`.window-bar`): the same gel stops as the buttons, used on the header, answer, sources, and feed.
- Glass input (`.ask-input`): a glossy pill with an inset white sheen and ink text.
- Source card: glass panel with body, date, page, optional Draft badge, and a link.
- Draft badge (`.draft-badge`): amber `#ffb000` pill, ink text.

## Scene

Painted behind `.screen`. All of it is `aria-hidden` and `pointer-events: none`.

- Sky: `#7ec8ea` into `#e7f6ff`, with a soft white horizon haze. The body gradient is not a photo.
- Rolling hills (`.hill-back`, `.hill-mid`) sit behind the footer hill and stay on small screens.
- Desktop wallpaper: KnightAnNi bubbles blue, 1920×1080, CC0, at `frontend/public/aero/wallpaper.jpg`. The generated sky, hills, and grass stay in the stylesheet as a fallback behind that image.
- Desktop icons and the taskbar use AeroMedia art by On N Off, CC BY 4.0, unmodified. Credit sits in the taskbar and in `frontend/public/aero/CREDITS.txt`. The start control is a Carolina blue orb with the interlocking NC mark.
- The home screen is one Aero window on that wallpaper, with minimize, maximize, and close, plus a glass taskbar and clock.
- Clouds drift on a 40 to 60 second loop. The sun glow breathes. Bubbles rise. Droplets keep a short drift.
- Rising bubbles (`.bubble`): white radial spheres that travel from the bottom over 14 seconds.
- Water droplets (`.droplet`): smaller than the bubbles, slower drift.
- Soft clouds (`.cloud`): puff shapes, an ellipse plus two round lobes.
- Bokeh orbs (`.bokeh`): two or three large, low-opacity discs.
- Aurora wash (`.aurora`): a faint green and blue radial wash at the top of the sky.
- Sun (`.sun`) and two lens-flare ellipses (`.flare`) in the upper right.
- Dew: each droplet has a hard white specular dot.

## Marks

- Leaf mark inside a glossy orb (`.logo-orb`) in the window title. The taskbar start control uses the same orb in Carolina blue with the interlocking NC mark.
- Topic chips: leaf for trees, droplet for water, bus for transit, sun for energy.

## Motion and access

- `prefers-reduced-motion: reduce` removes bubbles and the scenery layer (droplets, clouds, bokeh, aurora, sun, and flare), and turns animation off.
- Below 800px, those same layers are hidden. The rolling hills and the grass footer stay. The answer stacks above the sources.
- Body text stays on glass, where the dark ink stays above 7:1 against the panel.
