document.addEventListener('DOMContentLoaded', async () => {
    const gapContainer = document.getElementById('gap-container');
    const summaryStats = document.getElementById('summary-stats');
    const searchInput = document.getElementById('search');
    const allChips = document.querySelectorAll('.chip');

    let allItems = [];
    let filters = { brand: 'all', swot: 'all', shade: 'all' };
    let charts = {};

    async function loadData() {
        try {
            const response = await fetch('gap_data.json');
            const data = await response.json();
            allItems = data.items;
            renderSummary(data.summary);
            renderCharts(data.summary, allItems);
            filterData(); // Initial render with ranking
        } catch (err) {
            gapContainer.innerHTML = `<div class="loader">Failed to load SWOT data. Please run analyze.ps1 first.</div>`;
            console.error(err);
        }
    }

    function renderSummary(summary) {
        summaryStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-val strength-color">${summary.strengths || 0}</span>
                <span class="stat-label">Strengths</span>
            </div>
            <div class="stat-item">
                <span class="stat-val weakness-color">${summary.weaknesses || 0}</span>
                <span class="stat-label">Weaknesses</span>
            </div>
            <div class="stat-item">
                <span class="stat-val opportunity-color">${summary.opportunities || 0}</span>
                <span class="stat-label">Opportunities</span>
            </div>
            <div class="stat-item">
                <span class="stat-val threat-color">${summary.threats || 0}</span>
                <span class="stat-label">Threats</span>
            </div>
        `;
    }

    function renderCharts(summary, items) {
        const swotCtx = document.getElementById('swotChart').getContext('2d');
        if (charts.swot) charts.swot.destroy();
        charts.swot = new Chart(swotCtx, {
            type: 'doughnut',
            data: {
                labels: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'],
                datasets: [{
                    data: [summary.strengths || 0, summary.weaknesses || 0, summary.opportunities || 0, summary.threats || 0],
                    backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
                }
            }
        });

        const brands = [...new Set(items.map(i => i.Brand))];
        const brandGaps = brands.map(b => items.filter(i => i.Brand === b && (i.SWOT === 'Threat' || i.SWOT === 'Weakness')).length);
        
        const brandCtx = document.getElementById('brandChart').getContext('2d');
        if (charts.brand) charts.brand.destroy();
        charts.brand = new Chart(brandCtx, {
            type: 'bar',
            data: {
                labels: brands,
                datasets: [{
                    label: 'Critical Gaps',
                    data: brandGaps,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderItems(items) {
        if (items.length === 0) {
            gapContainer.innerHTML = `<div class="loader">No items found matching your criteria.</div>`;
            return;
        }

        gapContainer.innerHTML = items.map(item => `
            <div class="gap-card ${item.SWOT.toLowerCase()}-card">
                <div class="card-header">
                    <div class="header-left">
                        <span class="brand-tag">${item.Brand}</span>
                        <span class="range-tag">${item.Range || 'Generic'}</span>
                    </div>
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
        let filtered = allItems.filter(item => {
            const matchesSearch = item.Product.toLowerCase().includes(searchTerm) || 
                                item.Brand.toLowerCase().includes(searchTerm) ||
                                item.SWOT.toLowerCase().includes(searchTerm);
            const matchesBrand = filters.brand === 'all' || item.Brand === filters.brand;
            const matchesSwot = filters.swot === 'all' || item.SWOT === filters.swot;
            const matchesShade = filters.shade === 'all' || item.Target.Shade === filters.shade;
            return matchesSearch && matchesBrand && matchesSwot && matchesShade;
        });

        // Ranking Logic: Sort by Selectivity Difference (Biggest Gaps/Threats first)
        filtered.sort((a, b) => a.Diff - b.Diff);

        renderItems(filtered);
    }

    searchInput.addEventListener('input', filterData);

    allChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const filterType = chip.dataset.filter;
            const filterVal = chip.dataset.val;
            document.querySelectorAll(`.chip[data-filter="${filterType}"]`).forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filters[filterType] = filterVal;
            filterData();
        });
    });

    loadData();
});
