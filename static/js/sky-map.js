/**
 * AstroLens Sky Map
 * Canvas-based polar projection sky map with clickable objects
 * Fetches real data from /api/sky endpoint
 */

const SkyMap = {
    canvas: null,
    ctx: null,
    objects: [],
    backgroundStars: [],
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0,
    radius: 0,
    hoveredObject: null,
    selectedObject: null,
    
    init() {
        this.canvas = document.getElementById('sky-canvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Generate background stars
        this.generateBackgroundStars();
        
        // Fetch real sky data
        this.fetchObjects();
        
        // Update time display
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
        
        this.animate();
    },

    updateTime() {
        const el = document.getElementById('sky-time');
        if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    },

    generateBackgroundStars() {
        this.backgroundStars = [];
        for (let i = 0; i < 120; i++) {
            this.backgroundStars.push({
                alt: Math.random() * 90,
                az: Math.random() * 360,
                mag: Math.random() * 4 + 2,
                opacity: Math.random() * 0.5 + 0.2
            });
        }
    },
    
    resize() {
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight || 600);
        this.width = size;
        this.height = size;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.radius = Math.min(this.width, this.height) / 2 * 0.88;
        this.draw();
    },
    
    async fetchObjects() {
        try {
            const data = await AstroLens.api('/api/sky');
            const skyObjects = data.objects || [];
            
            // Map API data to sky map format with colors
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
            
            // Also fetch full catalog for enriched physical properties
            let catalogMap = {};
            try {
                const catalogData = await AstroLens.api('/api/objects');
                if (Array.isArray(catalogData)) {
                    catalogData.forEach(c => { catalogMap[c.name] = c; });
                }
            } catch(e) { console.warn('Catalog map fetch skipped', e); }

            this.objects = skyObjects.map(obj => {
                const cat = catalogMap[obj.name] || {};
                return {
                    name: obj.name,
                    type: obj.type ? obj.type.charAt(0).toUpperCase() + obj.type.slice(1) : 'Object',
                    alt: obj.altitude || 0,
                    az: obj.azimuth || 0,
                    mag: obj.magnitude != null ? obj.magnitude : 1.0,
                    color: planetColors[obj.name] || colorMap[obj.type] || '#ffffff',
                    visible: obj.visible,
                    rise_time: obj.rise_time || '--',
                    set_time: obj.set_time || '--',
                    is_demo: obj.is_demo,
                    description: cat.description || obj.description || 'Celestial target observed in live sky grid.',
                    distance: cat.distance || '--',
                    diameter: cat.diameter || '--',
                    moons: cat.moons || '--',
                    constellation: cat.constellation || '--',
                    surface_temp: cat.surface_temp || '--',
                    best_viewing: cat.best_viewing || '--'
                };
            });
            
            this.draw();
        } catch(err) {
            console.error('Failed to fetch sky data:', err);
            this.draw();
        }
    },
    
    // Convert alt/az to canvas x/y (polar projection)
    getCoordinates(alt, az) {
        const r = this.radius * ((90 - alt) / 90);
        // North is up, East is right
        const theta = (az - 90) * Math.PI / 180;
        return {
            x: this.centerX + r * Math.cos(theta),
            y: this.centerY + r * Math.sin(theta)
        };
    },
    
    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        
        // Clear
        ctx.clearRect(0, 0, this.width, this.height);
        
        // Background gradient
        const bgGrad = ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, this.radius);
        bgGrad.addColorStop(0, '#0a0e1a');
        bgGrad.addColorStop(1, '#060810');
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Altitude rings (0°, 30°, 60°)
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
        [0, 30, 60].forEach(alt => {
            const r = this.radius * ((90 - alt) / 90);
            ctx.beginPath();
            ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
            ctx.stroke();
            
            // Altitude label
            ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(alt + '°', this.centerX + 4, this.centerY - r + 12);
        });
        
        ctx.setLineDash([]);
        
        // Crosshairs
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.centerX, this.centerY - this.radius);
        ctx.lineTo(this.centerX, this.centerY + this.radius);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.centerX - this.radius, this.centerY);
        ctx.lineTo(this.centerX + this.radius, this.centerY);
        ctx.stroke();
        
        // Cardinal directions
        ctx.fillStyle = 'rgba(248, 250, 252, 0.7)';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', this.centerX, this.centerY - this.radius - 14);
        ctx.fillText('S', this.centerX, this.centerY + this.radius + 14);
        ctx.fillText('E', this.centerX + this.radius + 14, this.centerY);
        ctx.fillText('W', this.centerX - this.radius - 14, this.centerY);
        
        // Horizon circle
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Background stars
        this.backgroundStars.forEach(star => {
            const { x, y } = this.getCoordinates(star.alt, star.az);
            const size = Math.max(0.5, 2.5 - star.mag * 0.4);
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 250, ${star.opacity})`;
            ctx.fill();
        });
        
        // Draw celestial objects
        this.objects.forEach(obj => {
            if (!obj.visible) return;
            
            const { x, y } = this.getCoordinates(obj.alt, obj.az);
            let size = Math.max(4, 10 - obj.mag);
            if (obj.type === 'Moon') size = 14;
            if (obj.type === 'Planet') size = Math.max(6, 10 - obj.mag * 0.5);
            
            // Glow effect for bright objects
            if (obj.mag < 1) {
                const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
                glow.addColorStop(0, obj.color + '40');
                glow.addColorStop(1, 'transparent');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(x, y, size * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Highlight if hovered/selected
            if (obj === this.hoveredObject || obj === this.selectedObject) {
                ctx.beginPath();
                ctx.arc(x, y, size + 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(108, 99, 255, 0.25)';
                ctx.fill();
                ctx.strokeStyle = '#6C63FF';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            
            // Object dot
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = obj.color;
            ctx.fill();
            
            // Label for named objects
            if (obj.mag < 2.5) {
                ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(obj.name, x + size + 5, y);
            }
        });
        
        // Zenith marker
        ctx.fillStyle = 'rgba(108, 99, 255, 0.5)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Zenith', this.centerX, this.centerY - 8);
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
            if (dist < 15) {
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
        const panel = document.getElementById('sky-info');
        if (!panel || !this.selectedObject) return;
        
        const obj = this.selectedObject;
        panel.innerHTML = `
            <div class="sky-object-detail card-glow">
                <div class="detail-header">
                    <div>
                        <h3 class="object-title">${obj.name}</h3>
                        <span class="type-badge badge-${obj.type.toLowerCase()}">${obj.type}</span>
                    </div>
                    <span class="status-badge badge-success">Visible Now</span>
                </div>

                <!-- Educational Summary Box -->
                <div class="educational-desc-box mt-3 mb-3">
                    <div class="box-title"><i class="fas fa-book-astronomy"></i> Celestial Science Guide</div>
                    <p class="box-text">${obj.description}</p>
                </div>

                <!-- Physical Properties Grid -->
                <div class="detail-section-title">Physical Specs & Ephemeris</div>
                <div class="detail-grid">
                    <div class="detail-row"><span class="detail-label">Distance</span><span class="detail-value">${obj.distance}</span></div>
                    <div class="detail-row"><span class="detail-label">Diameter</span><span class="detail-value">${obj.diameter}</span></div>
                    <div class="detail-row"><span class="detail-label">Moons / Satellites</span><span class="detail-value">${obj.moons}</span></div>
                    <div class="detail-row"><span class="detail-label">Constellation</span><span class="detail-value">${obj.constellation}</span></div>
                    <div class="detail-row"><span class="detail-label">Surface Temp</span><span class="detail-value">${obj.surface_temp}</span></div>
                    <div class="detail-row"><span class="detail-label">Best Viewing</span><span class="detail-value">${obj.best_viewing}</span></div>
                    <div class="detail-row"><span class="detail-label">Altitude</span><span class="detail-value text-primary">${obj.alt.toFixed(1)}°</span></div>
                    <div class="detail-row"><span class="detail-label">Azimuth</span><span class="detail-value text-primary">${obj.az.toFixed(1)}°</span></div>
                    <div class="detail-row"><span class="detail-label">Magnitude</span><span class="detail-value">${obj.mag}</span></div>
                    <div class="detail-row"><span class="detail-label">Rise / Set</span><span class="detail-value">${obj.rise_time} / ${obj.set_time}</span></div>
                </div>

                <div class="action-buttons-stack mt-3">
                    <a href="/observatory" class="btn btn-primary btn-sm btn-block">🔭 Observe ${obj.name} in Stream</a>
                    <button class="btn btn-outline btn-sm btn-block" onclick="AstroLens.focusStellarium('${obj.name.replace(/'/g, "\\'")}')">✦ Focus in Stellarium</button>
                </div>
            </div>
        `;
    },
    
    animate() {
        // Slowly rotate background stars
        this.backgroundStars.forEach(star => {
            star.az = (star.az + 0.005) % 360;
        });
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
};

document.addEventListener('DOMContentLoaded', () => SkyMap.init());
