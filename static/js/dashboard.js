/**
 * AstroLens Dashboard
 * Fetches real data from Flask API endpoints
 */

const Dashboard = {
    init() {
        this.fetchAllData();
        this.animateCards();
        // Update time display on dashboard
        this.updateDashTime();
        setInterval(() => this.updateDashTime(), 1000);
    },

    animateCards() {
        const cards = document.querySelectorAll('.card, .stat-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'all 0.5s ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    },

    updateDashTime() {
        const el = document.getElementById('dash-time');
        if (el) {
            el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
        }
    },

    async fetchAllData() {
        try {
            // Fetch system status
            const status = await AstroLens.api('/api/status');
            this.updateStatusCards(status);

            // Fetch sky data for visible object count
            const sky = await AstroLens.api('/api/sky');
            this.updateSkyInfo(sky);

            // Fetch recent observations
            const observations = await AstroLens.api('/api/observations');
            this.updateRecentObservations(observations);
        } catch (error) {
            console.error('Dashboard data fetch error:', error);
        }
    },

    updateStatusCards(status) {
        // Telescope
        const telStatus = document.getElementById('telescope-status');
        if (telStatus) {
            telStatus.textContent = status.telescope?.connected ? 'Connected' : 'Disconnected';
        }
        const telModel = document.getElementById('telescope-model');
        if (telModel) telModel.textContent = status.telescope?.model || 'Mock Telescope';
        
        const telMockBadge = document.getElementById('telescope-mock-badge');
        if (telMockBadge) telMockBadge.style.display = status.telescope?.is_mock ? 'inline' : 'none';

        // AI
        const aiStatus = document.getElementById('ai-status');
        if (aiStatus) aiStatus.textContent = status.ai?.status === 'ready' ? 'Ready' : 'Unavailable';
        
        const aiModel = document.getElementById('ai-model-name');
        if (aiModel) aiModel.textContent = status.ai?.model || 'Unknown';
        
        const aiMockBadge = document.getElementById('ai-mock-badge');
        if (aiMockBadge) aiMockBadge.style.display = status.ai?.is_mock ? 'inline' : 'none';

        // Location
        const locName = document.getElementById('location-name');
        if (locName) locName.textContent = status.location?.name || 'Unknown';

        // Input type
        const inputType = document.getElementById('input-type');
        if (inputType) inputType.textContent = status.settings?.telescope?.input_source || 'Demo';
    },

    updateSkyInfo(sky) {
        const countEl = document.getElementById('visible-count');
        if (countEl) countEl.textContent = sky.count || 0;

        // Pick a recommended target (highest altitude visible planet)
        const objects = sky.objects || [];
        const planets = objects.filter(o => o.type === 'planet' && o.visible);
        const target = planets.length > 0 
            ? planets.reduce((a, b) => a.altitude > b.altitude ? a : b) 
            : objects[0];

        if (target) {
            const targetName = document.getElementById('target-name');
            const targetAlt = document.getElementById('target-alt');
            const targetAz = document.getElementById('target-az');
            const targetVis = document.getElementById('target-vis');
            
            if (targetName) targetName.textContent = target.name;
            if (targetAlt) targetAlt.textContent = target.altitude.toFixed(1) + '°';
            if (targetAz) targetAz.textContent = target.azimuth.toFixed(1) + '°';
            if (targetVis) targetVis.textContent = target.altitude > 30 ? 'Excellent' : target.altitude > 15 ? 'Good' : 'Low';
        }
    },

    updateRecentObservations(observations) {
        const list = document.getElementById('recent-observations');
        if (!list) return;

        if (!observations || observations.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="empty-icon">📡</span><p>No observations yet</p></div>';
            return;
        }

        // Show the 5 most recent
        const recent = observations.slice(0, 5);
        list.innerHTML = recent.map(obs => `
            <div class="recent-item">
                <div class="recent-info">
                    <span class="recent-name">${obs.object}</span>
                    <span class="recent-type text-muted">${obs.type || ''}</span>
                </div>
                <div class="recent-meta">
                    <span class="recent-conf">${(obs.confidence * 100).toFixed(0)}%</span>
                    <span class="status-badge ${obs.verified ? 'badge-success' : 'badge-warning'}">${obs.verified ? 'Verified' : 'Unverified'}</span>
                </div>
                <div class="recent-time text-muted">${AstroLens.formatDateTime(obs.timestamp)}</div>
                ${obs.is_demo ? '<span class="mock-badge">DEMO</span>' : ''}
            </div>
        `).join('');

        // Update detection count
        const detCount = document.getElementById('detection-count');
        if (detCount) detCount.textContent = observations.length;
    }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
