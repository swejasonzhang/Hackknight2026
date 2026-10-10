# ADR-0013: A body model that moves with the joints, and dropdowns from Radix

- Date: 2026-10-10
- Status: partly superseded by ADR-0014 (the body parts); the themed dropdowns stand

## Context

The dashboard and the session page posed a stick figure: navy rods between blue spheres. The joint angle changed, but no body moved with it. Only the landing page had a modelled arm, and only for elbow flexion. Jason asked for the body model to move with the joints. He also asked that every dropdown come from a component library that matches the theme. The app used native `<select>` elements, which each browser draws its own way.

## Decision

- **One body model per movement, anchored on the tracked landmarks.** `bodyPose.ts` turns a pose into body parts, each a segment in the same plane as the joint maths:
  - Elbow flexion: a trunk seen side on, the upper arm from shoulder to elbow, the forearm and fist from elbow to wrist.
  - Shoulder abduction: a torso and head facing the camera, and the straight arm rising from the shoulder at the chest's edge.
  - Seated knee extension: a stool, a trunk, the thigh from hip to knee, the shin from knee to ankle, and a foot square to the shin.
- **Same look as the landing arm.** The scene draws each part as a sculpted lathe mesh. The camera app's tracking rings and segments sit on top, with the goniometer arc. A new reading sweeps the body to its angle. Under reduced motion it is drawn in place.
- **Tests without WebGL.** The placement is pure. Tests check that each part starts and ends on its joints at every angle, that the fixed part stays put, and that every pose stays in frame.
- **Dropdowns are Radix Select.** The `Select` component has two triggers: a square datasheet input, and the underlined mono readout used for the profile switcher. Both open a paper list on a navy hairline, with a cobalt edge on the highlighted option and a cobalt square on the chosen one. Keyboard use, typeahead and screen-reader behaviour come from Radix. Pinned to 2.3.7, the release from July 2026.

## Consequences

- No native `<select>` remains, and the native-select CSS is gone.
- The joint scene loses its unused dark palette and `theme` prop.
- The test setup stubs pointer capture and `scrollIntoView`, which jsdom lacks and Radix Select calls.
