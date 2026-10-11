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
  "garments": {
    "shorts": {
      "vertices": 672,
      "triangles": 1167
    },
    "top": {
      "vertices": 757,
      "triangles": 1312
    }
  },
  "sha256": "3a4c82df159278a81bd01fabab423e96f851bb60719edc066eb3d6a40ac9f882",
  "sections": [
    {
      "name": "female.skinny",
      "type": "Int16",
      "offset": 0,
      "length": 40572,
      "min": [
        -1.798185,
        0.000778,
        -0.31092
      ],
      "max": [
        1.798185,
        5.893154,
        1.01821
      ]
    },
    {
      "name": "female.growth",
      "type": "Int16",
      "offset": 81144,
      "length": 40572,
      "step": 0.0000058007774
    },
    {
      "name": "male.skinny",
      "type": "Int16",
      "offset": 162288,
      "length": 40572,
      "min": [
        -2.097296,
        0,
        -0.278988
      ],
      "max": [
        2.097296,
        6.408889,
        1.422469
      ]
    },
    {
      "name": "male.growth",
      "type": "Int16",
      "offset": 243432,
      "length": 40572,
      "step": 0.0000053164374
    },
    {
      "name": "gripIndex",
      "type": "Uint16",
      "offset": 324576,
      "length": 3012
    },
    {
      "name": "female.grip",
      "type": "Int16",
      "offset": 330600,
      "length": 9036,
      "step": 0.0000098987204
    },
    {
      "name": "male.grip",
      "type": "Int16",
      "offset": 348672,
      "length": 9036,
      "step": 0.000011208929
    },
    {
      "name": "index",
      "type": "Uint16",
      "offset": 366744,
      "length": 81108
    },
    {
      "name": "skinIndex",
      "type": "Uint8",
      "offset": 528960,
      "length": 54096
    },
    {
      "name": "skinWeight",
      "type": "Uint8",
      "offset": 583056,
      "length": 54096
    },
    {
      "name": "maskIndex",
      "type": "Uint8",
      "offset": 637152,
      "length": 40572
    },
    {
      "name": "maskWeight",
      "type": "Uint8",
      "offset": 677724,
      "length": 40572
    },
    {
      "name": "shorts.a",
      "type": "Uint16",
      "offset": 718296,
      "length": 672
    },
    {
      "name": "shorts.b",
      "type": "Uint16",
      "offset": 719640,
      "length": 672
    },
    {
      "name": "shorts.s",
      "type": "Uint16",
      "offset": 720984,
      "length": 672
    },
    {
      "name": "shorts.faces",
      "type": "Uint16",
      "offset": 722328,
      "length": 3501
    },
    {
      "name": "shorts.hem",
      "type": "Uint8",
      "offset": 729332,
      "length": 672
    },
    {
      "name": "top.a",
      "type": "Uint16",
      "offset": 730004,
      "length": 757
    },
    {
      "name": "top.b",
      "type": "Uint16",
      "offset": 731520,
      "length": 757
    },
    {
      "name": "top.s",
      "type": "Uint16",
      "offset": 733036,
      "length": 757
    },
    {
      "name": "top.faces",
      "type": "Uint16",
      "offset": 734552,
      "length": 3936
    },
    {
      "name": "top.hem",
      "type": "Uint8",
      "offset": 742424,
      "length": 757
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
        -0.56923,
        4.67582,
        0.01328
      ],
      "lShoulder": [
        0.56923,
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
        -1.14985,
        4.041,
        0.02734
      ],
      "lElbow": [
        1.14985,
        4.041,
        0.02734
      ],
      "rWrist": [
        -1.55489,
        3.59744,
        0.5253
      ],
      "lWrist": [
        1.55489,
        3.59744,
        0.5253
      ],
      "rFingertip": [
        -1.70281,
        3.41408,
        0.77183
      ],
      "lFingertip": [
        1.70281,
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
        -0.69056,
        5.10844,
        0.09154
      ],
      "lShoulder": [
        0.69056,
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
        -1.30447,
        4.40538,
        0.08322
      ],
      "lElbow": [
        1.30447,
        4.40538,
        0.08322
      ],
      "rWrist": [
        -1.80314,
        3.92926,
        0.79425
      ],
      "lWrist": [
        1.80314,
        3.92926,
        0.79425
      ],
      "rFingertip": [
        -1.98147,
        3.73119,
        1.1147
      ],
      "lFingertip": [
        1.98147,
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
      "lying": [
        0.3113,
        0.4165
      ],
      "seat": [
        0.26,
        0.383
      ]
    },
    "male": {
      "lying": [
        0.3583,
        0.4161
      ],
      "seat": [
        0.2236,
        0.3045
      ]
    },
    "neutral": {
      "lying": [
        0.3295,
        0.3727
      ],
      "seat": [
        0.2418,
        0.3438
      ]
    }
  },
  "handle": {
    "female": {
      "r": {
        "at": [
          -1.59196,
          3.36506,
          0.7057
        ],
        "axis": [
          -0.38214,
          -0.376,
          -0.84415
        ],
        "palm": [
          0.74806,
          -0.66219,
          -0.04369
        ]
      },
      "l": {
        "at": [
          1.59196,
          3.36506,
          0.7057
        ],
        "axis": [
          0.38214,
          -0.376,
          -0.84415
        ],
        "palm": [
          -0.74806,
          -0.66219,
          -0.04369
        ]
      }
    },
    "male": {
      "r": {
        "at": [
          -1.8476,
          3.6651,
          1.03775
        ],
        "axis": [
          -0.38598,
          -0.44409,
          -0.80858
        ],
        "palm": [
          0.74859,
          -0.663,
          0.00679
        ]
      },
      "l": {
        "at": [
          1.8476,
          3.6651,
          1.03775
        ],
        "axis": [
          0.38598,
          -0.44409,
          -0.80858
        ],
        "palm": [
          -0.74859,
          -0.663,
          0.00679
        ]
      }
    }
  }
} as const
