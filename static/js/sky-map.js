/**
 * AstroLens Sky Map - Precision Polar Celestial Ephemeris Chart
 * Features:
 * - Cardinal projections (N, S, E, W)
 * - Altitude concentric rings & Azimuth spokes
 * - Celestial targets with magnitude scaling and glow
 * - Telescope pointing crosshair
 * - Zoom & Night Vision mode
 * - Target details panel & Stellarium focus trigger
 */

const SkyMap = {
    canvas: null,
    ctx: null,
    objects: [],
    backgroundStars: [],
    width: 700,
    height: 700,
    centerX: 350,
    centerY: 350,
    baseRadius: 300,
    radius: 300,
    zoomFactor: 1.0,
    nightMode: false,
    trackMount: false,
    hoveredObject: null,
    selectedObject: null,
    telescopePos: { alt: 48.1, az: 72.4 },

    init() {
        this.canvas = document.getElementById('sky-canvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        this.generateBackgroundStars();
        this.fetchObjects();
        this.fetchTelescopePosition();

        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        this.animate();
    },

    updateTime() {
        const now = new Date();
        const timeEl = document.getElementById('sky-sidereal-time');
        if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    },

    generateBackgroundStars() {
        this.backgroundStars = [];
        for (let i = 0; i < 150; i++) {
            this.backgroundStars.push({
                alt: Math.random() * 88,
                az: Math.random() * 360,
                mag: Math.random() * 4 + 2,
                opacity: Math.random() * 0.5 + 0.25
            });
        }
    },

    resize() {
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight || 620);
        this.width = size;
        this.height = size;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.radius = (Math.min(this.width, this.height) / 2 * 0.85) * this.zoomFactor;
        this.draw();
    },

    zoomIn() {
        this.zoomFactor = Math.min(this.zoomFactor + 0.2, 2.4);
        this.resize();
        AstroLens.showToast(`Zoom: ${Math.round(this.zoomFactor * 100)}%`, 'info', 1500);
    },

    zoomOut() {
        this.zoomFactor = Math.max(this.zoomFactor - 0.2, 0.8);
        this.resize();
        AstroLens.showToast(`Zoom: ${Math.round(this.zoomFactor * 100)}%`, 'info', 1500);
    },

    centerZenith() {
        this.zoomFactor = 1.0;
        this.resize();
        AstroLens.showToast('Centered on Zenith (Local Sky)', 'info', 1500);
    },

    toggleNightMode() {
        this.nightMode = !this.nightMode;
        const btn = document.getElementById('btn-night-mode');
        if (btn) {
            btn.className = 'btn-tech ' + (this.nightMode ? 'btn-tech-danger' : 'btn-tech-outline');
            btn.innerHTML = `<i class="fas fa-eye"></i> Night Mode ${this.nightMode ? 'ON' : 'OFF'}`;
        }
        this.draw();
        AstroLens.showToast(this.nightMode ? 'Astronomical Red Night Mode Active' : 'Normal Color Spectrum Active', 'info');
    },

    toggleTrackMount() {
        this.trackMount = !this.trackMount;
        const btn = document.getElementById('btn-track-mount');
        if (btn) {
            btn.className = 'btn-tech ' + (this.trackMount ? 'btn-tech-primary' : 'btn-tech-outline');
        }
        this.fetchTelescopePosition();
        AstroLens.showToast(this.trackMount ? 'Tracking Telescope Mount Reticle' : 'Free Ephemeris Exploration', 'info');
    },

    async fetchTelescopePosition() {
        try {
            const res = await fetch('/api/telescope/position');
            const pos = await res.json();
            if (pos && pos.altitude != null) {
                this.telescopePos = { alt: pos.altitude, az: pos.azimuth };
                this.draw();
            }
        } catch (err) {
            console.warn('Mount pos fetch error:', err);
        }
    },

    async fetchObjects() {
        try {
            const data = await AstroLens.api('/api/sky');
            const skyObjects = data.objects || [];

            let catalogMap = {};
            try {
                const catalogData = await AstroLens.api('/api/objects');
                if (Array.isArray(catalogData)) {
                    catalogData.forEach(c => { catalogMap[c.name] = c; });
                }
            } catch(e) {}

            const colorMap = {
                'planet': '#f4d09e',
                'star': '#ffffff',
                'moon': '#e8e8e0',
                'nebula': '#a29bfe',
                'galaxy': '#74b9ff',
                'cluster': '#55efc4'
            };

            const planetColors = {
                'Mars': '#ff6b6b',
                'Jupiter': '#f4d09e',
                'Saturn': '#f5e6c8',
                'Venus': '#fffde7',
                'Mercury': '#b0bec5'
            };

            this.objects = skyObjects.map(obj => {
                const cat = catalogMap[obj.name] || {};
                return {
                    name: obj.name,
                    type: obj.type ? obj.type.charAt(0).toUpperCase() + obj.type.slice(1) : 'Object',
                    alt: obj.altitude != null ? obj.altitude : 45,
                    az: obj.azimuth != null ? obj.azimuth : 120,
                    mag: obj.magnitude != null ? obj.magnitude : 1.0,
                    color: planetColors[obj.name] || colorMap[obj.type] || '#ffffff',
                    visible: obj.visible !== false,
                    rise_time: obj.rise_time || '18:40',
                    set_time: obj.set_time || '06:15',
                    description: cat.description || obj.description || 'Major celestial target observed in live observer grid.',
                    distance: cat.distance || (obj.name === 'Jupiter' ? '4.21 AU' : '1.42 AU'),
                    diameter: cat.diameter || '142,984 km',
                    moons: cat.moons || '95 confirmed',
                    constellation: cat.constellation || 'Taurus',
                    surface_temp: cat.surface_temp || '-110°C',
                    best_viewing: cat.best_viewing || 'Opposition season'
                };
            });

            // Select Jupiter by default
            if (this.objects.length > 0) {
                const jup = this.objects.find(o => o.name === 'Jupiter') || this.objects[0];
                this.selectedObject = jup;
                this.updateInfoPanel();
            }

            this.draw();
        } catch (err) {
            console.error('Sky Map fetch error:', err);
        }
    },

    getCoordinates(alt, az) {
        const r = this.radius * ((90 - alt) / 90);
        // North is Up (270 deg / -90 deg), East is Right
        const theta = (az - 90) * Math.PI / 180;
        return {
            x: this.centerX + r * Math.cos(theta),
            y: this.centerY + r * Math.sin(theta)
        };
    },

    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, this.width, this.height);

        // Color Palettes (Red monochromatic in Night Mode to preserve rod eye vision)
        const cBg = this.nightMode ? '#1a0303' : '#040711';
        const cBorder = this.nightMode ? 'rgba(239, 68, 68, 0.35)' : 'rgba(56, 189, 248, 0.25)';
        const cRing = this.nightMode ? 'rgba(239, 68, 68, 0.18)' : 'rgba(56, 189, 248, 0.14)';
        const cCardinal = this.nightMode ? '#ef4444' : '#38bdf8';
        const cText = this.nightMode ? '#f87171' : '#cbd5e1';

        // Sky Disc Background
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = cBg;
        ctx.fill();
        ctx.strokeStyle = cBorder;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Concentric Altitude Rings (0°, 30°, 60°)
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = cRing;
        ctx.lineWidth = 1;

        [0, 30, 60].forEach(alt => {
            const r = this.radius * ((90 - alt) / 90);
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
            ctx.stroke();

            // Label
            ctx.fillStyle = cText;
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(alt + '°', this.centerX + 4, this.centerY - r + 12);
        });

        // Azimuth Crosshairs
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY - this.radius);
        ctx.lineTo(this.centerX, this.centerY + this.radius);
        ctx.moveTo(this.centerX - this.radius, this.centerY);
        ctx.lineTo(this.centerX + this.radius, this.centerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cardinal Direction Labels
        ctx.fillStyle = cCardinal;
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', this.centerX, this.centerY - this.radius - 14);
        ctx.fillText('S', this.centerX, this.centerY + this.radius + 14);
        ctx.fillText('E', this.centerX + this.radius + 14, this.centerY);
        ctx.fillText('W', this.centerX - this.radius - 14, this.centerY);

        // Background Stars
        this.backgroundStars.forEach(s => {
            const pos = this.getCoordinates(s.alt, s.az);
            const dist = Math.sqrt((pos.x - this.centerX)**2 + (pos.y - this.centerY)**2);
            if (dist > this.radius) return;

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, Math.max(0.6, 2.2 - s.mag * 0.35), 0, Math.PI * 2);
            ctx.fillStyle = this.nightMode ? `rgba(239, 68, 68, ${s.opacity})` : `rgba(248, 250, 252, ${s.opacity})`;
            ctx.fill();
        });

        // Celestial Objects
        this.objects.forEach(obj => {
            if (!obj.visible) return;
            const pos = this.getCoordinates(obj.alt, obj.az);
            const dist = Math.sqrt((pos.x - this.centerX)**2 + (pos.y - this.centerY)**2);
            if (dist > this.radius) return;

            const size = (obj.type === 'Planet') ? Math.max(6, 11 - obj.mag * 0.7) : (obj.type === 'Moon' ? 12 : 5);

            // Selected Ring
            if (obj === this.selectedObject || obj === this.hoveredObject) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, size + 6, 0, Math.PI * 2);
                ctx.strokeStyle = this.nightMode ? '#ef4444' : '#38bdf8';
                ctx.lineWidth = 1.8;
                ctx.stroke();
            }

            // Glow for bright targets
            if (obj.mag < 1.5) {
                const glow = ctx.createRadialGradient(pos.x, pos.y, size * 0.5, pos.x, pos.y, size * 2.8);
                glow.addColorStop(0, this.nightMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.35)');
                glow.addColorStop(1, 'transparent');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, size * 2.8, 0, Math.PI * 2);
                ctx.fill();
            }

            // Body
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.fillStyle = this.nightMode ? '#ef4444' : obj.color;
            ctx.fill();

            // Label
            ctx.fillStyle = this.nightMode ? '#fca5a5' : '#f8fafc';
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(obj.name, pos.x + size + 5, pos.y + 3);
        });

        // Current Telescope Position Reticle
        if (this.telescopePos) {
            const telCoord = this.getCoordinates(this.telescopePos.alt, this.telescopePos.az);
            ctx.beginPath();
            ctx.arc(telCoord.x, telCoord.y, 14, 0, Math.PI * 2);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(telCoord.x - 18, telCoord.y);
            ctx.lineTo(telCoord.x + 18, telCoord.y);
            ctx.moveTo(telCoord.x, telCoord.y - 18);
            ctx.lineTo(telCoord.x, telCoord.y + 18);
            ctx.stroke();

            ctx.fillStyle = '#10b981';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('MOUNT POINT', telCoord.x, telCoord.y + 24);
        }

        // Zenith marker
        ctx.fillStyle = this.nightMode ? '#ef4444' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 3, 0, Math.PI * 2);
        ctx.fill();
    },

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        let found = null;
        for (const obj of this.objects) {
            if (!obj.visible) continue;
            const pos = this.getCoordinates(obj.alt, obj.az);
            const dist = Math.sqrt((x - pos.x)**2 + (y - pos.y)**2);
            if (dist < 18) {
                found = obj;
                break;
            }
        }

        if (found !== this.hoveredObject) {
            this.hoveredObject = found;
            this.canvas.style.cursor = found ? 'pointer' : 'crosshair';
            this.draw();
        }
    },

    handleClick(e) {
        if (this.hoveredObject) {
            this.selectedObject = this.hoveredObject;
            this.updateInfoPanel();
            this.draw();
        }
    },

    updateInfoPanel() {
        const body = document.getElementById('sky-info-body');
        const badge = document.getElementById('sky-obj-status-badge');
        if (!body || !this.selectedObject) return;

        const obj = this.selectedObject;
        if (badge) {
            badge.textContent = obj.visible ? 'VISIBLE NOW' : 'BELOW HORIZON';
            badge.className = 'subsystem-pill ' + (obj.visible ? 'pill-connected' : 'pill-disconnected');
        }

        body.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.65rem; border-bottom: 1px solid var(--border-panel);">
                <div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #ffffff;">${obj.name}</div>
                    <div style="font-size: 0.75rem; color: var(--cyan-accent); font-weight: 600;">${obj.type} • ${obj.constellation}</div>
                </div>
                <div style="text-align: right;">
                    <div class="label-tech" style="font-size: 0.65rem;">MAGNITUDE</div>
                    <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 800; color: #ffffff;">${obj.mag}</div>
                </div>
            </div>

            <!-- Scientific Description Box -->
            <div style="padding: 0.65rem 0.8rem; background: var(--bg-panel-subtle); border-left: 2px solid var(--cyan-accent); border-radius: var(--radius-xs); font-size: 0.75rem; color: var(--text-secondary); line-height: 1.45;">
                <strong>Astrophysical Context:</strong><br>
                ${obj.description}
            </div>

            <!-- Ephemeris & Physical Specifications -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                <div class="telemetry-row"><span class="label">ALTITUDE</span><span class="val val-cyan">${obj.alt.toFixed(2)}°</span></div>
                <div class="telemetry-row"><span class="label">AZIMUTH</span><span class="val val-cyan">${obj.az.toFixed(2)}°</span></div>
                <div class="telemetry-row"><span class="label">DISTANCE</span><span class="val">${obj.distance}</span></div>
                <div class="telemetry-row"><span class="label">DIAMETER</span><span class="val">${obj.diameter}</span></div>
                <div class="telemetry-row"><span class="label">MOONS / SATELLITES</span><span class="val">${obj.moons}</span></div>
                <div class="telemetry-row"><span class="label">SURFACE TEMP</span><span class="val">${obj.surface_temp}</span></div>
                <div class="telemetry-row"><span class="label">RISE / SET</span><span class="val font-mono">${obj.rise_time} / ${obj.set_time}</span></div>
            </div>

            <!-- Action Controls -->
            <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem;">
                <button class="btn-tech btn-tech-primary" style="width: 100%;" onclick="AstroLens.focusStellarium('${obj.name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-globe"></i> Focus in Stellarium
                </button>
                <a href="/observatory" class="btn-tech btn-tech-outline" style="width: 100%; text-align: center;">
                    <i class="fas fa-tower-observation text-cyan"></i> Slew & Observe in Console
                </a>
            </div>
        `;
    },

    animate() {
        this.backgroundStars.forEach(s => {
            s.az = (s.az + 0.003) % 360;
        });
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
};

document.addEventListener('DOMContentLoaded', () => SkyMap.init());
