/**
 * AstroLens Settings Page
 * Loads/saves settings via /api/settings
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
            this.setVal('setting-latitude', loc.latitude || 9.03);
            this.setVal('setting-longitude', loc.longitude || 38.74);
            this.setVal('setting-timezone', loc.timezone || 'Africa/Addis_Ababa');
            
            // Telescope
            this.setVal('setting-input-source', settings.telescope?.input_source || 'demo');
            this.setVal('setting-resolution', settings.telescope?.resolution || '1280x720');
            
            // AI
            const threshold = Math.round((settings.ai?.confidence_threshold || 0.5) * 100);
            this.setVal('setting-threshold', threshold);
            const threshLabel = document.getElementById('threshold-value');
            if (threshLabel) threshLabel.textContent = threshold;
            
            // AI model status
            const modelStatus = document.getElementById('model-status-text');
            if (modelStatus) {
                modelStatus.textContent = status.ai?.is_mock ? 'Mock Detector Active' : 'YOLO Model Active';
            }
            
            // Display
            this.setChecked('setting-grid', settings.display?.show_grid !== false);
            this.setChecked('setting-labels', settings.display?.show_labels !== false);
            
        } catch(err) {
            console.error('Failed to load settings:', err);
        }
    },

    setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    },

    setChecked(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    },

    setupThresholdSlider() {
        const slider = document.getElementById('setting-threshold');
        const label = document.getElementById('threshold-value');
        if (slider && label) {
            slider.addEventListener('input', () => {
                label.textContent = slider.value;
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
                if (label) label.textContent = '50';
                AstroLens.showToast('Settings reset to defaults', 'info');
            });
        }
    },

    async saveSettings() {
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        const settings = {
            location: {
                name: document.getElementById('setting-location-name')?.value || '',
                latitude: parseFloat(document.getElementById('setting-latitude')?.value) || 9.03,
                longitude: parseFloat(document.getElementById('setting-longitude')?.value) || 38.74,
                timezone: document.getElementById('setting-timezone')?.value || 'Africa/Addis_Ababa'
            },
            telescope: {
                input_source: document.getElementById('setting-input-source')?.value || 'demo',
                resolution: document.getElementById('setting-resolution')?.value || '1280x720'
            },
            ai: {
                confidence_threshold: (parseInt(document.getElementById('setting-threshold')?.value) || 50) / 100
            },
            display: {
                theme: document.getElementById('setting-theme')?.value || 'dark',
                show_grid: document.getElementById('setting-grid')?.checked ?? true,
                show_labels: document.getElementById('setting-labels')?.checked ?? true
            }
        };

        try {
            await AstroLens.api('/api/settings', {
                method: 'POST',
                body: JSON.stringify(settings)
            });
            AstroLens.showToast('Settings saved successfully', 'success');
        } catch (err) {
            AstroLens.showToast('Failed to save settings: ' + err.message, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Settings';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Settings.init());
