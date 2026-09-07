/**
 * AstroLens Celestial Objects Browser
 * Fetches object catalog from /api/objects with live positions
 */

const Objects = {
    allObjects: [],
    filteredObjects: [],
    activeCategory: 'all',

    init() {
        this.fetchObjects();
        this.setupFilters();
        this.setupSearch();
    },

    async fetchObjects() {
        const container = document.getElementById('objects-grid');
        if (!container) return;

        try {
            this.allObjects = await AstroLens.api('/api/objects');
            this.filteredObjects = this.allObjects;
            this.renderObjects(container);
        } catch(err) {
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠</span><p>Failed to load objects</p></div>';
        }
    },

    renderObjects(container) {
        if (!container) container = document.getElementById('objects-grid');
        if (!container) return;

        if (this.filteredObjects.length === 0) {
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">★</span><p>No objects found</p></div>';
            return;
        }

        container.innerHTML = this.filteredObjects.map((obj, i) => {
            const hasPosition = obj.altitude !== null && obj.altitude !== undefined;
            const visible = obj.visible === true;
            const typeColors = {
                'planet': 'var(--secondary)',
                'star': 'var(--warning)',
                'moon': 'var(--text-secondary)',
                'nebula': '#a29bfe',
                'galaxy': '#74b9ff',
                'cluster': '#55efc4'
            };
            const badgeColor = typeColors[obj.type] || 'var(--text-muted)';

            return `
                <div class="card object-card card-glow" style="animation: fadeIn 0.4s ease-out ${i * 0.05}s both;">
                    <div class="card-header">
                        <h3>${obj.name}</h3>
                        <span class="status-badge ${visible ? 'badge-success' : 'badge-danger'}">
                            ${visible ? 'VISIBLE NOW' : 'BELOW HORIZON'}
                        </span>
                    </div>
                    <div class="card-body">
                        <div style="margin-bottom: 0.75rem;">
                            <span class="object-type-badge" style="background: ${badgeColor}20; color: ${badgeColor}; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid ${badgeColor}40;">${obj.category || obj.type}</span>
                        </div>
                        ${obj.description ? `<p class="text-muted" style="font-size: 0.85rem; margin-bottom: 0.75rem; line-height: 1.5;">${obj.description}</p>` : ''}
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.8rem; margin-bottom: 1rem;" class="text-muted">
                            <div><span>Altitude:</span> <strong class="text-primary">${hasPosition ? obj.altitude.toFixed(1) + '°' : '--'}</strong></div>
                            <div><span>Azimuth:</span> <strong class="text-primary">${hasPosition ? obj.azimuth.toFixed(1) + '°' : '--'}</strong></div>
                            <div><span>Magnitude:</span> <strong class="text-primary">${obj.magnitude != null ? obj.magnitude : '--'}</strong></div>
                            <div><span>Constellation:</span> <strong class="text-primary">${obj.constellation || '--'}</strong></div>
                            <div><span>Distance:</span> <strong class="text-primary">${obj.distance || '--'}</strong></div>
                            <div><span>Moons/Satellites:</span> <strong class="text-primary">${obj.moons || '--'}</strong></div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <a href="/observatory" class="btn btn-primary btn-sm" style="flex: 1; text-align: center;">🔭 Observe</a>
                            <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="AstroLens.focusStellarium('${obj.name.replace(/'/g, "\\'")}')">✦ Focus</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    setupFilters() {
        const filters = document.querySelectorAll('.filter-btn');
        filters.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filters.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.activeCategory = e.target.dataset.category;
                this.applyFilters();
            });
        });
    },

    setupSearch() {
        const searchInput = document.getElementById('object-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyFilters());
        }
    },

    applyFilters() {
        const searchTerm = (document.getElementById('object-search')?.value || '').toLowerCase();
        
        this.filteredObjects = this.allObjects.filter(obj => {
            const matchesCategory = this.activeCategory === 'all' || obj.category === this.activeCategory;
            const matchesSearch = !searchTerm || 
                obj.name.toLowerCase().includes(searchTerm) || 
                (obj.description || '').toLowerCase().includes(searchTerm);
            return matchesCategory && matchesSearch;
        });

        this.renderObjects();
    }
};

document.addEventListener('DOMContentLoaded', () => Objects.init());
