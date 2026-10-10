import { LM, type BodyArea, type ExerciseConfig, type ExerciseId, type MuscleId, type Side } from './types.ts'

/** The same landmarks on either side: the whole-body measurements (the pec fly, the shoulder tilt). */
const both = (triple: readonly [number, number, number]): Record<Side, readonly [number, number, number]> => ({ left: triple, right: triple })
const sided = (left: readonly [number, number, number], right: readonly [number, number, number]) => ({ left, right })

const ARM = sided([LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST], [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST])
const SHOULDER = sided([LM.LEFT_HIP, LM.LEFT_SHOULDER, LM.LEFT_ELBOW], [LM.RIGHT_HIP, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW])
const KNEE = sided([LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE], [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE])
const HIP = sided([LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE], [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE])

const inner = (innerDeg: number) => innerDeg
const bend = (innerDeg: number) => 180 - innerDeg

/**
 * Every movement Arc tracks: the camera app's catalog (computer-vision/movements.py; landmarks
 * and thresholds from there, eased a little where the browser's smoothing needs room) and the
 * seated knee extension. Each cue says how to face the camera so the measured joint stays in the
 * picture plane, where a webcam angle is most accurate. The metric always rises into the rep.
 */
export const EXERCISES: Record<ExerciseId, ExerciseConfig> = {
  // ---- upper body ----
  elbow_flexion: {
    id: 'elbow_flexion',
    name: 'Bicep curl',
    short: 'Curl',
    area: 'upper',
    sided: true,
    muscles: { primary: ['biceps'], secondary: ['forearms'] },
    cue: 'Turn so the camera sees your arm from the side. Keep the upper arm still and bend the elbow to bring your hand toward your shoulder, then lower slowly.',
    joints: ARM,
    metricLabel: 'Elbow flexion',
    // Inner angle 180 = straight arm = 0 flexion; 40 inner = 140 flexion.
    metricFromInnerAngle: bend,
    enterDeg: 90,
    exitDeg: 40,
    targetDeg: 140,
    restDeg: 0,
    maxDeg: 180,
    minRepMs: 800,
  },
  tricep_extension: {
    id: 'tricep_extension',
    name: 'Tricep extension',
    short: 'Triceps',
    area: 'upper',
    sided: true,
    muscles: { primary: ['triceps'], secondary: ['forearms'] },
    cue: 'Turn so the camera sees your arm from the side, the upper arm against your side and the elbow bent. Straighten the elbow to push your hand down, then let it bend back up slowly.',
    joints: ARM,
    metricLabel: 'Elbow extension',
    metricFromInnerAngle: inner,
    enterDeg: 140,
    exitDeg: 70,
    targetDeg: 170,
    restDeg: 60,
    maxDeg: 178,
    minRepMs: 800,
  },
  shoulder_press: {
    id: 'shoulder_press',
    name: 'Shoulder press',
    short: 'Press',
    area: 'upper',
    sided: false,
    muscles: { primary: ['front_delts', 'side_delts'], secondary: ['triceps', 'traps'] },
    cue: 'Face the camera with your hands at shoulder height and your elbows out. Press both hands straight up overhead, then lower slowly.',
    joints: SHOULDER,
    metricLabel: 'Arm elevation',
    metricFromInnerAngle: inner,
    enterDeg: 150,
    exitDeg: 95,
    targetDeg: 170,
    restDeg: 85,
    maxDeg: 175,
    minRepMs: 1000,
  },
  shoulder_abduction: {
    id: 'shoulder_abduction',
    name: 'Lateral raise',
    short: 'Lateral',
    area: 'upper',
    sided: true,
    muscles: { primary: ['side_delts'], secondary: ['front_delts', 'traps'] },
    cue: 'Face the camera with your arm straight at your side. Raise it out to the side to shoulder height, then lower slowly.',
    // Hip - shoulder - elbow: the angle between the torso and the upper arm. Using the
    // elbow instead of the wrist keeps the number right even if the elbow bends.
    joints: SHOULDER,
    metricLabel: 'Shoulder abduction',
    metricFromInnerAngle: inner,
    enterDeg: 70,
    exitDeg: 30,
    targetDeg: 90,
    restDeg: 0,
    maxDeg: 180,
    minRepMs: 1000,
  },
  front_raise: {
    id: 'front_raise',
    name: 'Front raise',
    short: 'Front',
    area: 'upper',
    sided: true,
    muscles: { primary: ['front_delts'], secondary: ['side_delts', 'chest'] },
    cue: 'Turn so the camera sees you from the side, your arm straight at your side. Raise it straight in front of you to just above shoulder height, then lower slowly.',
    joints: sided([LM.LEFT_HIP, LM.LEFT_SHOULDER, LM.LEFT_WRIST], [LM.RIGHT_HIP, LM.RIGHT_SHOULDER, LM.RIGHT_WRIST]),
    metricLabel: 'Shoulder flexion',
    metricFromInnerAngle: inner,
    enterDeg: 120,
    exitDeg: 30,
    targetDeg: 135,
    restDeg: 10,
    maxDeg: 170,
    minRepMs: 1000,
  },
  chest_press: {
    id: 'chest_press',
    name: 'Chest press',
    short: 'Chest',
    area: 'upper',
    sided: false,
    muscles: { primary: ['chest'], secondary: ['front_delts', 'triceps'] },
    cue: 'Stand side-on to the camera, hands at your chest and elbows back. Push both hands straight forward until your arms are straight, then bring them back slowly.',
    joints: ARM,
    metricLabel: 'Elbow extension',
    metricFromInnerAngle: inner,
    enterDeg: 150,
    exitDeg: 80,
    targetDeg: 170,
    restDeg: 70,
    maxDeg: 178,
    minRepMs: 900,
  },
  pec_fly: {
    id: 'pec_fly',
    name: 'Pec fly',
    short: 'Fly',
    area: 'upper',
    sided: false,
    muscles: { primary: ['chest'], secondary: ['front_delts'] },
    cue: 'Face the camera with your arms open wide at shoulder height, elbows soft. Sweep your hands together in front of your chest, then open them slowly.',
    // The angle at the left shoulder between the two wrists: wide open is large, hands together is small.
    joints: both([LM.LEFT_WRIST, LM.LEFT_SHOULDER, LM.RIGHT_WRIST]),
    metricLabel: 'Arms closed',
    metricFromInnerAngle: bend,
    enterDeg: 150,
    exitDeg: 105,
    targetDeg: 160,
    restDeg: 40,
    maxDeg: 165,
    minRepMs: 1000,
  },
  // ---- back ----
  lat_pulldown: {
    id: 'lat_pulldown',
    name: 'Lat pulldown',
    short: 'Pulldown',
    area: 'back',
    sided: false,
    muscles: { primary: ['lats'], secondary: ['upper_back', 'biceps', 'rear_delts'] },
    cue: 'Face the camera with your arms reaching overhead. Pull your elbows down to your sides until your hands reach shoulder height, then let your arms rise slowly.',
    joints: SHOULDER,
    metricLabel: 'Shoulder adduction',
    metricFromInnerAngle: bend,
    enterDeg: 105,
    exitDeg: 35,
    targetDeg: 120,
    restDeg: 20,
    maxDeg: 130,
    minRepMs: 1000,
  },
  bent_over_row: {
    id: 'bent_over_row',
    name: 'Bent-over row',
    short: 'Row',
    area: 'back',
    sided: true,
    muscles: { primary: ['lats', 'upper_back'], secondary: ['rear_delts', 'biceps', 'lower_back'] },
    cue: 'Stand side-on to the camera and hinge forward at the hips, your arm hanging straight. Pull your elbow up and back past your side, then lower slowly.',
    joints: ARM,
    metricLabel: 'Elbow flexion',
    metricFromInnerAngle: bend,
    enterDeg: 105,
    exitDeg: 35,
    targetDeg: 115,
    restDeg: 10,
    maxDeg: 130,
    minRepMs: 1000,
  },
  deadlift: {
    id: 'deadlift',
    name: 'Deadlift',
    short: 'Deadlift',
    area: 'back',
    sided: false,
    muscles: { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['quads', 'traps', 'forearms'] },
    cue: 'Stand side-on to the camera. Hinge at the hips with a flat back until your hands reach your knees, then drive your hips forward to stand tall, and lower with control.',
    joints: HIP,
    metricLabel: 'Hip extension',
    metricFromInnerAngle: inner,
    enterDeg: 160,
    exitDeg: 130,
    targetDeg: 175,
    restDeg: 100,
    maxDeg: 180,
    minRepMs: 1200,
  },
  // ---- legs ----
  squat: {
    id: 'squat',
    name: 'Squat',
    short: 'Squat',
    area: 'legs',
    sided: false,
    muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'calves'] },
    cue: 'Stand side-on to the camera, feet hip-width apart. Sit your hips back and down until your thighs are level, then stand back up.',
    joints: KNEE,
    metricLabel: 'Knee flexion',
    metricFromInnerAngle: bend,
    enterDeg: 90,
    exitDeg: 20,
    targetDeg: 100,
    restDeg: 5,
    maxDeg: 120,
    minRepMs: 1200,
  },
  lunge: {
    id: 'lunge',
    name: 'Lunge',
    short: 'Lunge',
    area: 'legs',
    sided: true,
    muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'] },
    cue: 'Stand side-on to the camera with your front foot a stride ahead; the front leg is the side you picked. Lower until both knees bend to about 90 degrees, then push back up.',
    joints: KNEE,
    metricLabel: 'Knee flexion',
    metricFromInnerAngle: bend,
    // A split stance never stands fully straight: the front knee starts about 20 degrees bent.
    enterDeg: 80,
    exitDeg: 30,
    targetDeg: 90,
    restDeg: 20,
    maxDeg: 95,
    minRepMs: 1200,
  },
  seated_knee_extension: {
    id: 'seated_knee_extension',
    name: 'Seated knee extension',
    short: 'Knee',
    area: 'legs',
    sided: true,
    muscles: { primary: ['quads'], secondary: [] },
    cue: 'Sit side-on to the camera so your hip, knee and ankle are all in frame. Straighten the knee, hold for a moment, then lower slowly.',
    joints: KNEE,
    metricLabel: 'Knee angle',
    // Seated start is ~90 (bent); fully straight is 180.
    metricFromInnerAngle: inner,
    enterDeg: 150,
    exitDeg: 110,
    targetDeg: 175,
    restDeg: 90,
    maxDeg: 180,
    minRepMs: 1000,
  },
  // ---- core ----
  crunch: {
    id: 'crunch',
    name: 'Crunch',
    short: 'Crunch',
    area: 'core',
    sided: false,
    muscles: { primary: ['abs'], secondary: ['obliques'] },
    cue: 'Lie on your back side-on to the camera, legs out with the knees soft. Curl your shoulders up off the floor, then lower slowly.',
    joints: HIP,
    metricLabel: 'Trunk curl',
    metricFromInnerAngle: bend,
    enterDeg: 45,
    exitDeg: 22,
    targetDeg: 55,
    restDeg: 15,
    maxDeg: 65,
    minRepMs: 1000,
  },
  ab_twist: {
    id: 'ab_twist',
    name: 'Ab twist',
    short: 'Twist',
    area: 'core',
    sided: false,
    muscles: { primary: ['obliques'], secondary: ['abs', 'lower_back'] },
    cue: 'Face the camera with your hands together in front of your chest. Twist and lean your shoulders to one side, come back through the middle, then go to the other side.',
    measure: 'tilt',
    joints: both([LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.RIGHT_SHOULDER]),
    metricLabel: 'Shoulder tilt',
    metricFromInnerAngle: inner,
    enterDeg: 22,
    exitDeg: 8,
    targetDeg: 30,
    restDeg: 0,
    maxDeg: 40,
    minRepMs: 800,
  },
}

export const EXERCISE_LIST: ExerciseConfig[] = Object.values(EXERCISES)

/** The dashboard's four tabs, each with its movements in catalog order. */
export const BODY_AREAS: { id: BodyArea; name: string }[] = [
  { id: 'upper', name: 'Upper body' },
  { id: 'back', name: 'Back' },
  { id: 'legs', name: 'Legs' },
  { id: 'core', name: 'Core' },
]

export function exercisesIn(area: BodyArea): ExerciseConfig[] {
  return EXERCISE_LIST.filter((e) => e.area === area)
}

export interface CatalogGroup {
  area: string
  exercises: { id: ExerciseId; name: string }[]
}

/** Every movement, grouped by body area: what Arc offers when it asks where to start. */
export function catalogByArea(): CatalogGroup[] {
  return BODY_AREAS.map((a) => ({ area: a.name, exercises: exercisesIn(a.id).map((e) => ({ id: e.id, name: e.name })) }))
}

/** Each muscle group's name, and the part of the body it belongs to, in the order the plan lists them. */
export const MUSCLES: Record<MuscleId, { name: string; region: string }> = {
  chest: { name: 'Chest', region: 'Chest' },
  front_delts: { name: 'Front shoulders', region: 'Shoulders' },
  side_delts: { name: 'Side shoulders', region: 'Shoulders' },
  rear_delts: { name: 'Rear shoulders', region: 'Shoulders' },
  biceps: { name: 'Biceps', region: 'Arms' },
  triceps: { name: 'Triceps', region: 'Arms' },
  forearms: { name: 'Forearms', region: 'Arms' },
  traps: { name: 'Traps', region: 'Back' },
  upper_back: { name: 'Upper back', region: 'Back' },
  lats: { name: 'Lats', region: 'Back' },
  lower_back: { name: 'Lower back', region: 'Back' },
  abs: { name: 'Abs', region: 'Core' },
  obliques: { name: 'Obliques', region: 'Core' },
  glutes: { name: 'Glutes', region: 'Legs' },
  quads: { name: 'Quads', region: 'Legs' },
  hamstrings: { name: 'Hamstrings', region: 'Legs' },
  calves: { name: 'Calves', region: 'Legs' },
}

/**
 * The movements that work a muscle: those that target it, the most focused first (the muscle
 * named first, then the fewest other targets), then those it helps in, in catalog order.
 */
export function exercisesFor(muscle: MuscleId): { primary: ExerciseConfig[]; secondary: ExerciseConfig[] } {
  const focus = (e: ExerciseConfig) => e.muscles.primary.indexOf(muscle) * 10 + e.muscles.primary.length
  return {
    primary: EXERCISE_LIST.filter((e) => e.muscles.primary.includes(muscle)).sort((a, b) => focus(a) - focus(b)),
    secondary: EXERCISE_LIST.filter((e) => e.muscles.secondary.includes(muscle)),
  }
}

/** The side as a member reads it: "right" or "left" for a one-sided movement, else "both sides". */
export function sideLabel(exercise: ExerciseId, side: Side): string {
  return EXERCISES[exercise].sided ? side : 'both sides'
}
