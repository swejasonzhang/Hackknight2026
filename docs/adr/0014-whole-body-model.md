# ADR-0014: A whole human body at adult proportions, and no nested scrolling

- Date: 2026-10-10
- Status: accepted (supersedes the body parts of ADR-0013)

## Context

ADR-0013 drew only the parts each movement uses. Elbow flexion got an arm and a trunk, shoulder abduction a torso, head and one arm, and knee extension a leg on a stool. Their sizes followed the joint maths, not a person, so a torso was shorter than an arm. Jason asked for body models for every body part, at a realistic human size. He also asked that nothing scroll inside the page unless it has to, and that every page work on a phone.

## Decision

- **One whole body, used everywhere.** `skeleton.ts` places 20 joints for a 170 cm adult, in units of 27 cm. Joint heights and limb lengths follow standard anthropometric ratios: shoulder at 0.82 of height, hip joint at 0.52, knee at 0.28, upper arm 0.19, forearm 0.15, hand 0.11, thigh and shin 0.245, foot 0.15. Every exercise draws the whole body:
  - head, neck, torso and pelvis
  - both upper arms, forearms and hands
  - both thighs, shins and feet
  - ball joints at the shoulders, elbows, wrists, knees and ankles

  The head is 22 cm tall with a nose that shows which way the body faces. The chest is 32 cm across and 23 cm deep. Elbow flexion is seen standing side on, shoulder abduction standing face on, and knee extension seated side on with the hands resting on the thighs. Only the exercising limb moves.
- **The camera app's landmarks are joints of that body.** The overlay's shoulder, elbow, wrist, hip, knee and ankle are taken from the skeleton. The goniometer's fixed arm for shoulder abduction runs down the trunk line to hip level. Tests check that the angle at the tracked joint equals the reading, that no limb changes length, that nothing but the exercising limb moves, that the feet meet the floor, and that every pose stays in frame. Each exercise's framing is computed from those poses.
- **The landing uses the same body.** The arm-only `ArmScene`, `armPose` and the partial `bodyPose` are removed.
- **No element scrolls on its own unless it must.** The dashboard panel lost its inner scroll, and the landing's chart tabs lost their sideways scroller. Sticky columns (the dashboard panel, the plan form, the session stage) use `useStickyTop`: they pin while they fit the window, and a taller one scrolls with the page until its bottom is in view. The only scroller left is the dropdown list, and only when it has more options than fit.
- **Phones down to 320 px.** An audit script loads every route at 320, 360, 390, 430, 768, 1024, 1280 and 1440 px. It reports any sideways page scroll, nested scroller, or element past the screen edge. It now reports nothing. On phones the landing's live readout sits under the stage, so it no longer covers the figure's feet.

## Consequences

- Shoulder abduction frames a taller pose (an arm raised overhead), so that body is drawn smaller than the other two.
