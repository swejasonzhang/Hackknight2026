# ADR-0009: 3D scenes and a motion layer on top of the neon black identity

- Date: 2026-10-09
- Status: accepted (extends ADR-0008)

## Context

Jason asked for the application to "pop": Motion, component libraries, Tailwind and modern web technology, ideally with 3D animation to show both the graphs and the movement of joints. Arc's data is literally a joint angle over time, so a 3D limb and 3D bars are honest visuals, not decoration. The neon black identity (ADR-0008) stays as it is.

## Decision

- **three.js through React Three Fiber and drei**, code-split with `React.lazy` so the initial bundle is unchanged and the ~245 KB (gzip) three chunk loads only when a scene mounts. Every scene sits behind `SceneBoundary`, which swaps in a fallback (the 2D `LiveArc`, a skeleton) if WebGL fails, and behind `Suspense` with a skeleton while the chunk loads. Nothing 3D is ever rendered in tests (jsdom has no WebGL); the pose maths is a pure module with its own tests.
- **`JointScene`**: three landmark spheres joined by two bones, a gauge ribbon at the moving joint and an amber goal tick, posed by `armPose(exercise, angle)` for the three exercises. Driven by a Motion value for live reps (landing, auth) or a fixed number (dashboard and session detail, posed at the best rep). A slow sway gives depth; users can drag to orbit, never zoom or pan. Reduced motion: a static pose, no sway, demand-rendered frames.
- **`ProgressScene`**: one 3D bar per session in a single blue hue (lighter is higher), a translucent amber goal plane, an animated rise on first paint and a hover tooltip. Labels, the goal badge and the tooltip are plain DOM over the canvas (drei's `Html` portals fought React 19 and were dropped). An `sr-only` list is the text equivalent; the 2D Recharts charts stay below for exact reading, which keeps the dataviz rules (one hue for magnitude, goal as a reference, no dual axis, no legend for one series).
- **Motion layer** (`components/fx`): `SpotlightCard` (pointer-lit cards, CSS only after the pointer position is set), `Magnetic` (CTAs lean toward the pointer on a spring), `ScrollProgress` (a glowing line along the top), `Parallax` (scroll-linked drift). All switch off under `prefers-reduced-motion`.
- **Component libraries**: `Segmented` now wraps Radix Tabs (same props, same roles the tests assert, keyboard navigation for free); `Hint` wraps Radix Tooltip, with one provider at the root.

## Consequences

- Landing: the hero device panel shows the live 3D joint with an exercise switcher and the set counter; the showcase chart is 3D bars; bento cards light up under the pointer; the primary CTA is magnetic; a scroll-progress line runs along the top.
- Signed-in app: the dashboard and the session page each get a "Best rep, in 3D" card, and the dashboard a "Peak per session, in 3D" card, above the existing 2D charts.
- Software WebGL (headless Chromium's SwiftShader) renders the scenes, so Playwright screenshots stay part of the design check.
- Phones at 390px keep every scene inside the viewport; the joint scene's exercise tabs wrap to the panel width.
