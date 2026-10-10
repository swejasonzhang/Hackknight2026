import { LM, type ExerciseConfig, type ExerciseId } from './types.ts'

/**
 * The three starting exercises. All work seated at a desk in front of a laptop camera.
 * The cue tells the user how to face the camera so the moving joint stays in the
 * camera plane, which is where a webcam angle is most accurate.
 */
export const EXERCISES: Record<ExerciseId, ExerciseConfig> = {
  elbow_flexion: {
    id: 'elbow_flexion',
    name: 'Elbow flexion',
    short: 'Elbow',
    cue: 'Turn so the camera sees your arm from the side. Keep the upper arm still and bend the elbow to bring your hand toward your shoulder, then lower slowly.',
    joints: {
      left: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST],
      right: [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
    },
    metricLabel: 'Elbow flexion',
    // Inner angle 180 = straight arm = 0 flexion; 40 inner = 140 flexion.
    metricFromInnerAngle: (innerDeg) => 180 - innerDeg,
    enterDeg: 90,
    exitDeg: 40,
    targetDeg: 140,
    minRepMs: 800,
  },
  shoulder_abduction: {
    id: 'shoulder_abduction',
    name: 'Shoulder abduction',
    short: 'Shoulder',
    cue: 'Face the camera with your arm straight at your side. Raise the arm out to the side as high as is comfortable, then lower slowly.',
    // Hip - shoulder - elbow: the angle between the torso and the upper arm. Using the
    // elbow instead of the wrist keeps the number right even if the elbow bends.
    joints: {
      left: [LM.LEFT_HIP, LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
      right: [LM.RIGHT_HIP, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
    },
    metricLabel: 'Shoulder abduction',
    metricFromInnerAngle: (innerDeg) => innerDeg,
    enterDeg: 70,
    exitDeg: 30,
    targetDeg: 160,
    minRepMs: 1000,
  },
  seated_knee_extension: {
    id: 'seated_knee_extension',
    name: 'Seated knee extension',
    short: 'Knee',
    cue: 'Sit side-on to the camera so your hip, knee and ankle are all in frame. Straighten the knee, hold for a moment, then lower slowly.',
    joints: {
      left: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
      right: [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
    },
    metricLabel: 'Knee angle',
    // Seated start is ~90 (bent); fully straight is 180.
    metricFromInnerAngle: (innerDeg) => innerDeg,
    enterDeg: 150,
    exitDeg: 110,
    targetDeg: 175,
    minRepMs: 1000,
  },
}

export const EXERCISE_LIST: ExerciseConfig[] = Object.values(EXERCISES)
