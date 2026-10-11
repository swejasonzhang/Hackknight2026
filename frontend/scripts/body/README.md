# The 3D body

Arc's figure is a real human mesh: the young adult of [MakeHuman](http://www.makehumancommunity.org), whose base mesh, targets and rig were released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) in 2020 (see MakeHuman's `LICENSE.md`). Nothing from MakeHuman's code is used; only those assets, at a pinned commit.

```bash
cd frontend
node scripts/body/bake.mjs      # downloads the assets once into scripts/body/.cache, then bakes
```

The bake writes two files the app reads:

| File | What it holds |
| --- | --- |
| `src/components/three/body/body.bin` (about 690 KB) | 13,524 vertices (the body and the eyes), 27,036 triangles; per sex, the skinny untrained positions and the offset to the most built; four skin weights per vertex onto Arc's bones; up to three muscle groups per vertex; the shorts and the sports top |
| `src/components/three/body/bodyMeta.ts` | the layout of `body.bin` and each figure's joints in its bind pose, in Arc's units (27 cm) |

## How it is made

1. **Each sex**, from the base mesh plus MakeHuman's own macro targets: young, an even mix of the three ethnic targets, in two states. **Skinny**: muscle 0.25 and weight 0.15 on MakeHuman's macros, the regional muscle targets turned down. **Built**: the most muscle at a lean weight, plus the regional targets turned up: upper arm, deltoid, forearm, thigh, calf, chest, lats, the V-taper and the glutes.
2. **The skin.** MakeHuman's default rig weights are folded onto Arc's 16 bones, plus three helpers per side: the collarbone, the deltoid (turning half way between the trunk and the upper arm) and the glute (a third of the way between the pelvis and the thigh). The helpers keep a shoulder press and a deep squat from collapsing at the joint.
3. **Where each muscle lies.** The 17 muscle groups Arc names are soft areas on each part, measured along its bone and round it, smoothed over the surface and sharpened so a group's middle is all that group. The app uses them twice: it paints the muscles an exercise works, and it grows each group by its own training.
4. **The joints.** These are the centres of MakeHuman's joint markers. `skeleton.ts` reads its proportions from them, so the figure bends exactly where the mesh does, for each sex.

Edit `bake.mjs`, run it, and commit both outputs. `figure.test.ts` checks the asset: every triangle on a real vertex, the weights adding to one, the proportions, the skin carrying each joint to where the pose puts it, and the growth thickening only the trained groups.
