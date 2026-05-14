document.addEventListener('DOMContentLoaded', async () => {
    const gapContainer = document.getElementById('gap-container');
    const summaryStats = document.getElementById('summary-stats');
    const searchInput = document.getElementById('search');
    const allChips = document.querySelectorAll('.chip');

    let allItems = [];
    let filters = {
        brand: 'all',
        swot: 'all'
    };

    async function loadData() {
        try {
            const response = await fetch('gap_data.json');
            const data = await response.json();
            allItems = data.items;
            renderSummary(data.summary);
            renderItems(allItems);
        } catch (err) {
            gapContainer.innerHTML = `<div class="loader">Failed to load SWOT data. Please run analyze.ps1 first.</div>`;
            console.error(err);
        }
    }

    function renderSummary(summary) {
        summaryStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-val strength-color">${summary.strengths}</span>
                <span class="stat-label">Strengths</span>
            </div>
            <div class="stat-item">
                <span class="stat-val weakness-color">${summary.weaknesses}</span>
                <span class="stat-label">Weaknesses</span>
            </div>
            <div class="stat-item">
                <span class="stat-val opportunity-color">${summary.opportunities}</span>
                <span class="stat-label">Opportunities</span>
            </div>
            <div class="stat-item">
                <span class="stat-val threat-color">${summary.threats}</span>
                <span class="stat-label">Threats</span>
            </div>
        `;
    }

    function renderItems(items) {
        if (items.length === 0) {
            gapContainer.innerHTML = `<div class="loader">No items found matching your criteria.</div>`;
            return;
        }

        gapContainer.innerHTML = items.map(item => `
            <div class="gap-card ${item.SWOT.toLowerCase()}-card">
                <div class="card-header">
                    <span class="brand-tag">${item.Brand}</span>
                    <span class="swot-badge swot-${item.SWOT.toLowerCase()}">${item.SWOT}</span>
                </div>
                <h3 class="product-name">${item.Product}</h3>
                
                <div class="comparison-grid">
                    <div class="grid-header"></div>
                    <div class="grid-header comp-color">${item.Brand}</div>
                    <div class="grid-header sg-color">Saint-Gobain</div>
                    
                    <div class="grid-label">VLT</div>
                    <div class="grid-val">${item.Target.VLT}%</div>
                    <div class="grid-val highlight-val">${item.BestMatch ? item.BestMatch.VLT + '%' : '-'}</div>

                    <div class="grid-label">SHGC</div>
                    <div class="grid-val">${item.Target.SHGC}</div>
                    <div class="grid-val highlight-val">${item.BestMatch ? item.BestMatch.SHGC : '-'}</div>

                    <div class="grid-label">U-Value</div>
                    <div class="grid-val">${item.Target.UValue}</div>
                    <div class="grid-val highlight-val">${item.BestMatch ? item.BestMatch.UValue : '-'}</div>
                </div>

                <div class="comparison">
                    <div class="comp-label">BEST SG MATCH</div>
                    <div class="match-product">${item.BestMatch ? item.BestMatch.ProductName : 'NO MATCH'}</div>
                    <div class="gap-indicator swot-${item.SWOT.toLowerCase()}">${item.Reason}</div>
                    <div class="diff-info">Selectivity Diff: ${item.Diff > 0 ? '+' : ''}${item.Diff}%</div>
                </div>
            </div>
        `).join('');
    }

    function filterData() {
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = allItems.filter(item => {
            const matchesSearch = item.Product.toLowerCase().includes(searchTerm) || 
                                item.Brand.toLowerCase().includes(searchTerm) ||
                                item.SWOT.toLowerCase().includes(searchTerm);
            const matchesBrand = filters.brand === 'all' || item.Brand === filters.brand;
            const matchesSwot = filters.swot === 'all' || item.SWOT === filters.swot;
            return matchesSearch && matchesBrand && matchesSwot;
        });
        renderItems(filtered);
    }

    searchInput.addEventListener('input', filterData);

    allChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const filterType = chip.dataset.filter;
            const filterVal = chip.dataset.val;

            // Update UI
            document.querySelectorAll(`.chip[data-filter="${filterType}"]`).forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            // Update State
            filters[filterType] = filterVal;
            filterData();
        });
    });

    loadData();
});
