const AstroLens = {
    // Base API URL
    apiUrl: '',
    
    // App state
    state: {
        currentPage: '',
        telescope: { connected: false, status: 'disconnected' },
        ai: { ready: true, model: 'AstroLens YOLOv8 Engine', is_mock: false },
        stellarium: { connected: false, location: {}, view: {} },
        location: { name: 'Addis Ababa, Ethiopia', lat: 9.03, lon: 38.74 }
    },
    
    // Initialize app
    init() {
        this.setupNavigation();
        this.setupMobileMenu();
        this.setupUserAuthUI();
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        this.fetchStatus();
        this.setupStellariumListeners();
        
        // Start polling Stellarium status every 2 seconds
        this.pollStellariumStatus();
        setInterval(() => this.pollStellariumStatus(), 2000);
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
            this.showToast('Logged out successfully', 'info');
            setTimeout(() => window.location.href = '/', 500);
        });
    },

    isAdmin() {
        const user = this.getUser();
        return user && user.role === 'admin';
    },

    // Render logged in user profile badge in sidebar or header
    setupUserAuthUI() {
        const user = this.getUser();
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        let profileEl = document.getElementById('sidebar-user-profile');
        if (!profileEl) {
            profileEl = document.createElement('div');
            profileEl.id = 'sidebar-user-profile';
            profileEl.className = 'sidebar-user-profile';
            // Insert before sidebar footer
            const footer = sidebar.querySelector('.sidebar-footer');
            if (footer) sidebar.insertBefore(profileEl, footer);
            else sidebar.appendChild(profileEl);
        }

        if (user) {
            profileEl.innerHTML = `
                <div class="user-card-inner">
                    <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="user-info">
                        <div class="username-title">${user.username}</div>
                        <span class="text-muted" style="font-size:0.7rem; display:block;">Active Session</span>
                    </div>
                    <button class="btn-logout-icon" title="Logout" onclick="AstroLens.logout()"><i class="fas fa-right-from-bracket"></i></button>
                </div>
            `;
        } else {
            profileEl.innerHTML = `
                <div class="guest-auth-prompt">
                    <span class="text-muted text-sm">Guest Observer</span>
                    <div class="guest-buttons" style="margin-top:0.3rem; display:flex; gap:0.4rem;">
                        <a href="/login" class="btn btn-outline btn-xs"><i class="fas fa-right-to-bracket"></i> Sign In</a>
                        <a href="/signup" class="btn btn-primary btn-xs"><i class="fas fa-user-plus"></i> Join</a>
                    </div>
                </div>
            `;
        }
    },
    
    // Navigation
    setupNavigation() {
        // Highlight active nav item based on current URL
        const path = window.location.pathname;
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('href') === path);
        });
    },
    
    // Mobile menu toggle
    setupMobileMenu() {
        const toggle = document.getElementById('menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        if (toggle && sidebar) {
            toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
            // Close on overlay click
            document.addEventListener('click', (e) => {
                if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
                    sidebar.classList.remove('open');
                }
            });
        }
    },
    
    // Update clock display
    updateClock() {
        const el = document.getElementById('current-time');
        if (el) {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        }
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const now = new Date();
            dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        }
    },
    
    // Fetch system status
    async fetchStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            this.state.telescope = data.telescope || this.state.telescope;
            this.state.ai = data.ai || this.state.ai;
            if (data.stellarium) this.state.stellarium = data.stellarium;
            this.updateStatusIndicators();
        } catch (err) {
            console.error('Failed to fetch status:', err);
        }
    },
    
    // Update status dots in sidebar
    updateStatusIndicators() {
        const telDot = document.getElementById('telescope-status-dot');
        const aiDot = document.getElementById('ai-status-dot');
        const stelDot = document.getElementById('stellarium-status-dot');
        
        if (telDot) telDot.className = 'status-dot ' + (this.state.telescope.connected ? 'connected' : 'disconnected');
        if (aiDot) aiDot.className = 'status-dot ' + (this.state.ai.ready ? 'ready' : 'not-ready');
        if (stelDot) stelDot.className = 'status-dot ' + (this.state.stellarium.connected ? 'connected' : 'disconnected');
    },

    // Poll Stellarium Remote Control Status (every 2 seconds)
    async pollStellariumStatus() {
        try {
            const res = await fetch('/api/stellarium/status');
            const data = await res.json();
            this.state.stellarium = data;
            this.updateStellariumUI(data);
        } catch (err) {
            this.state.stellarium = { connected: false, error: 'Stellarium API unreachable' };
            this.updateStellariumUI(this.state.stellarium);
        }
    },

    // Update Stellarium status card & badges
    updateStellariumUI(data) {
        const isConnected = data.connected === true;
        
        // Sidebar dot
        const stelDot = document.getElementById('stellarium-status-dot');
        if (stelDot) stelDot.className = 'status-dot ' + (isConnected ? 'connected' : 'disconnected');
        
        // Badge
        const badge = document.getElementById('stellarium-badge');
        if (badge) {
            badge.className = 'status-badge ' + (isConnected ? 'badge-success' : 'badge-danger');
            badge.textContent = isConnected ? '🟢 Stellarium Connected' : '🔴 Stellarium Offline';
        }
        
        // Connection text
        const connText = document.getElementById('stellarium-conn-text');
        if (connText) {
            connText.className = isConnected ? 'text-success' : 'text-danger';
            connText.textContent = isConnected ? 'Connected (localhost:8090)' : 'Offline';
        }

        // Details
        const locEl = document.getElementById('stellarium-loc');
        const timeEl = document.getElementById('stellarium-time');
        const fovEl = document.getElementById('stellarium-fov');
        const selEl = document.getElementById('stellarium-selected');
        const helpEl = document.getElementById('stellarium-help-text');

        if (isConnected) {
            if (locEl) locEl.textContent = data.location?.name || 'Connected';
            if (timeEl) timeEl.textContent = data.time?.local ? data.time.local.split('T')[1] || data.time.local : 'Live';
            if (fovEl) fovEl.textContent = data.view?.fov ? parseFloat(data.view.fov).toFixed(1) + '°' : '--';
            if (selEl) {
                const sel = data.selected_object;
                selEl.textContent = sel ? (sel.length > 30 ? sel.substring(0, 30) + '...' : sel) : 'None';
            }
            if (helpEl) helpEl.textContent = 'Stellarium Remote Control API active on port 8090';
        } else {
            if (locEl) locEl.textContent = '--';
            if (timeEl) timeEl.textContent = '--';
            if (fovEl) fovEl.textContent = '--';
            if (selEl) selEl.textContent = 'None';
            if (helpEl) helpEl.textContent = 'Start Stellarium desktop application and enable Remote Control plugin on port 8090.';
        }
    },

    // Stellarium UI Listeners
    setupStellariumListeners() {
        const testBtn = document.getElementById('test-stellarium-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testStellariumConnection());
        }

        const searchBtn = document.getElementById('stellarium-search-btn');
        const searchInput = document.getElementById('stellarium-search-input');
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => this.searchStellarium(searchInput.value));
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchStellarium(searchInput.value);
            });
        }
    },

    // Test Stellarium Connection button handler
    async testStellariumConnection() {
        const testBtn = document.getElementById('test-stellarium-btn');
        if (testBtn) {
            testBtn.disabled = true;
            testBtn.textContent = 'Testing...';
        }

        try {
            const res = await fetch('/api/stellarium/test', { method: 'POST' });
            const data = await res.json();
            
            if (res.ok && data.connected) {
                this.showToast('✓ ' + data.message, 'success', 5000);
            } else {
                this.showToast('✕ ' + (data.message || data.error || 'Stellarium Offline'), 'error', 5000);
            }
            this.pollStellariumStatus();
        } catch (err) {
            this.showToast('✕ Connection Test Error: ' + err.message, 'error', 5000);
        } finally {
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.textContent = 'Test Connection';
            }
        }
    },

    // Search object in Stellarium
    async searchStellarium(query) {
        if (!query || !query.trim()) {
            this.showToast('Please enter an object name to search', 'warning');
            return;
        }

        const resultsContainer = document.getElementById('stellarium-search-results');
        if (resultsContainer) resultsContainer.innerHTML = '<span class="text-muted" style="font-size:0.8rem;">Searching Stellarium...</span>';

        try {
            const res = await fetch(`/api/stellarium/find?name=${encodeURIComponent(query.trim())}`);
            const data = await res.json();

            if (!res.ok || data.error) {
                if (resultsContainer) resultsContainer.innerHTML = `<span class="text-danger" style="font-size:0.8rem;">${data.error || 'Search failed'}</span>`;
                return;
            }

            const results = Array.isArray(data) ? data : [data];
            if (results.length === 0 || (results.length === 1 && !results[0])) {
                if (resultsContainer) resultsContainer.innerHTML = '<span class="text-muted" style="font-size:0.8rem;">No matching objects found in Stellarium</span>';
                return;
            }

            if (resultsContainer) {
                resultsContainer.innerHTML = results.slice(0, 5).map(item => {
                    const name = typeof item === 'string' ? item : item.name || item;
                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-input); padding:0.4rem 0.6rem; border-radius:4px; margin-bottom:0.3rem;">
                            <span style="font-weight:500;">${name}</span>
                            <button class="btn btn-sm btn-primary" onclick="AstroLens.focusStellarium('${name.replace(/'/g, "\\'")}')">VIEW / FOCUS</button>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            if (resultsContainer) resultsContainer.innerHTML = `<span class="text-danger" style="font-size:0.8rem;">Error: ${err.message}</span>`;
        }
    },

    // Focus / Center object in Stellarium
    async focusStellarium(name) {
        try {
            const res = await fetch('/api/stellarium/focus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, mode: 'zoom' })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                this.showToast(`Focused on ${name} in Stellarium!`, 'success');
                this.fetchStellariumObjectInfo(name);
                this.pollStellariumStatus();
            } else {
                this.showToast(`Failed to focus ${name}: ${data.error || 'Stellarium API error'}`, 'error');
            }
        } catch (err) {
            this.showToast(`Focus error: ${err.message}`, 'error');
        }
    },

    // Fetch and render detailed object info from Stellarium
    async fetchStellariumObjectInfo(name) {
        const infoContainer = document.getElementById('stellarium-object-info');
        if (!infoContainer) return;

        try {
            const res = await fetch(`/api/stellarium/object?name=${encodeURIComponent(name)}`);
            const data = await res.json();

            if (res.ok && data && !data.error) {
                infoContainer.style.display = 'block';
                infoContainer.innerHTML = `
                    <div style="font-weight:600; color:var(--secondary); margin-bottom:0.3rem;">${data.name || name} (${data.type || 'Object'})</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.3rem; font-size:0.8rem;" class="text-muted">
                        <div>Magnitude: <span class="text-primary">${data.magnitude != null ? parseFloat(data.magnitude).toFixed(2) : '--'}</span></div>
                        <div>Distance: <span class="text-primary">${data.distance ? parseFloat(data.distance).toFixed(2) + ' AU' : '--'}</span></div>
                        <div>Altitude: <span class="text-primary">${data.altitude != null ? parseFloat(data.altitude).toFixed(1) + '°' : '--'}</span></div>
                        <div>Azimuth: <span class="text-primary">${data.azimuth != null ? parseFloat(data.azimuth).toFixed(1) + '°' : '--'}</span></div>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Failed to fetch object info:', err);
        }
    },
    
    // API helper
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
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`API call failed: ${endpoint}`, err);
            this.showToast(err.message, 'error');
            throw err;
        }
    },
    
    // Toast notification
    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</span>
            <span class="toast-message">${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        return container;
    },
    
    // Format date/time
    formatDateTime(isoString) {
        const d = new Date(isoString);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + 
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    },
    
    formatTime(isoString) {
        return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => AstroLens.init());

