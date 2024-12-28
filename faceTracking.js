// Face tracking and camera update logic
function processFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
            outputCtx.drawImage(video, 0, 0, outputCanvas.width, outputCanvas.height);
            let src = cv.imread(outputCanvas);
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            if (classifier && !classifier.empty()) {
                const faces = new cv.RectVector();
                classifier.detectMultiScale(gray, faces, 1.1, 5, 0, new cv.Size(100, 100), new cv.Size(0,0));

                if (faces.size() > 0) {
                    let largestFace = faces.get(0);
                    let largestArea = largestFace.width * largestFace.height;

                    // Find largest face
                    for (let i = 1; i < faces.size(); i++) {
                        const face = faces.get(i);
                        const area = face.width * face.height;
                        if (area > largestArea) {
                            largestFace = face;
                            largestArea = area;
                        }
                    }

                    // Draw face rectangle
                    let point1 = new cv.Point(largestFace.x, largestFace.y);
                    let point2 = new cv.Point(largestFace.x + largestFace.width, largestFace.y + largestFace.height);
                    cv.rectangle(src, point1, point2, [255, 255, 255, 255], 2);

                    // Calculate face position and size
                    const centerX = largestFace.x + largestFace.width / 2;
                    const centerY = largestFace.y + largestFace.height / 2;
                    const faceSize = largestFace.width / outputCanvas.width;

                    const normalizedX = (centerX / outputCanvas.width) * 2 - 1;
                    const normalizedY = (centerY / outputCanvas.height) * 2 - 1;

                    updateCamera(normalizedX, normalizedY, faceSize);
                } else {
                    document.getElementById('debug-overlay').innerHTML = 'No face detected';
                }

                faces.delete();
            }

            cv.imshow(outputCanvas, src);
            src.delete();
            gray.delete();
        } catch (err) {
            console.error('Error in processFrame:', err);
        }

        requestAnimationFrame(processFrame);
    }
}

// Update camera based on face position
function updateCamera(normalizedX, normalizedY, faceSize) {
    if (window.splineApp && window.splineCamera) {
        try {
            // Get base position from stored values
            const baseX = window.cameraBasePosition.x;
            const baseY = window.cameraBasePosition.y;
            const baseZ = window.cameraBasePosition.z;

            // Calculate new positions with GUI-controlled sensitivity
            const sensitivityX = 100 * params.xSensitivity;
            const sensitivityY = 100 * params.ySensitivity;
            const sensitivityZ = 400 * params.zSensitivity;

            const newX = baseX + (-normalizedX * sensitivityX);
            const newY = baseY + (-normalizedY * sensitivityY);
            
            // Check camera type
            const isOrthographic = window.splineCamera.type === 'OrthographicCamera';
            const lerpFactor = params.confidenceThreshold;

            // Handle zoom/depth based on face size
            const neutralFaceSize = 0.25;
            const zOffset = (faceSize - neutralFaceSize) * sensitivityZ;
            let currentZoom = window.splineCamera.zoom || 1;

            if (isOrthographic) {
                // Store initial zoom if not already stored
                if (!window.cameraBaseZoom) {
                    window.cameraBaseZoom = currentZoom;
                }
                
                // Calculate new zoom
                const zoomChange = zOffset / 1000;
                const targetZoom = window.cameraBaseZoom * (1 - zoomChange);
                const clampedZoom = Math.max(0.5, Math.min(2, targetZoom));
                
                // Smoothly interpolate zoom
                window.splineCamera.zoom = currentZoom + (clampedZoom - currentZoom) * lerpFactor;
            }

            // Update position with interpolation
            window.splineCamera.position.x += (newX - window.splineCamera.position.x) * lerpFactor;
            window.splineCamera.position.y += (newY - window.splineCamera.position.y) * lerpFactor;

            // Force render update
            window.splineApp.render();

            // Update debug overlay
            updateDebugOverlay(normalizedX, normalizedY, faceSize, isOrthographic);
        } catch (err) {
            console.error('Error updating camera:', err.message);
        }
    }
}

// Update debug overlay
function updateDebugOverlay(normalizedX, normalizedY, faceSize, isOrthographic) {
    try {
        const debugOverlay = document.getElementById('debug-overlay');
        if (!debugOverlay || !window.splineCamera) return;

        const cameraPos = window.splineCamera.position || { x: 0, y: 0, z: 0 };
        const cameraZoom = window.splineCamera.zoom || 1;

        debugOverlay.innerHTML = `
            Face Tracking Info:<br>
            X: ${normalizedX.toFixed(2)}<br>
            Y: ${normalizedY.toFixed(2)}<br>
            Size: ${faceSize.toFixed(2)}<br>
            <br>
            Camera Info:<br>
            Type: ${isOrthographic ? 'Orthographic' : 'Perspective'}<br>
            X: ${cameraPos.x.toFixed(2)}<br>
            Y: ${cameraPos.y.toFixed(2)}<br>
            Zoom: ${cameraZoom.toFixed(2)}<br>
            <br>
            Scene Info:<br>
            Camera ID: ${window.splineCamera.id}
        `;
    } catch (err) {
        console.error('Error updating debug overlay:', err);
    }
} 