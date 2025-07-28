import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Countdown from 'react-countdown';
import Lottie from 'lottie-react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Import external functions
import { drawLandmarks_simple, calculateDistance, calculateHandSizePX, applyGlowEffect, getGlowColor, calculateMean, generateSessionId} from '../utils/utils';
import { checkNavigatorAgent, checkWebGLAvailability} from '../utils/checks';
import { saveResultsData } from '../utils/saveToLocalStorage';
// TODO -> If you add more functions to utils/utils.tsx, import them here

// Import contexts
import { useUser } from "../contexts/UserContext";
import { useCamera } from "../contexts/CameraContext";

// Import styles
import './SharedStyles.css'
import './YourProject.css'
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
  const [handId, setHandId] = useState(0);
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
  
  const handVisibleRef = useRef(false);
  const [gameTimeUp, setGameTimeUp] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // 60 seconds
  
  useEffect(() => {
    if (gameStarted && timeLeft > 0 && handVisibleRef.current) {
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            console.log("Countdown reached zero!");
            setGameTimeUp(true);
            setGameStarted(false);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [gameStarted, timeLeft, handVisibleRef.current]);

  // tutorial/instructions related states
  const [instructionsText] = useState('Example: Touch both index fingertips together');
  const [instructionsBigText] = useState<string>('Touch index fingertips'); // State to manage the label text

  // Detect the navigator agent
  const { isMac, isWindows, isAndroid, isiOS, isSafari, isChrome, isEdge } = checkNavigatorAgent(); // Check the user agent to determine the OS and browser

  
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
    const handStr = hand as string;
    setSelectedHand(handStr);

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
    setPinchedRectIndex(-1);
    isPinchedRef.current = false;
    shouldMoveRectRef.current = false;
    pinchedRectIndexRef.current = -1;
  };
  
  // Function to generate rectangles for the game
  const generateRectangles = (hand: 'Left' | 'Right') => {
    const newRects: Rectangle[] = [];
    const numBlocks = 5;
    const blockWidth = 50;
    const blockHeight = 50;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Define the area where blocks can spawn based on the selected hand
    const dropZoneLine = canvas.width / 2;
    const minX = hand === 'Left' ? dropZoneLine : 0;
    const maxX = hand === 'Left' ? canvas.width - blockWidth : dropZoneLine - blockWidth;

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
    rect.x = x - rect.w / 2; // Center the rectangle on the new coordinates
    rect.y = y - rect.h / 2;

    // Update only the affected rectangle
    const updatedRectangles = [...rectangles];
    updatedRectangles[index] = rect;
    setRectangles(updatedRectangles);
  };

  const repositionRectangle = (index: number, expectedHand: string) => {
    const rect = rectangles[index];
    const dropZoneLine = canvasCtx.current!.canvas.width / 2;
    const isLeftHand = expectedHand === 'Left';
    const minX = isLeftHand ? 0 : dropZoneLine;
    const maxX = isLeftHand ? dropZoneLine - rect.w : canvasCtx.current!.canvas.width - rect.w;

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

    const updatedRectangles = [...rectangles];
    updatedRectangles[index] = rect;
    setRectangles(updatedRectangles);
  };
  
  const setupCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.scale(-1, 1);
    ctx.translate(-ctx.canvas.width, 0);
  };

  const drawDropZoneLine = (ctx: CanvasRenderingContext2D) => {
    const dropZoneLine = ctx.canvas.width / 2;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(dropZoneLine, 0);
    ctx.lineTo(dropZoneLine, ctx.canvas.height);
    ctx.stroke();
  };

  interface HandDetectionResults {
    handedness: Array<Array<{ categoryName: string; score: number }>>;
    landmarks: Array<Array<{ x: number; y: number; z: number }>>;
  }

  const detectHand = (results: HandDetectionResults, expectedHand: string) => {
    return results.handedness.findIndex(
      hand => hand[0].categoryName === expectedHand && hand[0].score > 0.5
    );
  };

  const calculatePinchDistance = (thumbTip: any, indexTip: any) => {
    return Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
  };
  const handlePinchDetection = (thumbTip: any, indexTip: any, ctx: CanvasRenderingContext2D, expectedHand: string) => {
    const pinchThreshold = 0.05;

    const pinchCenterX = (thumbTip.x + indexTip.x) / 2 * ctx.canvas.width;
    const pinchCenterY = (thumbTip.y + indexTip.y) / 2 * ctx.canvas.height;

    const distance = calculatePinchDistance(thumbTip, indexTip);
    setDistance(distance);

    if (distance < pinchThreshold && !isPinchedRef.current) {
      handlePinchStart(pinchCenterX, pinchCenterY);
    } else if (distance > pinchThreshold && isPinchedRef.current) {
      handlePinchRelease(expectedHand);
    }

    if (shouldMoveRectRef.current && isPinchedRef.current && pinchedRectIndexRef.current !== -1) {
      moveRectangle(pinchedRectIndexRef.current, pinchCenterX, pinchCenterY);
    }
  };

  const handlePinchStart = (pinchCenterX: number, pinchCenterY: number) => {
    // Prevent pinch logic if the game is already won
    if (gameWon) return;

    setIsPinched(true);
    isPinchedRef.current = true;

    const rectsCopy = [...rectangles];
    let rectFound = false;

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

    if (!rectFound) {
      setMisses(prev => prev + 1);
      setPinchedRectIndex(-1);
    }
  };

  const handlePinchRelease = (expectedHand: string) => {
    setIsPinched(false);
    setShouldMoveRect(false);
    isPinchedRef.current = false;

    if (pinchedRectIndexRef.current !== -1) {
      const rect = rectangles[pinchedRectIndexRef.current];
      const dropZoneLine = canvasCtx.current!.canvas.width / 2;
      const isLeftHand = expectedHand === "Left";
      const success = (isLeftHand && rect.x > dropZoneLine) || (!isLeftHand && rect.x < dropZoneLine);

      if (success) {
        setWins(prev => prev + 1);
        rect.hasBeenPlaced = true;
      } else {
        repositionRectangle(pinchedRectIndexRef.current, expectedHand);
      }

      rect.isPinched = false;
      const updatedRectangles = [...rectangles];
      updatedRectangles[pinchedRectIndexRef.current] = rect;
      setRectangles(updatedRectangles);
      setPinchedRectIndex(-1);
    }
  };
  
  //Main function that loops during gameplay
  const predictWebcam = async () => {
    const ctx = canvasCtx.current;
    if (!webcamVideoRef.current || !handLandmarker.current || !ctx || sessionFinishedRef.current) return;

    setupCanvas(ctx);

    const results = await handLandmarker.current.detectForVideo(webcamVideoRef.current, performance.now());
    const expectedHand = selectedHand === "Left" ? "Right" : "Left";
    const handIndex = detectHand(results, expectedHand);

    setHandId(handIndex);
    handVisibleRef.current = results.handedness.length > 0 && handIndex !== -1 && gameStarted;

    drawDropZoneLine(ctx);
    rectangles.forEach(rect => rect.draw(ctx));

    if (results.handedness.length > 0 && gameStarted && handIndex !== -1) {
      const landmarks = results.landmarks[handIndex];
      drawLandmarks_simple(ctx, landmarks, 'rgb(64, 224, 208)');
      handlePinchDetection(landmarks[4], landmarks[8], ctx, expectedHand);
    }

    ctx.restore();
    requestAnimationFrame(predictWebcam);
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
      {(gameTimeUp || gameWon) && (
        <div className="popup-overlay">
          <div className="popup-container">
            <h2 className="popup-title-text">
                {gameWon ? "🎉 You Won!" : "⏰ Time's Up!"}
                
                
            </h2>
            <div style={{ textAlign: 'center', margin: '20px 0', color: 'black' }}>
              <p style={{ fontSize: '18px', margin: '10px 0' }}>
              Blocks Moved: {rectangles.filter(rect => rect.hasBeenPlaced).length} / {rectangles.length}
              </p>
              <p style={{ fontSize: '18px', margin: '10px 0' }}>
              Score - Wins: {wins} | Misses: {misses}
              </p>
            </div>
            
            <button
              className="popup-button"
              onClick={() => {
                // Reset game states
                setGameTimeUp(false);
                setGameWon(false);
                setShowIntroPopup(true);

                // Reset pinching-related states and refs
                setIsPinched(false);
                setShouldMoveRect(false);
                setPinchedRectIndex(-1);
                isPinchedRef.current = false;
                shouldMoveRectRef.current = false;
                pinchedRectIndexRef.current = -1;

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
          </div>
        </div>
      )}

      {/* Full-screen overlay */}
      <div className="screen-cover"></div>

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
                border: handVisibleRef.current ? '2px solid green' : '2px solid red'
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