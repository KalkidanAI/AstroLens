/**
 * AstroLens Observation History
 * Fetches observations from /api/observations
 */

const HistoryView = {
    allObservations: [],
    
    init() {
        this.fetchHistory();
        this.setupSearch();
        this.setupSort();
    },

    async fetchHistory() {
        const container = document.getElementById('history-list');
        if (!container) return;

        try {
            this.allObservations = await AstroLens.api('/api/observations');
            this.renderHistory(container);
        } catch(err) {
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠</span><p>Failed to load history</p></div>';
        }
    },

    renderHistory(container) {
        if (!container) container = document.getElementById('history-list');
        if (!container) return;

        const observations = this.getFilteredObservations();

        if (observations.length === 0) {
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">◷</span><p>No observations found</p></div>';
            return;
        }

        container.innerHTML = observations.map((obs, i) => `
            <div class="card history-row" style="animation: fadeIn 0.3s ease-out ${i * 0.05}s both; cursor: pointer;" onclick="HistoryView.showDetail('${obs.id}')">
                <div class="card-body" style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 140px;">
                        <div style="font-weight: 600; font-size: 1rem;">${obs.object}</div>
                        <div class="text-muted" style="font-size: 0.8rem; text-transform: capitalize;">${obs.type || 'Unknown'}</div>
                    </div>
                    <div style="flex: 1; min-width: 140px;">
                        <div class="text-muted" style="font-size: 0.75rem;">Date & Time</div>
                        <div style="font-size: 0.875rem;">${AstroLens.formatDateTime(obs.timestamp)}</div>
                    </div>
                    <div style="min-width: 100px;">
                        <div class="text-muted" style="font-size: 0.75rem;">Confidence</div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div style="width: 60px; height: 6px; background: var(--bg-input); border-radius: 3px;">
                                <div style="width: ${obs.confidence * 100}%; height: 100%; background: var(--success); border-radius: 3px;"></div>
                            </div>
                            <span style="font-size: 0.875rem;">${(obs.confidence * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                    <div style="min-width: 90px;">
                        <span class="status-badge ${obs.verified ? 'badge-success' : 'badge-warning'}">
                            ${obs.verified ? '✓ Verified' : '⚠ Unverified'}
                        </span>
                    </div>
                    <div style="min-width: 80px;">
                        <div class="text-muted" style="font-size: 0.75rem;">Source</div>
                        <div style="font-size: 0.85rem; text-transform: capitalize;">${obs.source || 'Unknown'}</div>
                    </div>
                    ${obs.is_demo ? '<span class="mock-badge">DEMO</span>' : ''}
                </div>
            </div>
        `).join('');
    },

    getFilteredObservations() {
        let obs = [...this.allObservations];
        
        // Search filter
        const searchTerm = (document.getElementById('history-search')?.value || '').toLowerCase();
        if (searchTerm) {
            obs = obs.filter(o => 
                o.object.toLowerCase().includes(searchTerm) || 
                (o.type || '').toLowerCase().includes(searchTerm) ||
                (o.notes || '').toLowerCase().includes(searchTerm)
            );
        }
        
        // Sort
        const sortBy = document.getElementById('history-sort')?.value || 'newest';
        switch(sortBy) {
            case 'newest':
                obs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                break;
            case 'oldest':
                obs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                break;
            case 'confidence':
                obs.sort((a, b) => b.confidence - a.confidence);
                break;
        }
        
        return obs;
    },

    setupSearch() {
        const input = document.getElementById('history-search');
        if (input) input.addEventListener('input', () => this.renderHistory());
    },

    setupSort() {
        const select = document.getElementById('history-sort');
        if (select) select.addEventListener('change', () => this.renderHistory());
    },

    showDetail(id) {
        const obs = this.allObservations.find(o => o.id === id);
        if (!obs) return;
        
        const modal = document.getElementById('observation-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        
        if (!modal || !body) return;
        
        title.textContent = `${obs.object} Observation`;
        body.innerHTML = `
            <div class="detail-grid">
                <div class="detail-row"><span class="detail-label">Object</span><span class="detail-value">${obs.object}</span></div>
                <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value" style="text-transform: capitalize;">${obs.type || 'Unknown'}</span></div>
                <div class="detail-row"><span class="detail-label">Timestamp</span><span class="detail-value">${AstroLens.formatDateTime(obs.timestamp)}</span></div>
                <div class="detail-row"><span class="detail-label">Confidence</span><span class="detail-value">${(obs.confidence * 100).toFixed(1)}%</span></div>
                <div class="detail-row"><span class="detail-label">Verified</span><span class="status-badge ${obs.verified ? 'badge-success' : 'badge-warning'}">${obs.verified ? '✓ Verified' : '⚠ Unverified'}</span></div>
                <div class="detail-row"><span class="detail-label">Source</span><span class="detail-value">${obs.source}</span></div>
                ${obs.altitude != null ? `<div class="detail-row"><span class="detail-label">Altitude</span><span class="detail-value">${obs.altitude.toFixed(1)}°</span></div>` : ''}
                ${obs.azimuth != null ? `<div class="detail-row"><span class="detail-label">Azimuth</span><span class="detail-value">${obs.azimuth.toFixed(1)}°</span></div>` : ''}
                ${obs.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${obs.notes}</span></div>` : ''}
                ${obs.is_demo ? '<div style="margin-top: 1rem;"><span class="mock-badge">DEMO OBSERVATION</span></div>' : ''}
            </div>
        `;
        
        modal.style.display = 'flex';
    }
};

document.addEventListener('DOMContentLoaded', () => HistoryView.init());
