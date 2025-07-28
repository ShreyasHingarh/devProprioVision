// For OpenPoint
export const fps = 30;
export const homePose = 0;
export const handPositionedPose = 140/fps;
export const fingersExtendedPose = 190/fps;
export const readyPose = 260/fps;
export const pointToThumb = 330/fps;
export const returnFromThumb = 390/fps;
export const pointToIndex = 460/fps;
export const returnFromIndex = 520/fps;
export const pointToMiddle = 590/fps;
export const returnFromMiddle = 650/fps;
export const pointToRing = 720/fps;
export const returnFromRing = 780/fps;
export const pointToPinkie = 850/fps;
export const returnFromPinkie = 910/fps;

// For Symmetry
export const readyPoseSymmetry = 60/fps; 
export const startFigureLine = 120/fps;
export const returnFigureLine = 178/fps;

export const possibleTargetFingersStr = {
    knuckles: ['thumb', 'index', 'middle', 'ring', 'pinkie'],
    midknuckles: ['thumb', 'index', 'middle', 'ring', 'pinkie'],
    fingertips: ['thumb', 'index', 'middle', 'ring', 'pinkie']
}; 

export const possibleTargetFingers = {
  knuckles: [2, 5, 9, 13, 17],
  midknuckles: [3, 6, 10, 14, 18],
  fingertips: [4, 8, 12, 16, 20] 
}



export const generateSessionId = () => {
  const now = new Date();
  return `session_${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
};

export const letterTargetsList = [
  {
    wordSet: "STARE",
    targets: [
      { index: 4, letter: "T" },
      { index: 8, letter: "S" },
      { index: 12, letter: "R" },
      { index: 16, letter: "E" },
      { index: 20, letter: "A" },
    ],
    possibleWords: ["STARE", "TEARS", "RATES", "ASTER"],
  },
  {
    wordSet: "TRAPS",
    targets: [
      { index: 4, letter: "T" },
      { index: 8, letter: "R" },
      { index: 12, letter: "A" },
      { index: 16, letter: "P" },
      { index: 20, letter: "S" },
    ],
    possibleWords: ["TRAPS", "STRAP", "PARTS", "TARPS"],
  },
  {
    wordSet: "PLANE",
    targets: [
      { index: 4, letter: "P" },
      { index: 8, letter: "L" },
      { index: 12, letter: "A" },
      { index: 16, letter: "N" },
      { index: 20, letter: "E" },
    ],
    possibleWords: ["PLANE", "PANEL", "PENAL", "LEPAN"], // optional: LEPAN is rare, replace if needed
  },
  {
    wordSet: "SLATE",
    targets: [
      { index: 4, letter: "S" },
      { index: 8, letter: "L" },
      { index: 12, letter: "A" },
      { index: 16, letter: "T" },
      { index: 20, letter: "E" },
    ],
    possibleWords: ["SLATE", "STALE", "STEAL", "LEAST"],
  },
  {
    wordSet: "TIRES",
    targets: [
      { index: 4, letter: "T" },
      { index: 8, letter: "I" },
      { index: 12, letter: "R" },
      { index: 16, letter: "E" },
      { index: 20, letter: "S" },
    ],
    possibleWords: ["TIRES", "TRIES", "RITES", "SIRET"], // SIRET is technical — can replace with "TIERS"
  }
];

export const checkMovementStopped = (speeds: number[]): boolean => {
  const lastIndex = speeds.length - 1;

  // Not enough data
  if (lastIndex < 100) return false;

  // Get the last 100 speeds
  const last30 = speeds.slice(-30);
  const mean = last30.reduce((sum, val) => sum + val, 0) / last30.length;

  // Check conditions
  return mean < 2;
};


export const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarksArray: any[],
    fillStyle: string,
    iterativeHand: any,
    selectedHand: string,
    tutorialState: number

) => {
    const isTargetHand = iterativeHand !== selectedHand;

    const points = landmarksArray.map(landmark => ({
        x: landmark.x * ctx.canvas.width,
        y: landmark.y * ctx.canvas.height
    }));

    if (tutorialState === 4 && isTargetHand) {

        const hull = computeConvexHull(points);
        const dilatedHull = dilateHull(hull, 50); // 10px outward dilation

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(dilatedHull[0].x, dilatedHull[0].y);
        for (let i = 1; i < dilatedHull.length; i++) {
            ctx.lineTo(dilatedHull[i].x, dilatedHull[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'black';
        ctx.fill();
        ctx.restore();
    } else {
        landmarksArray.forEach((landmark, index) => {
            const x = landmark.x * ctx.canvas.width;
            const y = landmark.y * ctx.canvas.height;

            ctx.fillStyle = (index === 8 && !isTargetHand) ? 'red' : fillStyle;
            ctx.beginPath();
            const circleplotsize = window.innerWidth < 1024 ? 4 : 6;
            ctx.arc(x, y, circleplotsize, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
};

export const  drawDotOnCanvas = (
   ctx: CanvasRenderingContext2D,
   x: number,
   y: number, 
   radius: number, 
   color: string
  ) => { 
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.arc(ctx.canvas.width - x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}


export const drawLandmarksSymmetryAssess = (
    ctx: CanvasRenderingContext2D,
    landmarksArray: any[],
    fillStyle: string,
    iterativeHand: any,
    selectedHand: string,
    blockVision: boolean,

) => {
    const isTargetHand = iterativeHand !== selectedHand;

    if (isTargetHand) {
      if (!blockVision){
        landmarksArray.forEach((landmark, index) => {
            const x = landmark.x * ctx.canvas.width;
            const y = landmark.y * ctx.canvas.height;

            ctx.fillStyle = index === 8  ? 'red' : fillStyle;
            ctx.beginPath();
            const circleplotsize = window.innerWidth < 1024 ? 4 : 6;
            ctx.arc(x, y, circleplotsize, 0, 2 * Math.PI);
            ctx.fill();
        });
      }     
    } else {
        landmarksArray.forEach((landmark, index) => {
            const x = landmark.x * ctx.canvas.width;
            const y = landmark.y * ctx.canvas.height;

            ctx.fillStyle = index === 8 ? 'red' : fillStyle;
            ctx.beginPath();
            const circleplotsize = window.innerWidth < 1024 ? 4 : 6;
            ctx.arc(x, y, circleplotsize, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
};

export const drawLandmarksSymmetry = (
  ctx: CanvasRenderingContext2D,
  landmarksArray: any[],
  iterativeHand: string,        // "Right" or "Left" from MediaPipe
  selectedHand: string,         // User-selected hand: "Right" or "Left"
  blockVision: boolean,
) => {
  // Flip because webcam is mirrored
  const flippedHand = iterativeHand === 'Right' ? 'Left' : 'Right';
  const isTargetHand = flippedHand === selectedHand;

  const thumbTip = landmarksArray[4];
  if (!thumbTip) return;

  const x = thumbTip.x * ctx.canvas.width;
  const y = thumbTip.y * ctx.canvas.height;
  const circlePlotSize = window.innerWidth < 1024 ? 10 : 12;

  // Don't change the color depending on the hand, left side of the screen is always red
  if (iterativeHand==="Right"){
     ctx.fillStyle = 'red';
  }else{
    ctx.fillStyle = 'blue';
  }
  if (isTargetHand) {
    // Only draw if vision is NOT blocked
    if (!blockVision) {
     
      ctx.beginPath();
      ctx.arc(x, y, circlePlotSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  } else {
    // Always draw pointing hand
    
    ctx.beginPath();
    ctx.arc(x, y, circlePlotSize, 0, 2 * Math.PI);
    ctx.fill();
  }
};




function computeConvexHull(points: { x: number, y: number }[]): { x: number, y: number }[] {
    if (points.length <= 3) return points;

    points.sort((a, b) => a.x - b.x || a.y - b.y);
    interface Point {
      x: number;
      y: number;
    }

    const cross = (o: Point, a: Point, b: Point): number =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower = [];
    for (const p of points) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }

    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

// Push each point outward from the centroid by a dilationRadius
function dilateHull(points: { x: number, y: number }[], dilationRadius: number) {
    // Compute centroid
    const centroid = points.reduce((acc, p) => ({
        x: acc.x + p.x / points.length,
        y: acc.y + p.y / points.length
    }), { x: 0, y: 0 });

    return points.map(p => {
        const dx = p.x - centroid.x;
        const dy = p.y - centroid.y;
        const length = Math.sqrt(dx * dx + dy * dy) || 1;
        return {
            x: p.x + (dx / length) * dilationRadius,
            y: p.y + (dy / length) * dilationRadius
        };
    });
}


// Input to this function are the landmarks of the hand and the canvas context
export const drawLandmarks_simple = (ctx: CanvasRenderingContext2D, landmarksArray: any[], fillStyle: string) => {
  // Flatten the landmarksArray (if it's an array of arrays) and iterate through each landmark.
  landmarksArray.forEach((landmark) => {
      // **** DISPLAY DIMENSIONS ****
      // Calculate the x and y coordinates of the landmark based on the canvas size.
      const x = landmark.x * ctx.canvas.width;  // x is a proportion of the canvas width.
      const y = landmark.y * ctx.canvas.height; // y is a proportion of the canvas height.
      
      ctx.fillStyle =  fillStyle;
      
      // Begin drawing a new path (circle for the landmark).
      ctx.beginPath();
      
      // Draw a circle at the (x, y) coordinates with a radius of 4.
      const circleplotsize = window.innerWidth < 1024 ? 4 : 6; // Adjust circle size based on window width
      ctx.arc(x, y, circleplotsize, 0, 2 * Math.PI); // The circle is drawn using a full arc (0 to 2 * Math.PI).
      // Fill the circle on the canvas.
      ctx.fill();   
  });
};

 // Calculate the Euclidean distance in the xy plane between the index pointer fingertip (landmark 8) and the randomly chosen finger landmark (landmark rand?)
export const calculateDistance = (target: any, pointer: any) => {
    const dx = target[0] - pointer[0];
    const dy = target[1] - pointer[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance;
};

// Function to calculate speed based on the distances
export const calculateSpeed = (distances: number[], timediff: number): number => {
    const lastIndex = distances.length - 1;
    if (lastIndex < 1) return 0; // Not enough data to calculate speed

    const distanceDiff = distances[lastIndex] - distances[lastIndex - 1];

    return Math.abs(distanceDiff) / timediff; // Speed = Distance / Time
};

// Calculate the target hand size using the landmarks and the selected fingertip type, by summing the distances between pairs of landmarks
export const calculateHandSizePX = ( landmarks: any, videoWidth: any, videoHeight: any):  number => {
    let s: number[] = [];
    let e: number[] = [];
  
    s = [0, 1, 2, 3, 0, 5, 6, 7, 5, 9, 10, 11, 9, 13, 14, 15, 13, 17, 18, 19, 0];
    e = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 17];
    
    let sumHandSize = 0;
  
    for (let i = 0; i < s.length; i++) {
      const start = landmarks[s[i]];
      const end = landmarks[e[i]];
  
      if (!start || !end) continue;

      const dx = videoWidth*(1-start.x) - videoWidth*(1-end.x);
      const dy = videoHeight*(start.y - end.y);
       
      const lineLength = Math.sqrt(dx ** 2 + dy ** 2);
      sumHandSize += lineLength;
    }
  
    return sumHandSize; 
  }


  const jointPairs: Record<string,{ s: number[]; e: number[] }> = {
    fingertips: {
      s: [0, 1, 2, 3, 0, 5, 6, 7, 5, 9, 10, 11, 9, 13, 14, 15, 13, 17, 18, 19, 0],
      e: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 17],
    },
    midknuckles: {
      s: [6, 10, 14, 18, 2, 5, 17],
      e: [5, 9, 13, 17, 0, 0, 0],
    },
    knuckles: {
      s: [5, 17, 17, 2],
      e: [0, 0, 5, 0],
    }  
  };

  export const calculateHandSizeCM = (
    landmarksW: any,
  ): number => {
    const selectedKey = 'fingertips'; // If interested in changing hand size calculation based on different target landmarks: const selectedKey = isTargetHand ? selectedFingertips : 'fingertips';
    const pair = jointPairs[selectedKey];

    const { s: startIndices, e: endIndices } = pair;
    let sumLength = 0;

    for (let i = 0; i < startIndices.length; i++) {
      const start = landmarksW[startIndices[i]];
      const end = landmarksW[endIndices[i]];

      if (!start || !end) continue;

      const dx = start.x - end.x;
      const dy = start.y - end.y;
      const dz = start.z - end.z;

      sumLength += Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
    }

    return sumLength * 100; // Convert to cm
  };



export type GlowColor = 'red' | 'yellow' | 'green';

export const applyGlowEffect = (
  element: HTMLElement | null,
  color: GlowColor
) => {
  if (!element) return;

  const className = `glow-effect-${color}`;

  // Add class
  element.classList.add(className);

  // Remove class after animation ends (duration: 1s)
  setTimeout(() => {
    element.classList.remove(className);
  }, 1000);
};

export const getGlowColor = (distance: number): GlowColor => {
  if (distance < 2) return 'green';
  if (distance < 5) return 'yellow';
  return 'red';
};

export const getGlowColorSymmetry = (symmetryScore: number): GlowColor => {
  if (symmetryScore > 70) return 'green';
  if (symmetryScore < 70) return 'yellow';
  return 'red';
};


export function calculateMeanDistance(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0) return 0;

  // Step 1: Cap the outcome metrics larger than 10 at 10 (TODO -> use your own mean function, or remove the threshold cap)
  const cappedValues = values.map(val => (val > 10 ? 10 : val));

  // Step 2: Calculate the mean
  const sum = cappedValues.reduce((acc, val) => acc + val, 0);
  const mean = sum / cappedValues.length;

  return parseFloat(mean.toFixed(2)); // Round to 2 decimal places
}

export function calculateMean(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0) return 0;

  // Calculate the mean
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;

  return parseFloat(mean.toFixed(2)); // Round to 2 decimal places
}


export const drawLetters = (
  ctx: CanvasRenderingContext2D,
  landmarksArray: any[],
  fillStyle: string,
  iterativeHand: any,
  selectedHand: string,
  letterTargets?: { index: number; letter: string }[]
) => {
  const isTargetHand = iterativeHand !== selectedHand;

  if (!isTargetHand || !letterTargets || !Array.isArray(letterTargets)) return;

  letterTargets.forEach(({ index, letter }) => {
    const landmark = landmarksArray[index];
    if (!landmark) return;

    const x = landmark.x * ctx.canvas.width;
    const y = landmark.y * ctx.canvas.height;

    ctx.save();

    // Flip horizontally (mirror across vertical axis)
    ctx.translate(ctx.canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.fillStyle = fillStyle;
    ctx.font = `${window.innerWidth < 1024 ? 44 : 48}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Adjust x position for mirrored canvas
    ctx.fillText(letter.toUpperCase(), ctx.canvas.width - x, y);

    ctx.restore();
  });
};

export const Hline_P1x_ = 0.1;
export const Hline_P1y_ = 0.5;
export const Hline_P2x_ = 0.9;
export const Hline_P2y_ = 0.5;
export const Hline_Tx_ = 0.85; // Target x (or when it has to stop) on the right
export const Hline_Ty_ = 0.5;

export const Vline_P1x_ = 0.2;
export const Vline_P1y_ = 0.2;
export const Vline_P2x_ = 0.5;
export const Vline_P2y_ = 0.5;
export const Vline_P3x_ = 0.8;
export const Vline_P3y_ = 0.2;
export const Vline_Tx_ = 0.77; // Target x (or when it has to stop) on the right
export const Vline_Ty_ = 0.23;

export const iVline_P1x_ = 0.2;
export const iVline_P1y_ = 0.8;
export const iVline_P2x_ = 0.5;
export const iVline_P2y_ = 0.5;
export const iVline_P3x_ = 0.8;
export const iVline_P3y_ = 0.8;
export const iVline_Tx_ = 0.77; // Target x (or when it has to stop) on the right
export const iVline_Ty_ = 0.77;



export function SymmetryDrawTargetLine(ctx: CanvasRenderingContext2D, selectedTarget: string) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; // Semi-transparent white
  ctx.lineWidth = ctx.canvas.height * 0.1;      // Thick stroke for visibility

  if (selectedTarget === 'H-line') {
    // Horizontal line
    const line_P1x = ctx.canvas.width * Hline_P1x_;
    const line_P1y = ctx.canvas.height * Hline_P1y_;
    const line_P2x = ctx.canvas.width * Hline_P2x_;
    const line_P2y = ctx.canvas.height * Hline_P2y_;

    ctx.beginPath();
    ctx.moveTo(line_P1x, line_P1y); // Start
    ctx.lineTo(line_P2x, line_P2y); // End
    ctx.stroke();

    // Visual target at both ends
    drawDotOnCanvas(ctx, ctx.canvas.width * Hline_Tx_, ctx.canvas.height * Hline_Ty_, 15, 'rgb(255, 0, 0)');
  } 
  else if (selectedTarget === 'V-line') {
    const line_P1x = ctx.canvas.width * Vline_P1x_;
    const line_P1y = ctx.canvas.height * Vline_P1y_;
    const line_P2x = ctx.canvas.width * Vline_P2x_;
    const line_P2y = ctx.canvas.height * Vline_P2y_;
    const line_P3x = ctx.canvas.width * Vline_P3x_;
    const line_P3y = ctx.canvas.height * Vline_P3y_;

    // "V" shape
    ctx.beginPath();
    ctx.moveTo(line_P1x, line_P1y); // Left top
    ctx.lineTo(line_P2x, line_P2y); // Bottom center
    ctx.lineTo(line_P3x, line_P3y); // Right top
    ctx.stroke();

   // Visual target at both ends
    drawDotOnCanvas(ctx, ctx.canvas.width * Vline_Tx_, ctx.canvas.height *  Vline_Ty_, 15, 'rgb(255, 0, 0)');
  }
  else if (selectedTarget === 'iV-line') {
    const line_P1x = ctx.canvas.width * iVline_P1x_;
    const line_P1y = ctx.canvas.height * iVline_P1y_;
    const line_P2x = ctx.canvas.width * iVline_P2x_;
    const line_P2y = ctx.canvas.height * iVline_P2y_;
    const line_P3x = ctx.canvas.width * iVline_P3x_;
    const line_P3y = ctx.canvas.height * iVline_P3y_;

    // "V" shape
    ctx.beginPath();
    ctx.moveTo(line_P1x, line_P1y); // Left bottom
    ctx.lineTo(line_P2x, line_P2y); // Bottom center
    ctx.lineTo(line_P3x, line_P3y); // Right bottom
    ctx.stroke();

   // Visual target at both ends
    drawDotOnCanvas(ctx, ctx.canvas.width * iVline_Tx_, ctx.canvas.height *  iVline_Ty_, 15, 'rgb(255, 0, 0)');
  }
}




// Format time to 00min:00s format
export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};


export const computeSymmetryGameDifficulty = (speed: number, radius: number): 'easy' | 'medium' | 'difficult' => {
  const speedNorm = (speed - 50) / 250;
  const radiusNorm = (radius - 15) / 25;
  const score = speedNorm * 0.4 + (1 - radiusNorm) * 0.6;

  if (score <= 0.33) return 'easy';
  if (score <= 0.66) return 'medium';
  return 'difficult';
};
