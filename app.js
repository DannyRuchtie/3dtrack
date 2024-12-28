// Configuration
const CONFIG = {
    FACE_CASCADE_URL: 'haarcascade_frontalface_default.xml',
    SPLINE_RUNTIME_VERSION: '1.9.54',
    DEFAULT_SCENE_URL: 'https://prod.spline.design/3pAzXsubpMgrqCEh/scene.splinecode',
    CAMERA_ID: '56c30b36-44df-48b7-89f1-27070018dad0'
};

// Default parameters
const params = {
    xSensitivity: 5,
    ySensitivity: 5,
    zSensitivity: 5,
    confidenceThreshold: 0.1,
    sceneUrl: CONFIG.DEFAULT_SCENE_URL
};

// Global variables
let video, outputCanvas, outputCtx, classifier;
let gui, guiVisible = true;
let faceInfo = { normalizedX: 0, normalizedY: 0, faceSize: 0, cameraX: 0, cameraY: 0, cameraZ: 0 };

// Initialize GUI
function initGUI() {
    gui = new dat.GUI();
    const cameraFolder = gui.addFolder('Camera Controls');
    cameraFolder.add(params, 'xSensitivity', 0, 10, 0.1).name('Camera Position X');
    cameraFolder.add(params, 'ySensitivity', 0, 10, 0.1).name('Camera Position Y');
    cameraFolder.add(params, 'zSensitivity', 0, 10, 0.1).name('Camera Zoom');
    cameraFolder.add(params, 'confidenceThreshold', 0, 0.5, 0.01).name('Movement Smoothing');
    cameraFolder.open();

    const sceneFolder = gui.addFolder('Scene');
    sceneFolder.add(params, 'sceneUrl').name('Scene URL');
    sceneFolder.add({ loadScene: () => loadSplineScene(params.sceneUrl) }, 'loadScene').name('Load Scene');
}

// Initialize Spline
async function initSpline() {
    try {
        const canvas = document.getElementById('canvas3d');
        const app = new Application(canvas, {
            controls: false,
            autoRender: true,
            autoResize: true
        });
        window.splineApp = app;
        
        await loadSplineScene(params.sceneUrl);
        return true;
    } catch (error) {
        console.error('Error loading Spline scene:', error);
        return false;
    }
}

// Load Spline Scene
async function loadSplineScene(sceneUrl) {
    try {
        await window.splineApp.load(sceneUrl);
        
        // Get camera by ID
        window.splineCamera = window.splineApp.findObjectById(CONFIG.CAMERA_ID);
        if (window.splineCamera) {
            // Store initial camera position
            window.cameraBasePosition = {
                x: window.splineCamera.position.x,
                y: window.splineCamera.position.y,
                z: window.splineCamera.position.z
            };
            console.log('Initial camera position:', window.cameraBasePosition);

            // Disable camera controls
            if (window.splineCamera.controls) {
                window.splineCamera.controls.enabled = false;
            }
        } else {
            console.error('Could not find camera');
        }

        console.log('Available variables:', window.splineApp.getVariables());
        return true;
    } catch (error) {
        console.error('Error loading scene:', error);
        return false;
    }
}

// Load Face Detection Cascade
async function loadFaceCascade() {
    try {
        classifier = new cv.CascadeClassifier();
        const response = await fetch(CONFIG.FACE_CASCADE_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);
        cv.FS_createDataFile('/', CONFIG.FACE_CASCADE_URL, data, true, false, false);
        classifier.load(CONFIG.FACE_CASCADE_URL);
    } catch (error) {
        console.error('Error loading face cascade:', error);
        throw error;
    }
}

// Toggle Overlays
function toggleOverlays() {
    const videoOverlay = document.getElementById('video-overlay');
    const debugOverlay = document.getElementById('debug-overlay');
    videoOverlay.style.display = videoOverlay.style.display === 'none' ? 'block' : 'none';
    debugOverlay.style.display = debugOverlay.style.display === 'none' ? 'block' : 'none';
}

// Initialize Application
async function initializeApp() {
    try {
        video = document.getElementById('videoFeed');
        outputCanvas = document.getElementById('outputCanvas');
        outputCtx = outputCanvas.getContext('2d');

        // Wait for OpenCV
        await new Promise((resolve) => {
            const checkOpenCV = () => {
                if (typeof cv !== 'undefined' && cv.CascadeClassifier) resolve();
                else setTimeout(checkOpenCV, 100);
            };
            checkOpenCV();
        });

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });
        video.srcObject = stream;
        await video.play();

        outputCanvas.width = video.videoWidth;
        outputCanvas.height = video.videoHeight;

        console.log('Video started successfully');

        await loadFaceCascade();
        await initSpline();
        initGUI();
        processFrame();

        // Setup keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 'v') {
                toggleOverlays();
                guiVisible = !guiVisible;
                gui.domElement.style.display = guiVisible ? 'block' : 'none';
            }
        });
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Start initialization when OpenCV is ready
function onOpenCvReady() {
    initializeApp();
} 