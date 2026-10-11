// Written by scripts/body/bake.mjs from MakeHuman's CC0 assets; do not edit by hand.
// The layout of body.bin and each figure's joints in its bind pose, in body units of 27 cm.
export const BODY_META = {
  "source": {
    "project": "MakeHuman",
    "license": "CC0 1.0",
    "commit": "a8bc2d54ff0ac92e78ff71431b1023eda42bf482"
  },
  "unitCm": 27,
  "states": {
    "skinny": {
      "muscle": 0.25,
      "weight": 0.15,
      "regional": -1
    },
    "built": {
      "muscle": 1,
      "weight": 0.3,
      "regional": 1
    }
  },
  "vertices": 13524,
  "bodyVertices": 13380,
  "bodyTriangles": 26756,
  "eyeTriangles": 280,
  "bones": [
    "pelvis",
    "torso",
    "neck",
    "head",
    "rUpperArm",
    "lUpperArm",
    "rForearm",
    "lForearm",
    "rHand",
    "lHand",
    "rThigh",
    "lThigh",
    "rShin",
    "lShin",
    "rFoot",
    "lFoot",
    "rClavicle",
    "lClavicle",
    "rDeltoid",
    "lDeltoid",
    "rGlute",
    "lGlute"
  ],
  "muscles": [
    "chest",
    "front_delts",
    "side_delts",
    "rear_delts",
    "biceps",
    "triceps",
    "forearms",
    "traps",
    "upper_back",
    "lats",
    "lower_back",
    "abs",
    "obliques",
    "glutes",
    "quads",
    "hamstrings",
    "calves"
  ],
  "maskSlots": 3,
  "sha256": "a0270932fa1e17f8a4c8d724a0ae46b45bd78a39f9979d095fbe24ea8ffddb05",
  "sections": [
    {
      "name": "female.skinny",
      "type": "Int16",
      "offset": 0,
      "length": 40572,
      "min": [
        -1.768519,
        0.000778,
        -0.31092
      ],
      "max": [
        1.768519,
        5.893154,
        1.01821
      ]
    },
    {
      "name": "female.growth",
      "type": "Int16",
      "offset": 81144,
      "length": 40572,
      "step": 0.0000081145326
    },
    {
      "name": "male.skinny",
      "type": "Int16",
      "offset": 162288,
      "length": 40572,
      "min": [
        -2.06763,
        0,
        -0.278988
      ],
      "max": [
        2.06763,
        6.408889,
        1.422469
      ]
    },
    {
      "name": "male.growth",
      "type": "Int16",
      "offset": 243432,
      "length": 40572,
      "step": 0.0000068943574
    },
    {
      "name": "index",
      "type": "Uint16",
      "offset": 324576,
      "length": 81108
    },
    {
      "name": "skinIndex",
      "type": "Uint8",
      "offset": 486792,
      "length": 54096
    },
    {
      "name": "skinWeight",
      "type": "Uint8",
      "offset": 540888,
      "length": 54096
    },
    {
      "name": "maskIndex",
      "type": "Uint8",
      "offset": 594984,
      "length": 40572
    },
    {
      "name": "maskWeight",
      "type": "Uint8",
      "offset": 635556,
      "length": 40572
    },
    {
      "name": "shorts",
      "type": "Uint8",
      "offset": 676128,
      "length": 13524
    },
    {
      "name": "top",
      "type": "Uint8",
      "offset": 689652,
      "length": 13524
    }
  ],
  "joints": {
    "female": {
      "pelvis": [
        0,
        3.05412,
        0.02258
      ],
      "neck": [
        0,
        4.98261,
        -0.06742
      ],
      "headBase": [
        0,
        5.37146,
        0.0885
      ],
      "headTop": [
        0,
        5.89165,
        0.06175
      ],
      "rShoulder": [
        -0.58895,
        4.67582,
        0.01328
      ],
      "lShoulder": [
        0.58895,
        4.67582,
        0.01328
      ],
      "rClavicle": [
        -0.08376,
        4.73114,
        0.01367
      ],
      "lClavicle": [
        0.08376,
        4.73114,
        0.01367
      ],
      "rElbow": [
        -1.16963,
        4.041,
        0.02734
      ],
      "lElbow": [
        1.16963,
        4.041,
        0.02734
      ],
      "rWrist": [
        -1.57467,
        3.59744,
        0.5253
      ],
      "lWrist": [
        1.57467,
        3.59744,
        0.5253
      ],
      "rFingertip": [
        -1.72258,
        3.41408,
        0.77183
      ],
      "lFingertip": [
        1.72258,
        3.41408,
        0.77183
      ],
      "rHip": [
        -0.35474,
        3.01322,
        0
      ],
      "lHip": [
        0.35474,
        3.01322,
        0
      ],
      "rKnee": [
        -0.49606,
        1.65013,
        0.11252
      ],
      "lKnee": [
        0.49606,
        1.65013,
        0.11252
      ],
      "rAnkle": [
        -0.60763,
        0.25256,
        0.04668
      ],
      "lAnkle": [
        0.60763,
        0.25256,
        0.04668
      ],
      "rToe": [
        -0.61571,
        0.04354,
        0.67397
      ],
      "lToe": [
        0.61571,
        0.04354,
        0.67397
      ]
    },
    "male": {
      "pelvis": [
        0,
        3.42807,
        0.03963
      ],
      "neck": [
        0,
        5.49646,
        0.06806
      ],
      "headBase": [
        0,
        5.85438,
        0.20165
      ],
      "headTop": [
        0,
        6.43135,
        0.1775
      ],
      "rShoulder": [
        -0.71028,
        5.10844,
        0.09154
      ],
      "lShoulder": [
        0.71028,
        5.10844,
        0.09154
      ],
      "rClavicle": [
        -0.08435,
        5.22062,
        0.10807
      ],
      "lClavicle": [
        0.08435,
        5.22062,
        0.10807
      ],
      "rElbow": [
        -1.32425,
        4.40538,
        0.08322
      ],
      "lElbow": [
        1.32425,
        4.40538,
        0.08322
      ],
      "rWrist": [
        -1.82292,
        3.92926,
        0.79425
      ],
      "lWrist": [
        1.82292,
        3.92926,
        0.79425
      ],
      "rFingertip": [
        -2.00125,
        3.73119,
        1.1147
      ],
      "lFingertip": [
        2.00125,
        3.73119,
        1.1147
      ],
      "rHip": [
        -0.39913,
        3.40235,
        0
      ],
      "lHip": [
        0.39913,
        3.40235,
        0
      ],
      "rKnee": [
        -0.55497,
        1.86676,
        0.12486
      ],
      "lKnee": [
        0.55497,
        1.86676,
        0.12486
      ],
      "rAnkle": [
        -0.73245,
        0.26485,
        0.08163
      ],
      "lAnkle": [
        0.73245,
        0.26485,
        0.08163
      ],
      "rToe": [
        -0.73178,
        0.05098,
        0.80924
      ],
      "lToe": [
        0.73178,
        0.05098,
        0.80924
      ]
    }
  },
  "room": {
    "female": {
      "lying": 0.4165,
      "seat": 0.383
    },
    "male": {
      "lying": 0.4161,
      "seat": 0.3045
    }
  }
} as const
