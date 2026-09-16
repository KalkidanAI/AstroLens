/**
 * AstroLens Settings & Calibration Controller
 * Manages configuration persistence via /api/settings and status synchronization
 */

const Settings = {
    init() {
        this.loadSettings();
        this.setupSaveButton();
        this.setupThresholdSlider();
    },

    async loadSettings() {
        try {
            const status = await AstroLens.api('/api/status');
            const settings = status.settings || {};

            // Location
            const loc = settings.location || {};
            this.setVal('setting-location-name', loc.name || 'Addis Ababa, Ethiopia');
            this.setVal('setting-latitude', loc.latitude != null ? loc.latitude : 9.03);
            this.setVal('setting-longitude', loc.longitude != null ? loc.longitude : 38.74);
            this.setVal('setting-timezone', loc.timezone || 'Africa/Addis_Ababa');

            // Telescope
            const tel = settings.telescope || {};
            this.setVal('setting-input-source', tel.input_source || 'demo');
            this.setVal('setting-resolution', tel.resolution || '1280x720');

            // AI
            const threshold = Math.round((settings.ai?.confidence_threshold || 0.5) * 100);
            this.setVal('setting-threshold', threshold);
            const threshLabel = document.getElementById('threshold-value');
            if (threshLabel) threshLabel.textContent = threshold + '%';

            // Stellarium status diagnostic
            const stelDiag = document.getElementById('stellarium-setting-text');
            if (stelDiag) {
                const isConnected = status.stellarium?.connected === true;
                stelDiag.textContent = isConnected ? 'CONNECTED (PORT 8090)' : 'OFFLINE';
                stelDiag.style.color = isConnected ? 'var(--emerald-accent)' : 'var(--ruby-accent)';
            }
        } catch (err) {
            console.warn('Settings load error:', err);
        }
    },

    setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    },

    setupThresholdSlider() {
        const slider = document.getElementById('setting-threshold');
        const label = document.getElementById('threshold-value');
        if (slider && label) {
            slider.addEventListener('input', () => {
                label.textContent = slider.value + '%';
            });
        }
    },

    setupSaveButton() {
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        const resetBtn = document.getElementById('reset-settings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.setVal('setting-location-name', 'Addis Ababa, Ethiopia');
                this.setVal('setting-latitude', 9.03);
                this.setVal('setting-longitude', 38.74);
                this.setVal('setting-timezone', 'Africa/Addis_Ababa');
                this.setVal('setting-input-source', 'demo');
                this.setVal('setting-resolution', '1280x720');
                this.setVal('setting-threshold', 50);
                const label = document.getElementById('threshold-value');
                if (label) label.textContent = '50%';
                AstroLens.showToast('Configuration reset to scientific defaults', 'info');
            });
        }
    },

    async saveSettings() {
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        const payload = {
            location: {
                name: document.getElementById('setting-location-name')?.value || 'Addis Ababa, Ethiopia',
                latitude: parseFloat(document.getElementById('setting-latitude')?.value) || 9.03,
                longitude: parseFloat(document.getElementById('setting-longitude')?.value) || 38.74,
                timezone: document.getElementById('setting-timezone')?.value || 'Africa/Addis_Ababa'
            },
            telescope: {
                input_source: document.getElementById('setting-input-source')?.value || 'demo',
                resolution: document.getElementById('setting-resolution')?.value || '1280x720',
                driver: document.getElementById('setting-telescope-driver')?.value || 'mock'
            },
            ai: {
                confidence_threshold: (parseInt(document.getElementById('setting-threshold')?.value) || 50) / 100
            },
            stellarium: {
                url: document.getElementById('setting-stel-url')?.value || 'http://localhost',
                port: parseInt(document.getElementById('setting-stel-port')?.value) || 8090
            }
        };

        try {
            await AstroLens.api('/api/settings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            AstroLens.showToast('✓ Observatory configuration saved successfully', 'success');
        } catch (err) {
            AstroLens.showToast('Save error: ' + err.message, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Configuration';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Settings.init());
