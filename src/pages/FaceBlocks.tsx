import { useRef, useState, useEffect, } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { HandLandmarker, FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';


// Import external functions
import { applyGlowEffect, getGlowColor, calculateMean, generateSessionId } from '../utils/utils';
import { checkNavigatorAgent, checkWebGLAvailability } from '../utils/checks';
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


const PoseLandmarkNames: Record<number, string> = {
    0: "Nose",
    1: "Left Eye",         
    5: "Right Eye",        
    7: "Left Ear",         
    8: "Right Ear",        
    9: "Mouth",       
    11: "Left Shoulder",   
    12: "Right Shoulder",  
    100: "Chest",
    101: "Forehead",
    102: "Chin",
    103: "Neck"
};

// Rectangle class to manage the blocks
class Rectangle {
    x: number;
    y: number;
    w: number;
    h: number;
    isPinched: boolean = false;
    hasBeenPlaced: boolean = false;
    canBePinched: boolean = false;
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
    const { cameraSettings, loading: cameraSettingsLoading } = useCamera();
    const [cameraSettingsLoaded, setCameraSettingsLoaded] = useState(false);

    // Import user settings
    const { userSettings, loading: userSettingsLoading } = useUser();
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
    const handSizeCMRef = useRef<number | null>(null);  // Ref to manage hand size in centimeters
    const [selectedHand, setSelectedHand] = useState<string>('Left'); // Ref to manage selected hand
    const selectedHandRef = useRef(selectedHand); // Ref to manage selected hand
    useEffect(() => { selectedHandRef.current = selectedHand; }, [selectedHand]); // Keep track of selectedHand changes
    const [selectedFingertips, setSelectedFingertips] = useState<string>('fingertips'); // State to manage selected fingertips
    const selectedFingertipsRef = useRef(selectedFingertips);
    useEffect(() => { selectedFingertipsRef.current = selectedFingertips; }, [selectedFingertips]);

    const poseLandmarker = useRef<PoseLandmarker | null>(null); // Ref to manage the body landmarker model

    // UI-related states
    const [showIntroPopup, setShowIntroPopup] = useState(true);
    const [isWebGLAvailable, setWebGLAvailable] = useState<boolean>(true);
    
    const [shouldResetPage, setShouldResetPage] = useState<boolean>(false); // State to manage page reset
    const webcamError = useRef<boolean>(false); // Ref to manage webcam error state
    useEffect(() => {
        if (webcamError.current) {
            alert("📷❌ Error accessing webcam. Please reload this page.");
            setShouldResetPage(true);
        }
    }, [webcamError.current]);

    // Assessment Game States
    // Need to make this based on person
    const chestOffset = 40; // Offset for the chest rectangle
    const chinOffset = 45; // Offset for the chin rectangle
    const foreheadOffset = -20; // Offset for the forehead rectangle
    const neckOffset = 0; // Offset for the neck rectangle

    const [gameStarted, setGameStarted] = useState(false);
    const [rectangles, setRectangles] = useState<Record<number, Rectangle>>({});
    const rectanglesRef = useRef<Record<number, Rectangle>>({}); // Ref to manage rectangles
    useEffect(() => {
        rectanglesRef.current = rectangles;
    }, [rectangles]);

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

    const [nextTarget,setNextTarget] = useState<number>(0); // State to manage the next target rectangle indexq
    const nextTargetRef = useRef(nextTarget);
    useEffect(() => {
        nextTargetRef.current = nextTarget;
    }, [nextTarget]);

    //Timer-related states
    const [timeLeft, setTimeLeft] = useState(30); // 30 seconds
    const lastLandmarksRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
    const lastVisibleRef = useRef<boolean>(false);

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
    const animationFrameIdRef = useRef<number | undefined>(undefined);
    let lastDetect = 0;
    const detectInterval = 1000 / 30; // ms
    const poseDetectInterval = 50; // run pose detection every 50ms
    const poseLastDetectRef = useRef<number>(0);
    const lastPoseResultsRef = useRef<{ landmarks?: Array<Array<{ x: number; y: number; z: number }>> } | null>(null);

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
            } else {
                console.error('❌📜 CanvasRef element not found');
                setCanvasRunning(false);
            }
        };

        // Check for WebGL availability, and it not available show a popup
        setWebGLAvailable(checkWebGLAvailability(document.createElement("canvas")));
        // Create the hand & pose landmarker
        createHandLandmarker();
        createPoseLandmarker();
        // Add event listener to resize the canvas on window resize
        window.addEventListener('resize', resizeCanvas);
        // Initialize the canvasCtx if canvasRef exists
        initializeCanvas();

        return () => {
            window.removeEventListener('resize', resizeCanvas); // Clean up the event listener when the component unmounts
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
        if (!webcamRunning) { return }

        console.log("✅📝 webcamRunning is true");

        const video = webcamVideoRef.current;
        const ctx = canvasCtx.current;
        const canvas = canvasRef.current;

        // Check if required video elements exist
        if (!video) { console.error("❌ - webcamVideoRef is null or undefined"); return; }
        if (!video.srcObject) { console.error("❌ No video stream attached to video element."); return; }
        if (video.readyState < 4) { console.error("❌ Video is not ready for hand tracking (readyState < 4)."); return; }
        if (video.videoWidth === 0 || video.videoHeight === 0) { console.error("❌ Video dimensions are 0 (width or height)."); return; }
        console.log("📝 Video dimensions are AVAILABLE, and not 0");

        // Check if hand landmarker exists
        if (!handLandmarker) { console.error("❌ - handLandmarker is not initialized"); return; }
        console.log("📝 Hand Landmark Model is AVAILABLE.");

        if (!poseLandmarker) { console.error("❌ - poseLandmarker is not initialized"); return; }
        console.log("📝 Pose Landmark Model is AVAILABLE.");
        // Check if canvas and context exist
        if (!canvas || !ctx) { console.error("❌ - canvas or canvasCtx is null or undefined"); return; }
        console.log("📝 Canvas is AVAILABLE.");

        // Set initial canvas size
        resizeCanvas();

        if (userSettingsLoaded && !showIntroPopup) {
            console.log("🚀🖐🏻 Starting hand prediction with predictWebcam()");
            predictWebcam();
        }
    }, [webcamRunning, handLandmarker, poseLandmarker, showIntroPopup]);

    // Start prediction of hand landmarks when session is finished
    useEffect(() => {
        console.log('🏁 Finished the session', sessionFinished);
        sessionFinishedRef.current = sessionFinished;
        if (sessionFinishedRef.current && canvasCtx.current) {
            canvasCtx.current.clearRect(0, 0, canvasCtx.current.canvas.width, canvasCtx.current.canvas.height);
        }
        predictWebcam(); // Restart the prediction loop
    }, [sessionFinished]);

    // Reset session results when starting a new session
    useEffect(() => {
        if (startNewSession === true) {
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
        setTimeLeft(30); // Reset timer
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
        const newRects: Record<number, Rectangle> = {};

        const blockWidth = 30;
        const blockHeight = 30;
        const canvas = canvasRef.current;
        if (!canvas || !poseLandmarker.current) return;

        // Choose landmark indices based on selected hand
        let landmarkIndices = [
            11, // leftShoulder
            12, // rightShoulder
            7,  // leftEar
            8,  // rightEar
            1,  // leftEye
            5,  // rightEye
            0,  // nose
            9,  // mouthLeft
            100,    // Chest
            101,    // Forehead
            102,    // Chin
            103    // Neck
        ];

        if (hand === 'Right') {
            // Remove rightShoulder (12) and rightElbow (14)
            landmarkIndices = landmarkIndices.filter(idx => idx !== 12 && idx !== 14);
        } else if (hand === 'Left') {
            // Remove leftShoulder (11) and leftElbow (13)
            landmarkIndices = landmarkIndices.filter(idx => idx !== 11 && idx !== 13);
        }
        setNextTarget(landmarkIndices[Math.floor(Math.random() * landmarkIndices.length)]);
        
        // Async function to generate rectangles at specific pose landmark indices
        (async () => {
            const poseLandmarks = await getPoseLandmarks();
            if (!poseLandmarks || poseLandmarks.length === 0) {
                setRectangles([]);
                return;
            }
            console.log('🟦 Pose landmarks:', poseLandmarks.length);

            // For each specified landmark index, create a rectangle centered on it
            for (let i = 0; i < landmarkIndices.length; i++) {
                const idx = landmarkIndices[i];
                // For mouth, average the two mouth points (indices 9 and 10)
                switch (idx) {
                    case 9: { // Mouth: average mouthLeft (9) and mouthRight (10)
                        const mouthLeft = poseLandmarks[9];
                        const mouthRight = poseLandmarks[10];
                        if (mouthLeft && mouthRight) {
                            const avgX = (mouthLeft.x + mouthRight.x) / 2;
                            const avgY = (mouthLeft.y + mouthRight.y) / 2;
                            const x = (1 - avgX) * canvas.width - blockWidth / 2;
                            const y = avgY * canvas.height - blockHeight / 2 + 10;
                            newRects[idx] = new Rectangle(x, y, blockWidth, blockHeight);
                        }
                        continue; // Skip to next index
                    }
                    case 100: {// Chest
                        const rightShoulder = poseLandmarks[12];
                        const leftShoulder = poseLandmarks[11];
                        if (rightShoulder && leftShoulder) {
                            const avgX = (rightShoulder.x + leftShoulder.x) / 2;
                            const avgY = (rightShoulder.y + leftShoulder.y) / 2;
                            const x = (1 - avgX) * canvas.width - blockWidth / 2;
                            const y = avgY * canvas.height - blockHeight / 2;
                            newRects[idx] = new Rectangle(x, y + chestOffset, blockWidth, blockHeight);
                        }
                        continue;
                    }
                    case 101: {// Forehead
                        const rightEye = poseLandmarks[5];
                        const leftEye = poseLandmarks[1];
                        if (rightEye && leftEye) {
                            const avgX = (rightEye.x + leftEye.x) / 2;
                            const avgY = (rightEye.y + leftEye.y) / 2;
                            const x = (1 - avgX) * canvas.width - blockWidth / 2;
                            const y = avgY * canvas.height - blockHeight / 2;
                            newRects[idx] = new Rectangle(x, y + foreheadOffset, blockWidth, blockHeight);
                        }
                        continue; 
                    }
                    case 102: {// Chin
                        const nose = poseLandmarks[0];
                        if (nose) {
                            const x = (1 - nose.x) * canvas.width - blockWidth / 2;
                            const y = nose.y * canvas.height - blockHeight / 2;
                            newRects[idx] = new Rectangle(x, y + chinOffset, blockWidth, blockHeight);
                        }
                        continue;
                    }
                    case 103: {// Neck
                        const leftShoulder = poseLandmarks[11];
                        const rightShoulder = poseLandmarks[12];
                        if (leftShoulder && rightShoulder) {
                            const avgX = (leftShoulder.x + rightShoulder.x) / 2;
                            const avgY = (leftShoulder.y + rightShoulder.y) / 2;
                            const x = (1 - avgX) * canvas.width - blockWidth / 2;
                            const y = avgY * canvas.height - blockHeight / 2;
                            newRects[idx] = new Rectangle(x, y + neckOffset, blockWidth, blockHeight);
                        }
                        // These landmarks are not used in the game, so skip them
                        continue;
                    }
                    default:
                        break;
                }
                const lm = poseLandmarks[idx];
                if (!lm) continue;
                // Mirror X for canvas (to match mirrored video/canvas)
                const x = (1 - lm.x) * canvas.width - blockWidth / 2;
                const y = lm.y * canvas.height - blockHeight / 2;
                newRects[idx] = new Rectangle(x, y, blockWidth, blockHeight);
            }

            setRectangles(newRects);
        })();
        console.log('🟦 Rectangles generated:', Object.keys(newRects).length);
        if(Object.keys(newRects).length === 0) {
            webcamError.current = true; // Set webcam error state if no rectangles are generated
        }
    };

    // Get pose landmarks from the latest pose detection
    // We'll run pose detection on the current video frame
    const getPoseLandmarks = async () => {
        if (!webcamVideoRef.current) return [];
        // Use IMAGE mode detect to avoid timestamp mismatch
        const results = await poseLandmarker.current!.detect(webcamVideoRef.current);
        if (results && results.landmarks && results.landmarks.length > 0) {
            // Use the first detected pose
            return results.landmarks[0];
        }
        return [];
    };
    useEffect(() => {
        if (gameStarted && rectanglesRef.current.length > 0) {
            const placedBlocks = rectanglesRef.current.filter(rect => rect.hasBeenPlaced).length;
            if (placedBlocks === rectanglesRef.current.length) {
                setGameWon(true);
                setGameStarted(false);
            }
        }
    }, [rectanglesRef.current, gameStarted]);

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
    const createPoseLandmarker = async () => {
        if (poseLandmarker.current) return; // Prevent re-creating if already exists
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const pose = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                delegate: "GPU",
            },
            runningMode: "IMAGE",
            numPoses: 2,
        });
        poseLandmarker.current = pose;
        console.log("🦵🏻Pose landmarker created", pose);
    }
    // Function to resize the canvas based on the webcam video dimensions
    const resizeCanvas = () => {
        console.log('📜Canvas resize called');
        // Check if webcam video and canvas references are available
        if (webcamVideoRef.current && canvasRef.current && canvasCtx.current) {
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
        const rect = rectanglesRef.current[index];
        if (rect === undefined || rect.hasBeenPlaced) {
            return;
        }

        rect.x = x - rect.w / 2; // Center the rectangle on the new coordinates
        rect.y = y - rect.h / 2;

        setRectangles(prev => {
            const updated = { ...prev };
            updated[index] = rect;
            return updated;
        });
    };

    // Function to setup the canvas before drawing
    const setupCanvas = (ctx: CanvasRenderingContext2D) => {
        ctx.save();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    };

    // Draw the drop zone line for the specified hand
    const drawDropZoneLine = (ctx: CanvasRenderingContext2D, hand: string) => {
        const dropZoneLine = hand === 'Left' ? ctx.canvas.width / 4 : (ctx.canvas.width * 3) / 4;
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(dropZoneLine, 0);
        ctx.lineTo(dropZoneLine, ctx.canvas.height);
        ctx.stroke();
    };
    
    const drawPoseLandmarks = (ctx: CanvasRenderingContext2D) => {
        const poseLandmarks = lastPoseResultsRef.current.landmarks[0];
            // Draw only the landmarks defined in PoseLandmarkNames
        Object.keys(rectanglesRef.current).forEach(key => {
            const idx = Number(key);
            const lm = poseLandmarks[idx];
            if (!lm) return;
            const x = (1 - lm.x) * ctx.canvas.width;
            const y = lm.y * ctx.canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = idx === nextTargetRef.current ? 'yellow' : 'cyan';
            ctx.globalAlpha = 0.8;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
            // optional label for clarity
            ctx.fillStyle = 'white';
            ctx.font = '12px sans-serif';
            ctx.fillText(PoseLandmarkNames[idx], x + 8, y - 4);
        });
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

    // Function to handle pinch detection logic
    const handlePinchDetection = (
        thumbTip: { x: number; y: number; z: number },
        indexTip: { x: number; y: number; z: number },
        ctx: CanvasRenderingContext2D
    ) => {
        //The threshold that should trigger pinch detection (2D normalized units)
        const pinchThreshold2D = 0.05;

        // Depth threshold: require fingers to be close in Z (model units)
        // Tune this value to your setup; larger = stricter depth requirement
        const pinchZThreshold = -0.011;

        // Mirror the X coordinate for pinch center (to match mirrored video/canvas)
        const pinchCenterX = (1 - ((thumbTip.x + indexTip.x) / 2)) * ctx.canvas.width;
        const pinchCenterY = ((thumbTip.y + indexTip.y) / 2) * ctx.canvas.height;

        const distance2D = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        setDistance(distance2D);

        if (shouldMoveRectRef.current && isPinchedRef.current && pinchedRectIndexRef.current !== -1) {
            moveRectangle(pinchedRectIndexRef.current, pinchCenterX, pinchCenterY);
        }

        const fingersClose2D = distance2D < pinchThreshold2D;
        const fingersCloseZ = indexTip.z - thumbTip.z > pinchZThreshold;
        const isNowPinched = fingersClose2D && fingersCloseZ;

        if (isNowPinched && !isPinchedRef.current) {
            handlePinchStart(pinchCenterX, pinchCenterY);
        } else if (!isNowPinched && isPinchedRef.current) {
            const release2DThreshold = pinchThreshold2D + 0.03;
            const releaseZThreshold = pinchZThreshold - 0.01;
            const shouldRelease = distance2D > release2DThreshold || indexTip.z - thumbTip.z < releaseZThreshold;
            if (shouldRelease) {
                handlePinchRelease();
            }
        }
    };

    // Function to handle pinch start logic
    const handlePinchStart = (pinchCenterX: number, pinchCenterY: number) => {
        // Prevent pinch logic if the game is already won
        if (gameWonRef.current || gameTimeUpRef.current) return;

        setIsPinched(true);

        const idx = nextTargetRef.current;
        const rect = rectanglesRef.current[idx];
        if (rect && !rect.hasBeenPlaced && rect.contains({ x: pinchCenterX, y: pinchCenterY })) {
            setPinchedRectIndex(idx);
            rect.isPinched = true;
            setRectangles(prev => ({ ...prev, [idx]: rect }));
            setShouldMoveRect(true);
            return;
        }

        // If no rectangle was found, increment misses and reset pinchedRectIndex
        setMisses(prev => prev + 1);
        setPinchedRectIndex(-1);
    };

    // Function to handle pinch release logic
    const handlePinchRelease = () => {
        setIsPinched(false);
        setShouldMoveRect(false);

        // If a rectangle was pinched, check if it was successfully placed
        if (pinchedRectIndexRef.current !== -1) {
            // Use the latest rectangles record for the pinched rectangle
            const updatedRectangles = { ...rectanglesRef.current };
            const rect = updatedRectangles[pinchedRectIndexRef.current];
            if (!rect) return;
            const dropZoneLine = selectedHandRef.current === 'Right' ? (canvasCtx.current!.canvas.width * 3) / 4 : canvasCtx.current!.canvas.width / 4;
            const isLeftHand = selectedHandRef.current === 'Left';
            const success = (isLeftHand && rect.x <= dropZoneLine) || (!isLeftHand && rect.x >= dropZoneLine);

            if (success) {
                setWins(prev => prev + 1);
                rect.hasBeenPlaced = true;
                
                // Pick a new nextTarget from the remaining unplaced rectangles
                const unplaced = Object.keys(updatedRectangles)
                    .map(Number)
                    .filter(idx => !updatedRectangles[idx].hasBeenPlaced && idx !== pinchedRectIndexRef.current);
                if (unplaced.length > 0) {
                    const newTarget = unplaced[Math.floor(Math.random() * unplaced.length)];
                    setNextTarget(newTarget);
                }
                else{
                    setGameWon(true);
                    setGameStarted(false);
                }
            }

            rect.isPinched = false;
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

        // clear screen
        setupCanvas(ctx);

        // only run expensive detection at throttle interval
        let results: HandDetectionResults | undefined;
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
        
        // Run pose detection at a throttled interval
        if (gameStarted && poseLandmarker.current && webcamVideoRef.current && now - poseLastDetectRef.current > poseDetectInterval) {
            poseLastDetectRef.current = now;
            const videoEl = webcamVideoRef.current;
            // guard against zero-size ROI
            if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
                const poseResults = await poseLandmarker.current.detect(videoEl);
                if (poseResults && poseResults.landmarks && poseResults.landmarks.length > 0) {
                    lastPoseResultsRef.current = poseResults;
                }
            }
        }

        // Draw using ctx over the video based on the hand chosen
        // Draw a blank cover over the entire video
        ctx.save();
        if (selectedHandRef.current === 'Right') {
            ctx.fillStyle = "rgba(250, 234, 220, 1)";
            ctx.fillRect(0, 0, ctx.canvas.width * 0.75, ctx.canvas.height);
        } else {
            ctx.fillStyle = "rgba(250, 234, 220, 1)";
            ctx.fillRect(ctx.canvas.width * 0.25, 0, ctx.canvas.width * 0.75, ctx.canvas.height);
        }
        ctx.restore();
         
        // Before drawing the rectangles, update their position based on the latest pose landmarks
        if (lastPoseResultsRef.current && lastPoseResultsRef.current.landmarks && lastPoseResultsRef.current.landmarks.length > 0) {
            //drawPoseLandmarks(ctx);
            const poseLandmarks = lastPoseResultsRef.current.landmarks[0];
            setRectangles(prevRects => {
                const updatedRects: Record<number, Rectangle> = { ...prevRects };
                Object.entries(updatedRects).forEach(([idxStr, rect]) => {
                    const idx = Number(idxStr);
                    const size = 40;
                    // Only update rectangles that have NOT been placed
                    if (!rect.hasBeenPlaced && !shouldMoveRectRef.current && pinchedRectIndexRef.current !== idx) {                         
                        // For mouth (index 9), average mouthLeft (9) and mouthRight (10)
                        switch (idx) {
                            case 9: // Mouth: average mouthLeft (9) and mouthRight (10)
                                if (poseLandmarks[9] && poseLandmarks[10]) {
                                    const avgX = (poseLandmarks[9].x + poseLandmarks[10].x) / 2;
                                    const avgY = (poseLandmarks[9].y + poseLandmarks[10].y) / 2;
                                    updatedRects[idx] = new Rectangle(
                                        (1 - avgX) * ctx.canvas.width - size / 2,
                                        avgY * ctx.canvas.height - size / 2 + 10,
                                        size,
                                        size
                                    );
                                    updatedRects[idx].isPinched = rect.isPinched;
                                    updatedRects[idx].hasBeenPlaced = rect.hasBeenPlaced;
                                    updatedRects[idx].color = rect.color;
                                }
                                break;
                            case 100: // Chest: average leftShoulder (11) and rightShoulder (12)
                                if (poseLandmarks[11] && poseLandmarks[12]) {
                                    const avgX = (poseLandmarks[11].x + poseLandmarks[12].x) / 2;
                                    const avgY = (poseLandmarks[11].y + poseLandmarks[12].y) / 2;
                                    updatedRects[idx] = new Rectangle(
                                        (1 - avgX) * ctx.canvas.width - size / 2,
                                        avgY * ctx.canvas.height - size / 2 + chestOffset,
                                        size,
                                        size
                                    );
                                    updatedRects[idx].isPinched = rect.isPinched;
                                    updatedRects[idx].hasBeenPlaced = rect.hasBeenPlaced;
                                    updatedRects[idx].color = rect.color;
                                }
                                break;
                            case 101: // Forehead: average leftEye (1) and rightEye (5)
                                if (poseLandmarks[1] && poseLandmarks[5]) {
                                    const avgX = (poseLandmarks[1].x + poseLandmarks[5].x) / 2;
                                    const avgY = (poseLandmarks[1].y + poseLandmarks[5].y) / 2;
                                    updatedRects[idx] = new Rectangle(
                                        (1 - avgX) * ctx.canvas.width - size / 2,
                                        avgY * ctx.canvas.height - size / 2 + foreheadOffset,
                                        size,
                                        size
                                    );
                                    updatedRects[idx].isPinched = rect.isPinched;
                                    updatedRects[idx].hasBeenPlaced = rect.hasBeenPlaced;
                                    updatedRects[idx].color = rect.color;
                                }
                                break;
                            case 102: // Chin: offset from nose (0)
                                if (poseLandmarks[0]) {
                                    updatedRects[idx] = new Rectangle(
                                        (1 - poseLandmarks[0].x) * ctx.canvas.width - size / 2,
                                        poseLandmarks[0].y * ctx.canvas.height - size / 2 + chinOffset,
                                        size,
                                        size
                                    );
                                    updatedRects[idx].isPinched = rect.isPinched;
                                    updatedRects[idx].hasBeenPlaced = rect.hasBeenPlaced;
                                    updatedRects[idx].color = rect.color;
                                }
                                break;
                            case 103: // Neck: average leftShoulder (11) and rightShoulder (12)
                                if (poseLandmarks[11] && poseLandmarks[12]) {
                                    const avgX = (poseLandmarks[11].x + poseLandmarks[12].x) / 2;
                                    const avgY = (poseLandmarks[11].y + poseLandmarks[12].y) / 2;
                                    updatedRects[idx] = new Rectangle(
                                        (1 - avgX) * ctx.canvas.width - size / 2,
                                        avgY * ctx.canvas.height - size / 2 + neckOffset,
                                        size,
                                        size
                                    );
                                    updatedRects[idx].isPinched = rect.isPinched;
                                    updatedRects[idx].hasBeenPlaced = rect.hasBeenPlaced;
                                    updatedRects[idx].color = rect.color;
                                }
                                break;
                            default:
                                if (poseLandmarks[idx]) {
                                    updatedRects[idx] = new Rectangle(
                                        (1 - poseLandmarks[idx].x) * ctx.canvas.width - size / 2,
                                        poseLandmarks[idx].y * ctx.canvas.height - size / 2,
                                        size,
                                        size
                                    );
                                    updatedRects[idx].isPinched = rect.isPinched;
                                    updatedRects[idx].hasBeenPlaced = rect.hasBeenPlaced;
                                    updatedRects[idx].color = rect.color;
                                }
                                break;
                        }
                    }
                });
                return updatedRects;
            });
        }

        drawDropZoneLine(ctx, selectedHandRef.current);
        // draw the index and thumb landmarks if hand is visible
        if (lastVisibleRef.current && lastLandmarksRef.current.length > 0) {
            const landmarks = lastLandmarksRef.current;
            // Draw index finger (landmark 8)
            if (landmarks[8]) {
                ctx.beginPath();
                ctx.arc(
                    (1 - landmarks[8].x) * ctx.canvas.width,
                    landmarks[8].y * ctx.canvas.height,
                    12,
                    0,
                    2 * Math.PI
                );
                ctx.fillStyle = 'cyan';
                ctx.globalAlpha = 0.8;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            // Draw thumb (landmark 4)
            if (landmarks[4]) {
                ctx.beginPath();
                ctx.arc(
                    (1 - landmarks[4].x) * ctx.canvas.width,
                    landmarks[4].y * ctx.canvas.height,
                    12,
                    0,
                    2 * Math.PI
                );
                ctx.fillStyle = 'green';
                ctx.globalAlpha = 0.8;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        // Draw all of the placed rectangles

        Object.values(rectanglesRef.current).forEach(rect => {
            if (rect.hasBeenPlaced) {
                rect.draw(ctx);
            }
        });

        if (lastVisibleRef.current && !gameTimeUpRef.current && !gameWonRef.current) {
            // Only draw the rectangle that matches nextTarget
            const targetRect = rectanglesRef.current[nextTargetRef.current];
            if (targetRect && targetRect.isPinched) {
                targetRect.draw(ctx);
            }

            const lm = lastLandmarksRef.current;
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
                                {Object.values(rectanglesRef.current).filter(rect => rect.hasBeenPlaced).length} / {Object.keys(rectanglesRef.current).length}
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
                                // save the game time left to the session resultsRef
                                sessionResultsRef.current.push(timeLeft);
                                // update last task result and show results box
                                setTaskResult(timeLeft);
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
                    Wins: {wins} | Misses: {misses} | Next Target: {PoseLandmarkNames[nextTarget as keyof typeof PoseLandmarkNames] ?? nextTarget}  
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