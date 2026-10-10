# ADR-0025: An anatomical body, painted with the muscles each exercise works

- Date: 2026-10-10
- Status: accepted; amends ADR-0014 and ADR-0021

## Context

Jason: "The human model doesn't look accurate to a human model at all." He also asked for three more things:
- The exercises should highlight the muscles they target: "red for intense target and yellow for still being affected".
- The record page should show the right way to do the exercise beside the camera.
- In the plan, the back should not be "a left or right side but maybe a lower back or upper back".

The figure was a mannequin. It was built from round lathes, an egg-shaped head, a box pelvis and grey ball joints. The catalog knew which landmarks each exercise measures but not which muscles it works. And every exercise asked for a side, even a deadlift or a crunch.

## Decision

- **Muscles in the catalog.** Every exercise names:
  - its target muscles and the ones that help, from seventeen groups (`MUSCLES`). The back is three groups: upper back, lats and lower back;
  - whether one arm or leg does the work (`sided`).

  The numbers stay in the shared package, so the server, the plan and the figure agree.
- **An anatomical surface.** Each body part is swept along its bone from cross-sections of a 170 cm adult (`anatomy.ts`). Each section has separate front, back, outer and inner extents, so:
  - a calf bulges behind and a deltoid caps the shoulder;
  - the chest is wider than deep and the waist narrower than both;
  - the head has a jaw in front of the neck.

  Each part has a full frame: along the bone, plus a front carried from the trunk. A biceps stays in front and a calf behind through every pose. The ball joints are gone.
- **Muscles painted on the surface.** Each muscle is a soft-edged area of a part, located by how far along the bone and which way round it sits. The figure colours its vertices: red for the targets, yellow for the helpers.
  - A one-sided exercise lights only the working limb and that half of the trunk, apart from the abs and the lower back.
  - An exercise whose targets are mostly behind turns its back toward the camera.
- **The form guide.** Beside the camera on `/record`, the figure loops full reps from rest to the goal. It is drawn as the mirrored camera shows the member, with the muscle key and the cue below. The dashboard and the session report name the muscles under their figure too.
- **Sides only where they mean something.** The plan picks a target muscle, then a movement that works it, the most focused first. It asks for left or right only for one-sided movements; for a deadlift it shows "Both sides". The recorder reads a movement with no side on whichever side the camera sees better. Labels everywhere say "both sides" for these movements.

## Consequences

- The figure is still built in code, with no model file to license or download. The surfaces are shared; each canvas only adds its own colours.
- Where the muscles lie is tested without WebGL. So are the meshes' closure and normals and the adult proportions.
- Plans and sessions still store a `side` for every movement. For a movement with no side it is only the side preferred when both are in view.
