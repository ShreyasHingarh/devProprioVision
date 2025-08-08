import { useRef, useState, useEffect,  } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Import external functions
import { applyGlowEffect, getGlowColor, calculateMean, generateSessionId, drawLandmarks_mirror} from '../utils/utils';
import { checkNavigatorAgent, checkWebGLAvailability} from '../utils/checks';
import { saveResultsData } from '../utils/saveToLocalStorage';
// TODO -> If you add more functions to utils/utils.tsx, import them here

// Import contexts
import { useUser } from "../contexts/UserContext";
import { useCamera } from "../contexts/CameraContext";

// Import styles
import './SharedStyles.css'
import './BlockPlacementTest.css'
import '../utils/glowEffect.css';
import explosionAnimation from '../assets/explosion.json';
import ImpairmentScale from "../components/ImpairmentScale";



// Rectangle class to manage the blocks
class Rectangle {
  x: number;
  y: number;
  w: number;
  h: number;
  isPinched: boolean = false;
  hasBeenPlaced: boolean = false;
  color: string = 'red'; // Default color

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  // Method to draw the rectangle on the canvas
  draw(ctx: CanvasRenderingContext2D) {
    if (this.isPinched) {
      this.color = 'lime'; // Green when pinched
    } else if (this.hasBeenPlaced) {
      this.color = 'blue'; // Blue when successfully placed
    } else {
      this.color = 'red'; // Default red
    }
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }

  // Method to check if a point (like the pinch center) is inside the rectangle
  contains(point: { x: number, y: number }): boolean {
    return (
      point.x > this.x &&
      point.x < this.x + this.w &&
      point.y > this.y &&
      point.y < this.y + this.h
    );
  }

  // Method to move the rectangle
  move(x: number, y: number) {
      if (this.hasBeenPlaced) return;
      // Center the rectangle on the new coordinates
      this.x = x - this.w / 2;
      this.y = y - this.h / 2;
  }
}


const YourProject = () => {
  const navigate = useNavigate();

  // Import camera settings
  const {cameraSettings, loading: cameraSettingsLoading} = useCamera();
  const [cameraSettingsLoaded, setCameraSettingsLoaded] = useState(false);

  // Import user settings
  const {userSettings, loading: userSettingsLoading} = useUser();
  const [userSettingsLoaded, setUserSettingsLoaded] = useState(false); // State to manage user settings loading

  // A task is an individual action that the user has to perform, like pointing with a finger
  const totalNumberOfTasks: number = 3; // Total number of tasks to perform in a session
  const taskRepsRef = useRef(1);        // Iterative counter for the number of task repetitions
  const taskFinishedRef = useRef(false);           // Ref to manage task completion
  const [taskResult, setTaskResult] = useState<number>(0); // State to manage the final outcome

  // A session is a collection of tasks that the user has to perform, like a training session
  const sessionIdRef = useRef<string>(generateSessionId());       // Ref to manage session ID
  const [startNewSession, setStartNewSession] = useState(false);  // State to manage session start
  const [sessionFinished, setSessionFinished] = useState(false);  // State to manage session completion
  const sessionFinishedRef = useRef(sessionFinished);             // Ref to manage session completion state
  const sessionResultsRef = useRef<number[]>([])                  // Ref to manage session results

  // Manage end of a session
  const [showConfetti, setShowConfetti] = useState(false);
  const [showResultsBox, setshowResultsBox] = useState(false);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Webcam and Canvas states
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);                // canvasRef.current refers to the actual <canvas> element in the DOM.
  const canvasCtx = useRef<CanvasRenderingContext2D | null>(null);  // canvasCtx.current refers to the 2D rendering context of the canvas.
  const [webcamRunning, setWebcamRunning] = useState(false);
  const [canvasRunning, setCanvasRunning] = useState(false);

  // Hand-related states (models, landmarks, type of hand, etc)
  const handLandmarker = useRef<HandLandmarker | null>(null); // Ref to manage the hand landmarker model
  const handSizeCMRef = useRef<number|null>(null);  // Ref to manage hand size in centimeters
  const [selectedHand, setSelectedHand] = useState<string>('Left'); // Ref to manage selected hand
  const selectedHandRef = useRef(selectedHand); // Ref to manage selected hand
  useEffect(() => {selectedHandRef.current = selectedHand;}, [selectedHand]); // Keep track of selectedHand changes
  const [selectedFingertips, setSelectedFingertips] = useState<string>('fingertips'); // State to manage selected fingertips
  const selectedFingertipsRef = useRef(selectedFingertips);
  useEffect(() => {selectedFingertipsRef.current = selectedFingertips;}, [selectedFingertips]);

  // UI-related states
  const [showIntroPopup, setShowIntroPopup] = useState(true);
  const [isWebGLAvailable, setWebGLAvailable] = useState<boolean>(true);
  

  // Assessment Game States
  const [gameStarted, setGameStarted] = useState(false);
  const [rectangles, setRectangles] = useState<Rectangle[]>([]);
  const [wins, setWins] = useState(0);
  const [misses, setMisses] = useState(0);
  
  const [shouldMoveRect, setShouldMoveRect] = useState(false);
  const shouldMoveRectRef = useRef(shouldMoveRect);
  useEffect(() => {
    shouldMoveRectRef.current = shouldMoveRect;
  }, [shouldMoveRect]);
  
  const [isPinched, setIsPinched] = useState(false);
  const isPinchedRef = useRef(isPinched);
  useEffect(() => {
    isPinchedRef.current = isPinched;
  }, [isPinched]);

  const [pinchedRectIndex, setPinchedRectIndex] = useState(-1);
  const pinchedRectIndexRef = useRef(pinchedRectIndex);
  useEffect(() => {
    pinchedRectIndexRef.current = pinchedRectIndex;
  }, [pinchedRectIndex]);
  
  const [distance, setDistance] = useState(0);
  const distanceRef = useRef(distance);
  useEffect(() => {
    distanceRef.current = distance;
  }, [distance]);
  
  const [handVisible, setHandVisible] = useState(false);
  const handVisibleRef = useRef(handVisible)
  useEffect(() => {
    handVisibleRef.current = handVisible;
  }, [handVisible]);
  
  const [gameTimeUp, setGameTimeUp] = useState(false);
  const gameTimeUpRef = useRef(gameTimeUp);
  useEffect(() => {
    gameTimeUpRef.current = gameTimeUp;
  }, [gameTimeUp]);
  
  const [gameWon, setGameWon] = useState(false);
  const gameWonRef = useRef(gameWon);
  useEffect(() => {
    gameWonRef.current = gameWon;
  }, [gameWon]);
  
  const [timeLeft, setTimeLeft] = useState(60); // 60 seconds
  const lastLandmarksRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
  const lastVisibleRef   = useRef<boolean>(false);

  // Countdown timer for the game, handles game end
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;
    if (gameStarted && handVisibleRef.current && timeLeft > 0) {
      timerId = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameTimeUp(true);
            setGameStarted(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [gameStarted, timeLeft, handVisible]);

  // tutorial/instructions related states
  const [instructionsText] = useState('Example: Touch both index fingertips together');
  const [instructionsBigText] = useState<string>('Touch index fingertips'); // State to manage the label text

  // Detect the navigator agent
  const { isMac, isWindows, isAndroid, isiOS, isSafari, isChrome, isEdge } = checkNavigatorAgent(); // Check the user agent to determine the OS and browser
  const animationFrameIdRef = useRef<number|undefined>(undefined);
  let lastDetect = 0;
  const detectInterval = 1000/30; // ms
  
  // The camera settings have been loaded
  useEffect(() => {
    if (!cameraSettingsLoading && cameraSettings) {
      setCameraSettingsLoaded(true);
      console.log('✅️📷 Camera settings loaded: ', cameraSettings);
    }
  }, [cameraSettingsLoading, cameraSettings]);

  // Check if camera settings are loaded and cameraId is available, then initialize webcam
  useEffect(() => {
    let cleanupListener: (() => void) | undefined;

    const initializeWebcam = async () => {
      if (cameraSettings.cameraId && cameraSettings.cameraId !== "defaultCamera") {
        console.log('📷 selectedCameraId: ', cameraSettings.cameraId);
        cleanupListener = await startWebcam(cameraSettings.cameraId); // Store cleanup function
      } else {
        if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
          console.warn('⚠📷 Problem might be here');
          const stream = webcamVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          webcamVideoRef.current.srcObject = null;
        }
      }
    };

    if (cameraSettingsLoaded && cameraSettings) {
      initializeWebcam();
    }

    return () => {
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, [cameraSettingsLoaded, cameraSettings]);

  // The user settings have been loaded
  useEffect(() => {
    if (!userSettingsLoading && userSettings) {
      setSelectedHand(userSettings.impairedHand);
      setSelectedFingertips(userSettings.spasticitySeverity);
      setUserSettingsLoaded(true);
      console.log('✅️👤 User settings loaded: ', userSettings);
    }
  }, [userSettingsLoading, userSettings]);

  // Check if user settings are loaded and currentUser is available, then check if hand size is saved in userSettings
  useEffect(() => {
    const checkHandSizeIsSaved = async () => {
      if (userSettings) {
        const retrievedHandSize = userSettings.targetHandSize;
        if (retrievedHandSize === 0) {
          console.warn('⚠️‍🔥 User does not have hand size saved in Firestore');
        } else {
          console.log('✅️‍🔥 User has hand size saved in Firestore');
        }
        handSizeCMRef.current = retrievedHandSize;
        }
    }
    if (userSettingsLoaded) {
      checkHandSizeIsSaved();
    }
  }, [userSettingsLoaded]);

  // Animation frame for webcam predictions
  useEffect(() => {
    animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);
  
  // Detect OS and browser
  useEffect(() => {
    console.log('💻 isMac: ', isMac);
    console.log('📱 isIOS: ', isiOS);
    console.log('💻 isWindows: ', isWindows);
    console.log('📱 isAndroid: ', isAndroid);
    console.log("👨🏼‍💻 Safari:", isSafari);
    console.log("👨🏼‍💻 Chrome:", isChrome);
    console.log("👨🏼‍💻 Edge:", isEdge);
  }, []);

  // Initialization
  useEffect(() => {
    const initializeCanvas = async () => {
      if (canvasRef.current) {
        canvasCtx.current = canvasRef.current.getContext('2d');
        setCanvasRunning(true);
        console.log('✅️📜 Canvas context initialized');
      }else{
        console.error('❌📜 CanvasRef element not found');
        setCanvasRunning(false);
      }
    };

    // Check for WebGL availability, and it not available show a popup
    setWebGLAvailable(checkWebGLAvailability(document.createElement("canvas")));
    // Create the hand landmarker
    createHandLandmarker();

    // Add event listener to resize the canvas on window resize
    window.addEventListener('resize', resizeCanvas);
    // Initialize the canvasCtx if canvasRef exists
    initializeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas ); // Clean up the event listener when the component unmounts
      console.log('📜 Removed canvas event listener')

      // Cleanup function to stop the video stream
      if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
        const stream = webcamVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        webcamVideoRef.current.srcObject = null;
      }
    };
  }, []);

  // Checks before starting the hand predictions
  useEffect(() => {
    if (!webcamRunning) {return}

    console.log("✅📝 webcamRunning is true");

    const video = webcamVideoRef.current;
    const ctx = canvasCtx.current;
    const canvas = canvasRef.current;

    // Check if required video elements exist
    if (!video) {console.error("❌ - webcamVideoRef is null or undefined");return;}
    if (!video.srcObject) {console.error("❌ No video stream attached to video element.");return;}
    if (video.readyState < 4) {console.error("❌ Video is not ready for hand tracking (readyState < 4).");return;}
    if (video.videoWidth === 0 || video.videoHeight === 0) {console.error("❌ Video dimensions are 0 (width or height).");return;}
    console.log("📝 Video dimensions are AVAILABLE, and not 0");

    // Check if hand landmarker exists
    if (!handLandmarker) {console.error("❌ - handLandmarker is not initialized");return;}
    console.log("📝 Hand Landmark Model is AVAILABLE.");

    // Check if canvas and context exist
    if (!canvas || !ctx) {console.error("❌ - canvas or canvasCtx is null or undefined");return;}
    console.log("📝 Canvas is AVAILABLE.");

    // Set initial canvas size
    resizeCanvas();

    if (userSettingsLoaded && !showIntroPopup){
      console.log("🚀🖐🏻 Starting hand prediction with predictWebcam()");
      predictWebcam();
    }
  }, [webcamRunning, handLandmarker, showIntroPopup]);

  // Start prediction of hand landmarks  when session is finished
  useEffect(() => {
    console.log('🏁 Finished the session', sessionFinished);
    sessionFinishedRef.current = sessionFinished;
    if (sessionFinishedRef.current && canvasCtx.current){
      canvasCtx.current.clearRect(0, 0, canvasCtx.current.canvas.width, canvasCtx.current.canvas.height);
    }
    predictWebcam(); // Restart the prediction loop
  }, [sessionFinished]);

  // Reset session results when starting a new session
  useEffect(() => {
    if (startNewSession === true){
      console.log('🪜 Starting new session');
      sessionIdRef.current = generateSessionId(); // create new session ID
      sessionFinishedRef.current = false;         // Reset session finished state
      taskRepsRef.current = 1;                    // Reset task repetitions counter
      sessionResultsRef.current = [];             // Reset session results

      setSessionFinished(false);                  // Reset session finished state
      setStartNewSession(false);                  // Reset start new session state
      startGame(selectedHand as 'Left' | 'Right');                    // Start the game with the selected hand
    }
  }, [startNewSession]);

  // Show results box when session is finished with certain colors depending on the task result
  useEffect(() => {
    if (showResultsBox) {
      const color = getGlowColor(taskResult);
      applyGlowEffect(resultsContainerRef.current, color);
    }
  }, [showResultsBox]);

  // Function to start the game with the selected hand
  const startGame = (hand: 'Left' | 'Right') => {
    // cancel any existing loop before resetting
    if (animationFrameIdRef.current !== undefined) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    setSelectedHand(hand as string);

    // Reset rectangles
    generateRectangles(hand);

    // Reset game states
    setShowIntroPopup(false);
    setGameStarted(true);
    setGameTimeUp(false);
    setGameWon(false);
    setTimeLeft(60); // Reset timer
    setWins(0);
    setMisses(0);

    // Reset pinching-related states and refs
    setIsPinched(false);
    setShouldMoveRect(false);
    setHandVisible(false);
    
    setPinchedRectIndex(-1);
    lastDetect = 0;
    animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
  };
  
  // Function to generate rectangles for the game
  const generateRectangles = (hand: 'Left' | 'Right') => {
    const newRects: Rectangle[] = [];
    const numBlocks = 15;
    const blockWidth = 50;
    const blockHeight = 50;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // For mirrored screen, adjust the drop zone line to 2/3 or 1/3 depending on expected hand
    const dropZoneLine = hand === 'Left'
      ? (canvas.width * 2) / 3
      : canvas.width / 3;
    const minX = hand === 'Right' ? dropZoneLine : 0;
    const maxX = hand === 'Right' ? canvas.width - blockWidth : dropZoneLine - blockWidth;

    for (let i = 0; i < numBlocks; i++) {
      let placed = false;
      while (!placed) {
        const posX = Math.random() * (maxX - minX) + minX;
        const posY = Math.random() * (canvas.height - blockHeight);
        const newRect = new Rectangle(posX, posY, blockWidth, blockHeight);

        // Check for overlap with already placed rectangles
        const overlapping = newRects.some(rect =>
          Math.abs(newRect.x - rect.x) < blockWidth && Math.abs(newRect.y - rect.y) < blockHeight
        );

        if (!overlapping) {
          newRects.push(newRect);
          placed = true;
        }
      }
    }
    setRectangles([]);
    setRectangles(newRects);
  };
  useEffect(() => {
    if (gameStarted && rectangles.length > 0) {
      const placedBlocks = rectangles.filter(rect => rect.hasBeenPlaced).length;
      if (placedBlocks === rectangles.length) {
        setGameWon(true);
        setGameStarted(false);
      }
    }
    }, [rectangles, gameStarted]);
  
  // Start webcam with the selected camera
  const startWebcam = async (cameraId: string): Promise<(() => void) | undefined> => {
      try {
        console.log('📷 Starting webcam...');
        const constraints = {
          video: {
            deviceId: { exact: cameraId },
            width: { ideal: 1080 },
            height: { ideal: 720 },
            frameRate: { ideal: 9999 },
          },
          audio: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        console.log('📷 Video Resolution:', settings.width, 'x', settings.height);

        if (webcamVideoRef.current) {
          const videoEl = webcamVideoRef.current;
          videoEl.srcObject = stream;
          videoEl.play();

          const handleLoadedData = () => {
            console.log('📷✅ Webcam started');
            setWebcamRunning(true);
          };

          videoEl.addEventListener('loadedmetadata', handleLoadedData);

          // Return cleanup function
          return () => {
            videoEl.removeEventListener('loadedmetadata', handleLoadedData);
          };
        }

        // If webcamVideoRef.current is null, return undefined
        return undefined;

      } catch (error) {
        console.error('📷❌ Error accessing webcam:', error);
        alert("📷❌ Error accessing webcam. Please enable your webcam and reload this page.");
        // Return undefined on error
        return undefined;
      }
  };

  // Create the Hand Landmarker
  const createHandLandmarker = async () => {
    if (handLandmarker.current) return; // Prevent re-creating if already exists
    // Load and prepare the WebAssembly (WASM) runtime from the given CDN to run MediaPipe Vision tasks (like hand tracking) in the browser.
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    // Initialize the actual hand tracking model using the vision runtime, and configure how it should behave.
    const model = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
    handLandmarker.current = model;
    console.log("🖐🏻Hand landmarker created", model);
  };

  // Function to resize the canvas based on the webcam video dimensions
  const resizeCanvas = () => {
    console.log('📜Canvas resize called');
    // Check if webcam video and canvas references are available
    if (webcamVideoRef.current && canvasRef.current  && canvasCtx.current) {
      // Log the video dimensions to ensure they are correct
      console.log(`📷 Video dimensions - Width: ${webcamVideoRef.current.videoWidth}, Height: ${webcamVideoRef.current.videoHeight}`);
      // Set canvas size to match the video size
      canvasRef.current.width = webcamVideoRef.current.videoWidth;
      canvasRef.current.height = webcamVideoRef.current.videoHeight;
      console.log(`📜Canvas resized - Width: ${canvasRef.current.width}, Height: ${canvasRef.current.height}`);
      // Resize the canvas context to match the updated canvas size
      canvasCtx.current.canvas.width = webcamVideoRef.current.videoWidth;
      canvasCtx.current.canvas.height = webcamVideoRef.current.videoHeight;
      console.log(`📜Canvas context resized - Width: ${canvasCtx.current.canvas.width}, Height: ${canvasCtx.current.canvas.height}`);
    } else {
      console.error('❌📜Canvas or webcam video reference is missing!');
    }
  };

  const moveRectangle = (index: number, x: number, y: number) => {
    const rect = rectangles[index];
    if(rect === undefined || rect.hasBeenPlaced) {
      return;
    }

    rect.x = x - rect.w / 2; // Center the rectangle on the new coordinates
    rect.y = y - rect.h / 2;

    // Update only the affected rectangle
    // Update only the affected rectangle using functional update
    setRectangles(prev => {
      const updated = [...prev];
      updated[index] = rect;
      return updated;
    });
  };

  const repositionRectangle = (index: number) => {
    const rect = rectangles[index];
    const canvasWidth = canvasCtx.current!.canvas.width;
    const zoneLine = selectedHandRef.current === 'Left'
      ? (canvasWidth * 2) / 3
      : canvasWidth / 3;
    const minX = selectedHandRef.current === 'Left' ? 0 : zoneLine;
    const maxX = selectedHandRef.current === 'Left'
      ? zoneLine - rect.w
      : canvasWidth - rect.w;

    let tries = 0;
    let newX = 0, newY = 0;
    let overlapping;

    do {
      newX = Math.random() * (maxX - minX) + minX;
      newY = Math.random() * (canvasCtx.current!.canvas.height - rect.h);
      overlapping = rectangles.some(
        (other, idx) =>
          idx !== index &&
          !other.hasBeenPlaced &&
          Math.abs(newX - other.x) < rect.w &&
          Math.abs(newY - other.y) < rect.h
      );
      tries++;
    } while (overlapping && tries < 50);

    rect.x = newX;
    rect.y = newY;

    // Update only the affected rectangle with a new instance to trigger re-draw
    setRectangles(prev => prev.map((r, i) => {
      if (i === index) {
        // create new rect instance at new position
        const newRect = new Rectangle(newX, newY, r.w, r.h);
        newRect.hasBeenPlaced = r.hasBeenPlaced;
        return newRect;
      }
      return r;
    }));
  };
  
  // Function to setup the canvas before drawing
  const setupCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  // Draw the drop zone line for the specified hand
  const drawDropZoneLine = (ctx: CanvasRenderingContext2D, hand: string) => {
    const dropZoneLine = hand === 'Right' ? ctx.canvas.width / 3 : (ctx.canvas.width * 2) / 3;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(dropZoneLine, 0);
    ctx.lineTo(dropZoneLine, ctx.canvas.height);
    ctx.stroke();
  };

  // Interface for hand detection results
  interface HandDetectionResults {
    handedness: Array<Array<{ categoryName: string; score: number }>>;
    landmarks: Array<Array<{ x: number; y: number; z: number }>>;
  }

  // Function to detect the hand based on the results from the hand landmarker
  const detectHand = (results: HandDetectionResults) => {
    return results.handedness.findIndex(
      hand => hand[0].categoryName === (selectedHandRef.current === 'Right' ? 'Left' : 'Right') && hand[0].score > 0.5
    );
  };

  // Function to calculate the distance between thumb and index fingertips for pinch detection
  const calculatePinchDistance = (
    thumbTip: { x: number; y: number; z: number },
    indexTip: { x: number; y: number; z: number }
  ): number => {
    return Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
  };
  // Function to handle pinch detection logic
  const handlePinchDetection = (
    thumbTip: { x: number; y: number; z: number },
    indexTip: { x: number; y: number; z: number },
    ctx: CanvasRenderingContext2D
  ) => {
    const pinchThreshold = 0.05;

    // Mirror the X coordinate for pinch center (to match mirrored video/canvas)
    const pinchCenterX = (1 - ((thumbTip.x + indexTip.x) / 2)) * ctx.canvas.width;
    const pinchCenterY = ((thumbTip.y + indexTip.y) / 2) * ctx.canvas.height;
    
    if (shouldMoveRectRef.current && isPinchedRef.current && pinchedRectIndexRef.current !== -1) {
      moveRectangle(pinchedRectIndexRef.current, pinchCenterX, pinchCenterY);
    }

    const distance = calculatePinchDistance(thumbTip, indexTip);
    setDistance(distance);

    if (distance < pinchThreshold && !isPinchedRef.current) {
      handlePinchStart(pinchCenterX, pinchCenterY);
    } else if (distance > pinchThreshold + 0.03 && isPinchedRef.current) {
      handlePinchRelease();
    }
  };

  // Function to handle pinch start logic
  const handlePinchStart = (pinchCenterX: number, pinchCenterY: number) => {
    // Prevent pinch logic if the game is already won
    if (gameWonRef.current || gameTimeUpRef.current) return;

    setIsPinched(true);

    const rectsCopy = [...rectangles];
    let rectFound = false;
    // Check if the pinch center is within any rectangle
    for (let i = 0; i < rectsCopy.length; i++) {
      if (!rectsCopy[i].hasBeenPlaced && rectsCopy[i].contains({ x: pinchCenterX, y: pinchCenterY })) {
        setPinchedRectIndex(i);
        rectsCopy[i].isPinched = true;
        rectFound = true;
        setRectangles(rectsCopy);
        setShouldMoveRect(true);
        break;
      }
    }

    // If no rectangle was found, increment misses and reset pinchedRectIndex
    if (!rectFound) {
      setMisses(prev => prev + 1);
      setPinchedRectIndex(-1);
    }
  };

  // Function to handle pinch release logic
  const handlePinchRelease = () => {
    setIsPinched(false);
    setShouldMoveRect(false);

    // If a rectangle was pinched, check if it was successfully placed
    if (pinchedRectIndexRef.current !== -1) {
      const rect = rectangles[pinchedRectIndexRef.current];
      const dropZoneLine = selectedHandRef.current === 'Left' ? (canvasCtx.current!.canvas.width * 2) / 3 : canvasCtx.current!.canvas.width / 3;
      const isLeftHand = selectedHandRef.current === 'Left';
      const success = (isLeftHand && rect.x >= dropZoneLine) || (!isLeftHand && rect.x <= dropZoneLine);

      if (success) {
        setWins(prev => prev + 1);
        rect.hasBeenPlaced = true;
      } else {
        // If not successfully placed, reposition the rectangle
        repositionRectangle(pinchedRectIndexRef.current);
      }

      rect.isPinched = false;
      const updatedRectangles = [...rectangles];
      updatedRectangles[pinchedRectIndexRef.current] = rect;
      setRectangles(updatedRectangles);
      setPinchedRectIndex(-1);
    }
  };
  
  //Main function that loops during gameplay
  const predictWebcam = async (now = performance.now()) => {
    const ctx = canvasCtx.current;
    if (!ctx || !webcamVideoRef.current || !handLandmarker.current) {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    // clear
    setupCanvas(ctx);

    // only run expensive detection at throttle interval
    let results: HandDetectionResults|undefined;
    if (gameStarted && now - lastDetect > detectInterval) {
      lastDetect = now;
      results = await handLandmarker.current.detectForVideo(
        webcamVideoRef.current, now
      );

      // update cached landmarks & visibility
      if (results && results.handedness.length && !gameTimeUpRef.current && !gameWonRef.current) {
        const idx = detectHand(results);
        const visible = idx !== -1;
        lastVisibleRef.current = visible;
        lastLandmarksRef.current = visible ? results.landmarks[idx] : [];
        setHandVisible(prev => prev !== visible ? visible : prev);
      } else {
        lastVisibleRef.current = false;
        lastLandmarksRef.current = [];
        setHandVisible(prev => prev ? false : prev);
      }
    }

    // draw static elements
    drawDropZoneLine(ctx, selectedHandRef.current);
    rectangles.forEach(rect => rect.draw(ctx));

    // redraw the last known landmarks every frame
    if (lastVisibleRef.current && !gameTimeUpRef.current && !gameWonRef.current) {
      const lm = lastLandmarksRef.current;
      drawLandmarks_mirror(ctx, lm, 'rgb(64,224,208)');
      handlePinchDetection(lm[4], lm[8], ctx);
    }
    ctx.restore();
    animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="yourproject-container" style={isiOS ? { background: "black" } : {}}>

      {!isWebGLAvailable ? (
        <div className="popupDebugContainer" >
        <div className="bg-red-500 text-white p-2 rounded">
          ⚠️ WebGL is disabled!
          <br />
          ➡️ Enable it in your browser to use the hand tracking model:
          <a
            href="https://help.constructiononline.com/en/scheduling-webgl-and-hardware-acceleration"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-300 underline"
          >
             WebGL & Hardware Acceleration Guide
          </a>

        </div>
         </div>
      ) : null}

      {/* When your metric is good, show some confetti animation */}
      {showConfetti && (
        <div className="confettiContainer">
        <Lottie
          animationData={explosionAnimation}
          loop={true}
          autoplay
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      )}

      {/* After each movement, show the results. Also show the sessionr esults when all tasks are finished */}
      {showResultsBox && (
        <div className="resultsContainer" ref={resultsContainerRef}>
          {taskRepsRef.current <= totalNumberOfTasks ? (
            <>
              <label className="resultsText">{taskResult.toFixed(2)} px</label>
            </>
          ) : (
            <div className="resultsInColumn">
              <label className="resultsText">
                Mean: {calculateMean(sessionResultsRef.current)} px
              </label>
              {sessionResultsRef.current.map((score, index) => {
                let color = '';
                // TODO -> Change these thresholds to your own metric thresholds
                if (score < 2) {
                  color = 'green';
                } else if (score < 5) {
                  color = 'orange';
                } else {
                  color = 'red';
                }

                return (
                  <label
                    key={index}
                    className="resultsTextInches"
                    style={{ color }}
                  >
                    {score.toFixed(2)}
                  </label>
                );
              })}

              <button
                onClick={() => {
                  setStartNewSession(true);
                  setshowResultsBox(false);
                  taskFinishedRef.current = false;
                }}
                className="popup-button"
              >
                Restart Session
              </button>
            </div>
          )}
        </div>
      )}

      {/* Game End Results */}
      {(gameTimeUpRef.current || gameWonRef.current) && (
        <div className="popup-overlay">
          <div className="popup-container">
            <h2 className="popup-title-text">
                {gameWonRef.current ? "🎉 You Won!" : "⏰ Time's Up!"}

                
            </h2>
            <div style={{ textAlign: 'center', margin: '20px 0', color: 'black' }}>
              <p style={{ fontSize: '18px', margin: '10px 0' }}>
              Blocks Moved: {rectangles.filter(rect => rect.hasBeenPlaced).length} / {rectangles.length}
              </p>
              <p style={{ fontSize: '18px', margin: '10px 0' }}>
              Score - Wins: {wins} | Misses: {misses} | Selected Hand: {selectedHandRef.current}
              </p>
            </div>
            
            <button 
              className="popup-button"
              onClick={() => {
                // Reset game states
                setGameTimeUp(false);
                setGameWon(false);
                setShowIntroPopup(true);

                // Reset rectangles
                setRectangles([]);
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
      {/* Choose between Assessment or Game mode */}
      {showIntroPopup && (
        <div className="popup-overlay" >
          <div className="popup-container">
            <h2 className="popup-title-text">Choose Your Hand</h2>
              <div style={{ display: 'flex', gap: '20px' }}>
                <button
                  className="introPopup-button"
                  onClick={() => startGame('Left')}
                  disabled={!webcamRunning || !canvasRunning}
                  style={{ opacity: (webcamRunning && canvasRunning) ? 1 : 0.3 }}
                >
                  Left
                </button>
                <button
                  className="introPopup-button"
                  onClick={() => startGame('Right')}
                  disabled={!webcamRunning || !canvasRunning}
                  style={{ opacity: (webcamRunning && canvasRunning) ? 1 : 0.3 }}
                >
                  Right
                </button>
              </div>
             <button
               className="introPopup-button"
               onClick={() => navigate('/')}
               style={{ marginTop: '20px' }}
             >
               Home
             </button>
          </div>
        </div>
      )}
      {/* The webcam video and canvas */}
        <div className="video-canvas-overlay">
          <video
            ref={webcamVideoRef}
            playsInline
            muted
            className="video show"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="canvas show" />
          
          {/* Game Stats Display */}
          <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '5px', fontSize: '20px', zIndex: 20 }}>
            Wins: {wins} | Misses: {misses}
          </div>

          {/* Timer Display - Top Right */}
          {gameStarted && (
            <div style={{ position: 'absolute', top: 20, right: 10, zIndex: 20 }}>
              <span style={{ 
                fontSize: '1.5rem', 
                color: 'white', 
                background: 'rgba(0,0,0,0.7)', 
                padding: '0.5em 1em', 
                borderRadius: '8px',
                border: '2px solid black' 
              }}>
                ⏱️ {timeLeft}s
              </span>
            </div>
          )}
  </div>

      {/* Tutorial video and instructions */}
        <div className='tutorialContainer'>
          <img
            className='imgTutorial'
            src={"/assets/yourproject-instructions.png"}
          />

          {/* Instructions or Blender File */}
          <div className="instructionsContainer">
              <p className="instructions_text">{instructionsText}</p>
          </div>

          {/* TODO -> Change the thresholds for your impairment scale to provide feedback on the proprioceptive accuracy */}
          <ImpairmentScale error={calculateMean(sessionResultsRef.current)} />


          {!isiOS && (
            <div>
              <label className="fingerLabelBig_text">
                {instructionsBigText}
              </label>
            </div>
          )}
        </div>
    </div>
  );

};

export default YourProject;