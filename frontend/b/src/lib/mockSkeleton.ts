// src/lib/mockSkeleton.ts

export interface SkeletonLandmark {
  id: number;
  x: number;
  y: number;
}

export const getMockSkeleton = (frameIndex: number, leanDirection: "left" | "right" | "none" = "none"): {
  landmarks: SkeletonLandmark[];
  edges: Array<[number, number]>;
} => {
  const t = frameIndex * 0.15;
  
  // Base nose offset based on lean
  let noseX = 0.5;
  if (leanDirection === "left") noseX = 0.44;
  else if (leanDirection === "right") noseX = 0.56;
  else noseX = 0.5 + Math.sin(t * 0.5) * 0.01;

  // Let's simulate breathing / slight movement
  const breathe = Math.sin(t) * 0.005;
  const leftShoulderY = 0.42 + breathe;
  const rightShoulderY = 0.42 - breathe;

  const landmarks: SkeletonLandmark[] = [
    { id: 0,  x: noseX, y: 0.22 + Math.cos(t * 0.3) * 0.005 }, // Nose
    { id: 11, x: 0.40,  y: leftShoulderY },                    // Left Shoulder
    { id: 12, x: 0.60,  y: rightShoulderY },                   // Right Shoulder
    { id: 13, x: 0.36,  y: leftShoulderY + 0.18 },             // Left Elbow
    { id: 14, x: 0.64,  y: rightShoulderY + 0.18 },            // Right Elbow
    { id: 23, x: 0.43,  y: 0.75 },                             // Left Hip
    { id: 24, x: 0.57,  y: 0.75 }                              // Right Hip
  ];

  const edges: Array<[number, number]> = [
    [0, 11], [0, 12],
    [11, 12],
    [11, 13], [12, 14],
    [11, 23], [12, 24],
    [23, 24]
  ];

  return { landmarks, edges };
};
