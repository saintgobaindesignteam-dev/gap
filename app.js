document.addEventListener('DOMContentLoaded', async () => {
    const gapContainer = document.getElementById('gap-container');
    const summaryStats = document.getElementById('summary-stats');
    const searchInput = document.getElementById('search');
    const brandChips = document.querySelectorAll('.chip');

    let allGaps = [];
    let activeBrand = 'all';

    async function loadData() {
        try {
            const response = await fetch('gap_data.json');
            const data = await response.json();
            allGaps = data.gaps;
            renderSummary(data.summary);
            renderGaps(allGaps);
        } catch (err) {
            gapContainer.innerHTML = `<div class="loader">Failed to load gap data. Please run analyze.ps1 first.</div>`;
            console.error(err);
        }
    }

    function renderSummary(summary) {
        summaryStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-val">${summary.totalGaps}</span>
                <span class="stat-label">Total Gaps</span>
            </div>
            <div class="stat-item">
                <span class="stat-val">${summary.totalCompetitors}</span>
                <span class="stat-label">Competitors</span>
            </div>
            <div class="stat-item">
                <span class="stat-val">${summary.totalSG}</span>
                <span class="stat-label">SG Catalog</span>
            </div>
        `;
    }

    function renderGaps(gaps) {
        if (gaps.length === 0) {
            gapContainer.innerHTML = `<div class="loader">No gaps found matching your criteria.</div>`;
            return;
        }

        gapContainer.innerHTML = gaps.map(gap => `
            <div class="gap-card">
                <div class="card-header">
                    <span class="brand-tag">${gap.Brand}</span>
                    <span class="diff-badge">${gap.Diff < 0 ? gap.Diff + '%' : ''}</span>
                </div>
                <h3 class="product-name">${gap.Product}</h3>
                
                <div class="metrics">
                    <div class="metric">
                        <span class="metric-label">VLT</span>
                        <span class="metric-val">${gap.Target.VLT}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">SHGC</span>
                        <span class="metric-val">${gap.Target.SHGC}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">U-Value</span>
                        <span class="metric-val">${gap.Target.UValue}</span>
                    </div>
                </div>

                <div class="comparison">
                    <div class="comp-label">BEST SG MATCH</div>
                    <div class="match-product">${gap.BestMatch ? gap.BestMatch.ProductName : 'NO MATCH'}</div>
                    <div class="gap-indicator">${gap.Reason}</div>
                </div>
            </div>
        `).join('');
    }

    function filterData() {
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = allGaps.filter(gap => {
            const matchesSearch = gap.Product.toLowerCase().includes(searchTerm) || 
                                gap.Brand.toLowerCase().includes(searchTerm);
            const matchesBrand = activeBrand === 'all' || gap.Brand === activeBrand;
            return matchesSearch && matchesBrand;
        });
        renderGaps(filtered);
    }

    searchInput.addEventListener('input', filterData);

    brandChips.forEach(chip => {
        chip.addEventListener('click', () => {
            brandChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeBrand = chip.dataset.brand;
            filterData();
        });
    });

    loadData();
});
