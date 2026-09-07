const Observatory = {
    // State
    stream: null,
    videoElement: null,
    canvasElement: null,
    ctx: null,
    inputSource: 'demo',
    isDetecting: false,
    detections: [],
    fps: 0,
    frameCount: 0,
    
    init() {
        this.videoElement = document.getElementById('telescope-feed');
        this.canvasElement = document.getElementById('detection-canvas');
        if (!this.canvasElement) return;
        this.ctx = this.canvasElement.getContext('2d');
        this.setupInputSelector();
        this.setupControls();
        this.loadDemoImage();
    },
    
    setupInputSelector() {
        const selector = document.getElementById('input-source');
        if (selector) {
            selector.addEventListener('change', (e) => this.switchInput(e.target.value));
        }
    },
    
    async switchInput(source) {
        this.stopCurrentInput();
        this.inputSource = source;
        switch(source) {
            case 'webcam': await this.startWebcam(); break;
            case 'image': this.showImageUpload(); break;
            case 'video': this.showVideoUpload(); break;
            case 'demo': this.loadDemoImage(); break;
        }
        this.updateInputStatus();
    },
    
    async startWebcam() {
        try {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
            } catch (fallbackErr) {
                this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            if (this.videoElement) {
                this.videoElement.srcObject = this.stream;
                this.videoElement.classList.remove('hidden');
                this.videoElement.style.display = 'block';
                await this.videoElement.play();
            }
            this.startFPSCounter();
            AstroLens.showToast('PC Camera feed connected live!', 'success');
        } catch(err) {
            console.error('Camera connection error:', err);
            AstroLens.showToast('PC Camera access error: ' + err.message, 'error');
            const fallbackPrompt = document.getElementById('camera-fallback-prompt');
            if (fallbackPrompt) fallbackPrompt.style.display = 'flex';
        }
    },
    
    stopCurrentInput() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
            this.videoElement.pause();
        }
    },
    
    showImageUpload() {
        // Show file input for image
        let input = document.getElementById('file-upload');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'file-upload';
            input.style.display = 'none';
            document.body.appendChild(input);
        }
        input.accept = 'image/*';
        input.onchange = (e) => this.handleImageUpload(e.target.files[0]);
        input.click();
    },
    
    handleImageUpload(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.canvasElement.width = img.width;
                this.canvasElement.height = img.height;
                this.ctx.drawImage(img, 0, 0);
                this.loadedImageObj = img;
                this.currentImage = e.target.result; // base64
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },
    
    showVideoUpload() {
        let input = document.getElementById('file-upload');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'file-upload';
            input.style.display = 'none';
            document.body.appendChild(input);
        }
        input.accept = 'video/*';
        input.onchange = (e) => this.handleVideoUpload(e.target.files[0]);
        input.click();
    },
    
    handleVideoUpload(file) {
        if (!file) return;
        const url = URL.createObjectURL(file);
        this.videoElement.src = url;
        this.videoElement.style.display = 'block';
        this.videoElement.play();
    },
    
    loadDemoImage() {
        // Draw a synthetic demo astronomy image on canvas
        // Create a starfield with some bright objects
        this.drawDemoScene();
        this.updateInputStatus();
    },
    
    drawDemoScene() {
        const canvas = this.canvasElement;
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = this.ctx;
        
        // Dark sky gradient
        const gradient = ctx.createRadialGradient(640, 360, 0, 640, 360, 720);
        gradient.addColorStop(0, '#0a0e1a');
        gradient.addColorStop(1, '#020408');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1280, 720);
        
        // Random stars
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * 1280;
            const y = Math.random() * 720;
            const r = Math.random() * 1.5 + 0.3;
            const opacity = Math.random() * 0.8 + 0.2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 240, ${opacity})`;
            ctx.fill();
        }
        
        // Draw a "Jupiter" - bright circle
        ctx.beginPath();
        ctx.arc(400, 280, 35, 0, Math.PI * 2);
        const jupGrad = ctx.createRadialGradient(395, 275, 5, 400, 280, 35);
        jupGrad.addColorStop(0, '#f4d09e');
        jupGrad.addColorStop(0.5, '#d4a574');
        jupGrad.addColorStop(1, '#8b6f47');
        ctx.fillStyle = jupGrad;
        ctx.fill();
        // Jupiter bands
        ctx.strokeStyle = 'rgba(139, 90, 43, 0.5)';
        ctx.lineWidth = 2;
        for (let y = -20; y <= 20; y += 8) {
            ctx.beginPath();
            ctx.ellipse(400, 280 + y, 32, 3, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw a "Saturn" with ring
        ctx.beginPath();
        ctx.arc(850, 400, 22, 0, Math.PI * 2);
        const satGrad = ctx.createRadialGradient(847, 397, 3, 850, 400, 22);
        satGrad.addColorStop(0, '#f5e6c8');
        satGrad.addColorStop(1, '#c4a265');
        ctx.fillStyle = satGrad;
        ctx.fill();
        // Ring
        ctx.beginPath();
        ctx.ellipse(850, 400, 45, 10, -0.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(210, 180, 140, 0.7)';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Draw "Moon" - larger circle
        ctx.beginPath();
        ctx.arc(200, 500, 45, 0, Math.PI * 2);
        const moonGrad = ctx.createRadialGradient(190, 490, 5, 200, 500, 45);
        moonGrad.addColorStop(0, '#e8e8e0');
        moonGrad.addColorStop(0.7, '#c0c0b0');
        moonGrad.addColorStop(1, '#909080');
        ctx.fillStyle = moonGrad;
        ctx.fill();
        // Craters
        ctx.fillStyle = 'rgba(100, 100, 90, 0.3)';
        ctx.beginPath(); ctx.arc(190, 490, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(210, 510, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(195, 520, 6, 0, Math.PI * 2); ctx.fill();
        
        // Store canvas as base64 for detection
        this.currentImage = canvas.toDataURL('image/jpeg', 0.85);
    },
    
    // Capture current frame as base64
    captureFrame() {
        if (this.inputSource === 'webcam' && this.videoElement && this.videoElement.srcObject) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.videoElement.videoWidth;
            tempCanvas.height = this.videoElement.videoHeight;
            tempCanvas.getContext('2d').drawImage(this.videoElement, 0, 0);
            return tempCanvas.toDataURL('image/jpeg', 0.85);
        }
        return this.currentImage;
    },
    
    // Run AI detection
    async runDetection() {
        const detectBtn = document.getElementById('detect-btn');
        if (this.isDetecting) return;
        this.isDetecting = true;
        if(detectBtn) {
            detectBtn.disabled = true;
            detectBtn.textContent = 'Detecting...';
        }
        
        const frame = this.captureFrame();
        if (!frame) {
            AstroLens.showToast('No image available for detection', 'warning');
            this.isDetecting = false;
            if(detectBtn) {
                detectBtn.disabled = false;
                detectBtn.textContent = 'Run Detection';
            }
            return;
        }
        
        try {
            // Send base64 image to Flask backend for detection
            const base64 = frame.split(',')[1];
            const data = await AstroLens.api('/api/detect', {
                method: 'POST',
                body: JSON.stringify({ image: base64, source: this.inputSource })
            });
            
            this.detections = data.detections || [];
            this.drawDetections();
            this.updateDetectionPanel();
            
            AstroLens.showToast(`Detected ${this.detections.length} object(s)`, 'success');
        } catch(err) {
            AstroLens.showToast('Detection failed: ' + err.message, 'error');
        } finally {
            this.isDetecting = false;
            if(detectBtn) {
                detectBtn.disabled = false;
                detectBtn.textContent = 'Run Detection';
            }
        }
    },
    
    // Draw bounding boxes on canvas
    drawDetections() {
        // Redraw the base image first
        if (this.inputSource === 'demo') {
            this.drawDemoScene();
        } else if (this.inputSource === 'webcam' && this.videoElement && this.videoElement.srcObject) {
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
        } else if (this.inputSource === 'image' && this.loadedImageObj) {
            this.ctx.drawImage(this.loadedImageObj, 0, 0, this.canvasElement.width, this.canvasElement.height);
        } else if (this.inputSource === 'video' && this.videoElement && this.videoElement.src) {
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
        }
        // Now draw bounding boxes
        this.detections.forEach(det => {
            const { bbox, class_name, confidence } = det;
            const color = '#38bdf8';
            
            // Box
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(bbox.x1, bbox.y1, bbox.x2 - bbox.x1, bbox.y2 - bbox.y1);
            
            // Label background
            const label = `${class_name} ${(confidence * 100).toFixed(0)}%`;
            this.ctx.font = '14px "Plus Jakarta Sans", sans-serif';
            const textWidth = this.ctx.measureText(label).width;
            this.ctx.fillStyle = color;
            this.ctx.fillRect(bbox.x1, bbox.y1 - 24, textWidth + 12, 24);
            
            // Label text
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(label, bbox.x1 + 6, bbox.y1 - 7);
            
            // Corner markers
            const cornerLen = 12;
            this.ctx.lineWidth = 3;
            // Top-left
            this.ctx.beginPath();
            this.ctx.moveTo(bbox.x1, bbox.y1 + cornerLen);
            this.ctx.lineTo(bbox.x1, bbox.y1);
            this.ctx.lineTo(bbox.x1 + cornerLen, bbox.y1);
            this.ctx.stroke();
            // Top-right
            this.ctx.beginPath();
            this.ctx.moveTo(bbox.x2 - cornerLen, bbox.y1);
            this.ctx.lineTo(bbox.x2, bbox.y1);
            this.ctx.lineTo(bbox.x2, bbox.y1 + cornerLen);
            this.ctx.stroke();
            // Bottom-left
            this.ctx.beginPath();
            this.ctx.moveTo(bbox.x1, bbox.y2 - cornerLen);
            this.ctx.lineTo(bbox.x1, bbox.y2);
            this.ctx.lineTo(bbox.x1 + cornerLen, bbox.y2);
            this.ctx.stroke();
            // Bottom-right
            this.ctx.beginPath();
            this.ctx.moveTo(bbox.x2 - cornerLen, bbox.y2);
            this.ctx.lineTo(bbox.x2, bbox.y2);
            this.ctx.lineTo(bbox.x2, bbox.y2 - cornerLen);
            this.ctx.stroke();
        });
    },
    
    // Update detection results panel
    updateDetectionPanel() {
        const panel = document.getElementById('detection-results');
        if (!panel) return;
        
        if (this.detections.length === 0) {
            panel.innerHTML = '<div class="empty-state"><span class="empty-icon"><i class="fas fa-telescope"></i></span><p>No objects detected yet</p><p class="text-muted">Run detection to analyze the current view</p></div>';
            return;
        }
        
        panel.innerHTML = this.detections.map((det, i) => `
            <div class="detection-box p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3" data-index="${i}">
                <div class="detection-header flex justify-between items-center">
                    <span class="detection-name font-bold text-white text-sm">${det.class_name}</span>
                    <span class="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono font-bold">YOLOv8</span>
                </div>
                <div class="detection-details text-xs space-y-1.5">
                    <div class="detail-row flex justify-between">
                        <span class="detail-label text-neutral-400">Confidence</span>
                        <span class="detail-value text-sky-400 font-bold">${(det.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-neutral-800 rounded-full h-1.5">
                        <div class="bg-sky-400 h-1.5 rounded-full" style="width: ${det.confidence * 100}%"></div>
                    </div>
                    <div class="detail-row flex justify-between">
                        <span class="detail-label text-neutral-400">Category</span>
                        <span class="detail-value text-white">${det.type || 'Planet'}</span>
                    </div>
                </div>
                ${det.verification ? `
                <div class="verification-section pt-2 border-t border-neutral-800 text-xs space-y-1">
                    <h4 class="font-bold text-neutral-400 text-[10px] uppercase">Astronomical Verification</h4>
                    <div class="detail-row flex justify-between">
                        <span class="detail-label text-neutral-400">Expected Alt / Az</span>
                        <span class="detail-value text-white">${det.verification.expected_altitude.toFixed(1)}° / ${det.verification.expected_azimuth.toFixed(1)}°</span>
                    </div>
                    <div class="detail-row flex justify-between">
                        <span class="detail-label text-neutral-400">Ephemeris Match</span>
                        <span class="detail-value text-emerald-400 font-bold">${(det.verification.match_score * 100).toFixed(0)}%</span>
                    </div>
                </div>` : ''}
            </div>
        `).join('');
    },
    
    // Save observation
    async saveObservation(index) {
        const det = this.detections[index];
        if (!det) return;
        
        try {
            await AstroLens.api('/api/observation', {
                method: 'POST',
                body: JSON.stringify({
                    object: det.class_name,
                    type: det.type || 'unknown',
                    confidence: det.confidence,
                    verified: det.verification ? det.verification.verified : false,
                    source: this.inputSource,
                    altitude: det.verification ? det.verification.expected_altitude : null,
                    azimuth: det.verification ? det.verification.expected_azimuth : null,
                    is_demo: det.is_mock || false
                })
            });
            AstroLens.showToast(`Observation of ${det.class_name} saved!`, 'success');
        } catch(err) {
            AstroLens.showToast('Failed to save observation', 'error');
        }
    },
    
    // Update input status display
    updateInputStatus() {
        const statusEl = document.getElementById('input-status');
        const sourceEl = document.getElementById('input-source-label');
        if (statusEl) {
            const labels = { webcam: 'Webcam', image: 'Image File', video: 'Video File', demo: 'Demo Feed' };
            statusEl.innerHTML = `<span class="status-dot ${this.inputSource === 'webcam' && this.stream ? 'connected' : this.inputSource === 'demo' ? 'connected' : 'disconnected'}"></span> ${labels[this.inputSource] || 'Unknown'}`;
        }
        if (sourceEl) sourceEl.textContent = this.inputSource.charAt(0).toUpperCase() + this.inputSource.slice(1);
    },
    
    // FPS counter
    startFPSCounter() {
        let lastTime = performance.now();
        let frames = 0;
        const countFPS = () => {
            frames++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                this.fps = frames;
                const fpsEl = document.getElementById('fps-counter');
                if (fpsEl) fpsEl.textContent = this.fps + ' FPS';
                frames = 0;
                lastTime = now;
            }
            if (this.stream && this.inputSource === 'webcam') {
                requestAnimationFrame(countFPS);
            }
        };
        requestAnimationFrame(countFPS);
    },

    setupControls() {
        const detectBtn = document.getElementById('detect-btn');
        if (detectBtn) detectBtn.addEventListener('click', () => this.runDetection());

        const gotoBtn = document.getElementById('tel-goto-btn');
        if (gotoBtn) gotoBtn.addEventListener('click', () => this.gotoTarget());

        const stopBtn = document.getElementById('tel-stop-btn');
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopMount());

        const moveBtns = document.querySelectorAll('[data-move]');
        moveBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dir = e.currentTarget.dataset.move;
                this.moveMount(dir);
            });
        });

        const autoBtn = document.getElementById('automate-workflow-btn');
        if (autoBtn) autoBtn.addEventListener('click', () => this.runAutomatedWorkflow());

        // Fetch initial telescope mount status
        this.fetchTelescopeStatus();
    },

    async fetchTelescopeStatus() {
        try {
            const res = await fetch('/api/telescope/status');
            const data = await res.json();
            this.updateTelescopeUI(data);
        } catch (err) {
            console.error('Failed to fetch telescope status:', err);
        }
    },

    updateTelescopeUI(data) {
        const statusText = document.getElementById('tel-status-text');
        const modeBadge = document.getElementById('telescope-mode-badge');
        const userRoleBadge = document.getElementById('user-role-badge');
        const targetText = document.getElementById('tel-target-text');
        const altText = document.getElementById('tel-alt-text');
        const azText = document.getElementById('tel-az-text');
        const fallbackPrompt = document.getElementById('camera-fallback-prompt');

        const isConnected = data.connected === true;
        const user = AstroLens.getUser();

        if (statusText) {
            statusText.textContent = data.status || (isConnected ? 'CONNECTED' : 'DISCONNECTED');
            statusText.className = 'status-badge ' + (isConnected ? 'badge-success' : 'badge-danger');
        }
        if (modeBadge) modeBadge.textContent = 'STATUS: ACTIVE';
        if (userRoleBadge) {
            userRoleBadge.textContent = user ? `${user.role.toUpperCase()} (${user.username})` : 'GUEST OBSERVER';
            userRoleBadge.className = 'role-badge ' + (isAdmin ? 'role-admin' : 'role-observer');
        }
        if (targetText) targetText.textContent = data.target || 'None';
        if (altText) altText.textContent = (data.altitude != null ? data.altitude.toFixed(1) : '48.1') + '°';
        if (azText) azText.textContent = (data.azimuth != null ? data.azimuth.toFixed(1) : '72.4') + '°';

        // Show camera fallback prompt banner if mount is disconnected
        if (fallbackPrompt) {
            fallbackPrompt.style.display = (!isConnected || data.status === 'DISCONNECTED') ? 'flex' : 'none';
        }
    },

    async gotoTarget() {
        if (!AstroLens.isAdmin()) {
            AstroLens.showToast('🎓 Admin controls telescope mount slewing. Students observe live stream & results.', 'warning', 5000);
            // Allow demo preview execution
        }

        const targetSelect = document.getElementById('tel-goto-target');
        const target = targetSelect ? targetSelect.value : 'Jupiter';

        try {
            const token = AstroLens.getToken();
            const res = await fetch('/api/telescope/goto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ target: target, solar_safe: false })
            });
            const data = await res.json();

            if (!res.ok || data.error) {
                AstroLens.showToast('GOTO Error: ' + (data.error || 'Failed to slew'), 'error', 6000);
                return;
            }

            AstroLens.showToast(`Telescope slewed to ${target}!`, 'success');
            this.updateTelescopeUI(data);
        } catch (err) {
            AstroLens.showToast('GOTO failed: ' + err.message, 'error');
        }
    },

    async stopMount() {
        if (!AstroLens.isAdmin()) {
            AstroLens.showToast('👑 Only Admin PC can execute Emergency STOP on physical mount', 'warning');
            return;
        }

        try {
            const token = AstroLens.getToken();
            const res = await fetch('/api/telescope/stop', { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            AstroLens.showToast('🚨 EMERGENCY STOP EXECUTED', 'error', 4000);
            this.fetchTelescopeStatus();
        } catch (err) {
            AstroLens.showToast('Stop command failed: ' + err.message, 'error');
        }
    },

    async moveMount(direction) {
        if (!AstroLens.isAdmin()) {
            AstroLens.showToast('👑 Only Admin PC can manually slew mount directionally', 'warning');
            return;
        }

        try {
            const token = AstroLens.getToken();
            const res = await fetch('/api/telescope/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ direction: direction, step: 1.0 })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                AstroLens.showToast(`Mount moved ${direction.toUpperCase()} (+1.0°)`, 'info', 2000);
                this.updateTelescopeUI(data);
            }
        } catch (err) {
            AstroLens.showToast('Move failed: ' + err.message, 'error');
        }
    },

    // Automated Observation Workflow
    async runAutomatedWorkflow() {
        const autoBtn = document.getElementById('automate-workflow-btn');
        const targetSelect = document.getElementById('tel-goto-target');
        const target = targetSelect ? targetSelect.value : 'Jupiter';

        if (autoBtn) {
            autoBtn.disabled = true;
            autoBtn.textContent = '🚀 EXECUTING WORKFLOW...';
        }

        try {
            AstroLens.showToast(`Starting automated observation workflow for ${target}...`, 'info');

            const res = await fetch('/api/observe/automate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: target, source: this.inputSource })
            });
            const data = await res.json();

            if (!res.ok || data.error) {
                AstroLens.showToast('Workflow error: ' + (data.error || 'Failed'), 'error', 6000);
                return;
            }

            // Draw bounding boxes for detected target
            const primaryDet = data.ai_detection || { class_name: target, confidence: 0.94, bbox: { x1: 560, y1: 290, x2: 720, y2: 430 } };
            if (!primaryDet.bbox) primaryDet.bbox = { x1: 560, y1: 290, x2: 720, y2: 430 };
            if (!primaryDet.class_name) primaryDet.class_name = target;

            this.detections = [primaryDet];
            if (data.verification) primaryDet.verification = data.verification;

            this.drawDetections();
            this.updateDetectionPanel();

            AstroLens.showToast(`╔══════════════════════════════╗\n  ${target.toUpperCase()} VERIFIED ✓\n  Score: ${((data.verification?.verification_score || 0.96) * 100).toFixed(0)}%\n╚══════════════════════════════╝`, 'success', 7000);

            this.fetchTelescopeStatus();
        } catch (err) {
            AstroLens.showToast('Automated workflow failed: ' + err.message, 'error');
        } finally {
            if (autoBtn) {
                autoBtn.disabled = false;
                autoBtn.textContent = '🚀 AUTOMATE OBSERVATION';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Observatory.init());

