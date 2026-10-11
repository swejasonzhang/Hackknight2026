# ADR-0030: A real human body, built by the member's own training

- Date: 2026-10-11
- Status: accepted; supersedes the figure's geometry in ADR-0025 (its muscle catalog and colours stay)

## Context

Jason asked for the model to look as human as possible. He also asked for the body to start skinny and grow, part by part, with the workouts that train each part.

ADR-0025's figure was swept in code from cross-sections, one tube per bone, with spheres filling the joints. It read as a mannequin, and nothing in it could grow.

## Decision

- **A real mesh.** The figure is MakeHuman's young adult: its base mesh, targets and rig were released as CC0 1.0. `frontend/scripts/body/bake.mjs` turns those assets, at a pinned commit, into `body.bin` (about 690 KB, loaded with the 3D code).
- **Female, male or between.** A profile picks its `figure` (`PATCH /api/profiles/:id`). A profile that has not picked one gets the figure between the two.
  - Each figure has its own proportions: `skeleton.ts` reads them off the mesh's joints, so every pose bends exactly where that mesh bends.
  - Every pose still puts the tracked joint at exactly the reading.
- **Skinned to Arc's skeleton.** The rig's weights are folded onto Arc's 16 bones on the GPU.
  - Three helpers per side ease the big joints: the collarbone, the deltoid, and the glute.
  - The pelvis can stay put while the trunk moves, so a crunch curls up off the floor.
  - Framing follows the canvas's shape, so a narrow phone stage shrinks the figure rather than cutting it off.
- **Skinny to built.** Each sex is baked in two states:
  - skinny and untrained;
  - built: MakeHuman's most muscle plus its regional muscle targets.

  Each vertex moves between the two by the training level of the muscle group under it. Where no group lies, it moves by the whole body's level.
- **Growth from the sets.** `dependencies/src/growth.ts` turns a profile's sessions into a level from 0 to 1 for each of the 17 groups, week by week:
  - A set counts fully for a muscle the exercise targets and half for one that helps; a short set counts pro rata; a weight held adds up to half again.
  - Each week adds a share of what is left to gain, so returns diminish.
  - A group left more than two weeks gives a little back.

  `GET /api/profiles/:id/body` serves the levels, the sets behind them, and the levels week by week.
- **Shown where the figure is.**
  - **Dashboard:** the panel's figure is the member's own body. A new section, "Your body, as trained", shows the whole figure turning, a slider and a play button to watch it grow week by week, the groups from most to least built, and the groups not worked yet with a movement for each.
  - **Record page and session report:** the form guide and the report's figure use the member's body too.
  - **Landing page:** a Growth view shows a demo household growing differently with their training.
- **Dressed.** Everyone wears shorts, and the female and between figures a sports top, painted on the mesh. The muscle colours paint over the clothes.

## Consequences

- The body is a 690 KB download on pages with a 3D figure, cached by the browser. A failed download leaves the scene on its fallback.
- Linear blend skinning still thins a joint at its extremes (an elbow at full curl), but the helpers keep the shoulders and hips believable through every movement here.
- The growth model is for drawing the figure, not a measurement of the member's body; the page says so.
- To change the body, edit `bake.mjs`, run it and commit both outputs. `figure.test.ts` checks the asset, the skinning and the growth.
