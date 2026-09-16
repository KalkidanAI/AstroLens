/**
 * AstroLens Core Application Engine & Real-Time Event Bus
 * Manages global application state, authentication sessions,
 * Server-Sent Events (SSE) telemetry stream, Stellarium Remote API polling,
 * subsystem telemetry indicators, and mission logging.
 */

const AstroLens = {
    apiUrl: '',
    sseEventSource: null,
    telemetryListeners: [],
    logListeners: [],

    state: {
        currentPage: '',
        telescope: { connected: true, status: 'CONNECTED (MOCK)', is_mock: true, altitude: 48.1, azimuth: 72.4 },
        ai: { ready: true, model: 'YOLOv8n Astronomy Weights', is_mock: true },
        stellarium: { connected: false, location: {}, view: {} },
        camera: { connected: true, fps: 29.8, source: 'demo' },
        location: { name: 'Addis Ababa, Ethiopia', lat: 9.03, lon: 38.74 }
    },

    init() {
        this.setupNavigation();
        this.setupUserAuthUI();
        this.updateClocks();
        setInterval(() => this.updateClocks(), 1000);

        this.fetchStatus();
        this.initRealTimeSSE();
        this.pollStellariumStatus();
        setInterval(() => this.pollStellariumStatus(), 2000);
    },

    // Real-Time Server-Sent Events (SSE) Telemetry Stream
    initRealTimeSSE() {
        if (!window.EventSource) {
            console.warn('SSE not supported, falling back to polling.');
            setInterval(() => this.fetchStatus(), 2000);
            return;
        }

        try {
            this.sseEventSource = new EventSource('/api/stream/telemetry');

            this.sseEventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleRealTimeTelemetry(data);
                } catch (e) {
                    console.warn('SSE Parse error:', e);
                }
            };

            this.sseEventSource.onerror = () => {
                // If SSE disconnects, fall back to periodic fetch until reconnection
                if (this.sseEventSource.readyState === EventSource.CLOSED) {
                    setTimeout(() => this.initRealTimeSSE(), 5000);
                }
            };
        } catch (err) {
            console.warn('SSE Init error:', err);
            setInterval(() => this.fetchStatus(), 2000);
        }
    },

    handleRealTimeTelemetry(data) {
        if (data.telescope) this.state.telescope = Object.assign(this.state.telescope, data.telescope);
        if (data.camera) this.state.camera = Object.assign(this.state.camera, data.camera);
        if (data.ai) this.state.ai = Object.assign(this.state.ai, data.ai);
        if (data.stellarium) {
            this.state.stellarium = Object.assign(this.state.stellarium, data.stellarium);
            this.updateStellariumIndicators(data.stellarium);
        }

        this.updateGlobalIndicators();

        // Broadcast to all registered telemetry listeners
        this.telemetryListeners.forEach(listener => {
            try { listener(this.state); } catch (e) { console.error(e); }
        });
    },

    onTelemetry(callback) {
        if (typeof callback === 'function') {
            this.telemetryListeners.push(callback);
        }
    },

    // Real-Time Mission Event Logger
    logEvent(level, message, component = 'SYSTEM') {
        const now = new Date();
        const timeStr = now.toISOString().substring(11, 23);
        const logEntry = { time: timeStr, level: level.toUpperCase(), message, component };

        this.logListeners.forEach(listener => {
            try { listener(logEntry); } catch (e) {}
        });

        // Dispatch DOM event
        const event = new CustomEvent('astrolens:log', { detail: logEntry });
        window.dispatchEvent(event);
    },

    onLog(callback) {
        if (typeof callback === 'function') {
            this.logListeners.push(callback);
        }
    },

    // Session & Auth Helpers
    getToken() {
        return localStorage.getItem('astrolens_token') || '';
    },

    getUser() {
        try {
            const raw = localStorage.getItem('astrolens_user');
            return raw ? JSON.parse(raw) : null;
        } catch(e) {
            return null;
        }
    },

    saveSession(token, user) {
        localStorage.setItem('astrolens_token', token);
        localStorage.setItem('astrolens_user', JSON.stringify(user));
        this.setupUserAuthUI();
    },

    logout() {
        const token = this.getToken();
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        }).finally(() => {
            localStorage.removeItem('astrolens_token');
            localStorage.removeItem('astrolens_user');
            this.showToast('Mission session terminated. Logged out.', 'info');
            setTimeout(() => window.location.href = '/', 600);
        });
    },

    isAdmin() {
        const user = this.getUser();
        return user && user.role === 'admin';
    },

    setupUserAuthUI() {
        const user = this.getUser();
        const nameEl = document.getElementById('sidebar-username-text');
        const roleEl = document.getElementById('sidebar-role-text');
        const avatarEl = document.getElementById('sidebar-user-avatar');

        if (user) {
            if (nameEl) nameEl.textContent = user.username || 'Observer';
            if (roleEl) roleEl.textContent = (user.role || 'OBSERVER').toUpperCase() + ' SESSION';
            if (avatarEl && user.username) avatarEl.textContent = user.username.charAt(0).toUpperCase();
        } else {
            if (nameEl) nameEl.textContent = 'Guest Observer';
            if (roleEl) roleEl.textContent = 'TELEMETRY ACCESS';
            if (avatarEl) avatarEl.textContent = 'G';
        }
    },

    setupNavigation() {
        const path = window.location.pathname;
        document.querySelectorAll('#sidebar-nav-list .nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href === path) {
                link.classList.add('active');
            }
        });
    },

    updateClocks() {
        const now = new Date();
        const utcStr = now.toISOString().substring(11, 19);
        const localStr = now.toLocaleTimeString('en-US', { hour12: false });

        const topUtc = document.getElementById('topbar-utc-clock');
        if (topUtc) topUtc.textContent = utcStr;

        const sideUtc = document.getElementById('sidebar-utc-clock');
        if (sideUtc) sideUtc.textContent = utcStr;

        const sideLocal = document.getElementById('sidebar-local-clock');
        if (sideLocal) sideLocal.textContent = localStr;
    },

    async fetchStatus() {
        try {
            const data = await this.api('/api/status');
            if (data.telescope) this.state.telescope = Object.assign(this.state.telescope, data.telescope);
            if (data.ai) this.state.ai = Object.assign(this.state.ai, data.ai);
            if (data.stellarium) this.state.stellarium = Object.assign(this.state.stellarium, data.stellarium);
            if (data.location) this.state.location = Object.assign(this.state.location, data.location);
            this.updateGlobalIndicators();
        } catch (err) {
            console.warn('Status fetch error:', err);
        }
    },

    async pollStellariumStatus() {
        try {
            const res = await fetch('/api/stellarium/status');
            const data = await res.json();
            this.state.stellarium = data;
            this.updateStellariumIndicators(data);
        } catch (err) {
            this.state.stellarium = { connected: false };
            this.updateStellariumIndicators({ connected: false });
        }
    },

    updateStellariumIndicators(data) {
        const isConnected = data.connected === true;

        const sidePill = document.getElementById('sidebar-stellarium-pill');
        if (sidePill) {
            sidePill.className = 'subsystem-pill ' + (isConnected ? 'pill-connected' : 'pill-disconnected');
            sidePill.textContent = isConnected ? 'CONNECTED' : 'OFFLINE';
        }

        const topPill = document.getElementById('topbar-stel-indicator');
        if (topPill) {
            topPill.className = 'topbar-conn-pill ' + (isConnected ? 'pill-connected' : 'pill-disconnected');
            topPill.textContent = 'STEL ● ' + (isConnected ? 'CONNECTED' : 'OFFLINE');
        }

        const selectedEl = document.getElementById('dash-stel-selected');
        if (selectedEl) {
            selectedEl.textContent = isConnected && data.selected_object ? data.selected_object : 'None';
        }
    },

    updateGlobalIndicators() {
        const tel = this.state.telescope;
        const isConnected = tel.connected === true;
        const isMock = tel.is_mock !== false;

        const sideTel = document.getElementById('sidebar-telescope-pill');
        if (sideTel) {
            if (!isConnected) {
                sideTel.className = 'subsystem-pill pill-disconnected';
                sideTel.textContent = 'DISCONNECTED';
            } else if (isMock) {
                sideTel.className = 'subsystem-pill pill-mock';
                sideTel.textContent = 'MOCK ACTIVE';
            } else {
                sideTel.className = 'subsystem-pill pill-connected';
                sideTel.textContent = 'HARDWARE SYNC';
            }
        }
    },

    async testStellariumConnection() {
        try {
            this.showToast('Pinging Stellarium Remote Control at 127.0.0.1:8090...', 'info');
            this.logEvent('INFO', 'Testing connection to Stellarium Remote Control port 8090', 'STELLARIUM');
            const res = await fetch('/api/stellarium/test', { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.connected) {
                this.showToast('✓ ' + data.message, 'success', 5000);
                this.logEvent('SUCCESS', 'Connected to Stellarium Remote Control API', 'STELLARIUM');
            } else {
                this.showToast('✕ Stellarium Offline. Enable Remote Control plugin on port 8090.', 'error', 6000);
                this.logEvent('WARN', 'Stellarium port 8090 unreachable', 'STELLARIUM');
            }
            this.pollStellariumStatus();
        } catch (err) {
            this.showToast('Connection test error: ' + err.message, 'error');
        }
    },

    async searchStellarium(query) {
        if (!query || !query.trim()) {
            this.showToast('Enter a celestial object name to search in Stellarium', 'warning');
            return;
        }

        try {
            this.showToast(`Searching Stellarium catalog for "${query}"...`, 'info');
            this.logEvent('QUERY', `Stellarium find query: ${query}`, 'STELLARIUM');
            const res = await fetch(`/api/stellarium/find?name=${encodeURIComponent(query.trim())}`);
            const data = await res.json();

            if (!res.ok || data.error) {
                this.showToast(data.error || 'Object not found in Stellarium', 'warning');
                return;
            }

            const results = Array.isArray(data) ? data : [data];
            const firstName = typeof results[0] === 'string' ? results[0] : (results[0]?.name || query);
            this.focusStellarium(firstName);
        } catch (err) {
            this.showToast('Search error: ' + err.message, 'error');
        }
    },

    async focusStellarium(name) {
        try {
            this.showToast(`Commanding Stellarium to lock and zoom to ${name}...`, 'info');
            this.logEvent('COMMAND', `Focus and zoom command sent for ${name}`, 'STELLARIUM');
            const res = await fetch('/api/stellarium/focus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, mode: 'zoom' })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                this.showToast(`✓ Stellarium viewport locked on ${name}!`, 'success');
                this.logEvent('SUCCESS', `Stellarium locked on ${name}`, 'STELLARIUM');
                this.pollStellariumStatus();
            } else {
                this.showToast(`Stellarium focus notice: ${data.error || 'Make sure Stellarium is running.'}`, 'warning');
            }
        } catch (err) {
            this.showToast('Focus command failed: ' + err.message, 'error');
        }
    },

    // Central API Helper
    async api(endpoint, options = {}) {
        try {
            const token = this.getToken();
            const headers = {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...options.headers
            };
            const res = await fetch(this.apiUrl + endpoint, {
                ...options,
                headers
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }
            return await res.json();
        } catch (err) {
            console.error(`API Call Error (${endpoint}):`, err);
            throw err;
        }
    },

    // Scientific Toast Notifications
    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = type === 'success' ? 'fa-check' : (type === 'error' ? 'fa-circle-xmark' : (type === 'warning' ? 'fa-triangle-exclamation' : 'fa-info'));
        toast.innerHTML = `
            <i class="fas ${icon}" style="font-size: 0.9rem;"></i>
            <span style="flex: 1; font-weight: 500;">${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 15);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, duration);
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
};

document.addEventListener('DOMContentLoaded', () => AstroLens.init());
