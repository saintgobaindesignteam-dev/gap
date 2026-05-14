document.addEventListener('DOMContentLoaded', async () => {
    const gapContainer = document.getElementById('gap-container');
    const summaryStats = document.getElementById('summary-stats');
    const searchInput = document.getElementById('search');
    const allChips = document.querySelectorAll('.chip');

    let allItems = [];
    let filters = { brand: 'all', swot: 'all', shade: 'all' };
    let chartInstances = {};

    async function loadData() {
        try {
            const response = await fetch('gap_data.json');
            const data = await response.json();
            allItems = data.items;
            renderCharts(allItems);
            filterData();
        } catch (err) {
            gapContainer.innerHTML = `<div class="loader">Failed to load SWOT data. Please run analyze.ps1 first.</div>`;
            console.error(err);
        }
    }

    function updateSummary(filteredItems) {
        const stats = {
            strengths: filteredItems.filter(i => i.SWOT === 'Strength').length,
            weaknesses: filteredItems.filter(i => i.SWOT === 'Weakness').length,
            opportunities: filteredItems.filter(i => i.SWOT === 'Opportunity').length,
            threats: filteredItems.filter(i => i.SWOT === 'Threat').length
        };

        summaryStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-val strength-color">${stats.strengths}</span>
                <span class="stat-label">Strengths</span>
            </div>
            <div class="stat-item">
                <span class="stat-val weakness-color">${stats.weaknesses}</span>
                <span class="stat-label">Weaknesses</span>
            </div>
            <div class="stat-item">
                <span class="stat-val opportunity-color">${stats.opportunities}</span>
                <span class="stat-label">Opportunities</span>
            </div>
            <div class="stat-item">
                <span class="stat-val threat-color">${stats.threats}</span>
                <span class="stat-label">Threats</span>
            </div>
        `;
    }

    function renderCharts(items) {
        // 1. SWOT by Shade Stacked Chart
        const shades = ['Blue', 'Green', 'Grey', 'Neutral', 'Bronze'];
        const series = [
            { name: 'Strengths', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Strength').length), color: '#10b981' },
            { name: 'Weaknesses', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Weakness').length), color: '#ef4444' },
            { name: 'Opportunities', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Opportunity').length), color: '#3b82f6' },
            { name: 'Threats', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Threat').length), color: '#f59e0b' }
        ];

        const swotShadeOptions = {
            series: series,
            chart: { type: 'bar', height: 300, stacked: true, toolbar: { show: false }, background: 'transparent' },
            plotOptions: { bar: { horizontal: false, borderRadius: 4 } },
            xaxis: { categories: shades, labels: { style: { colors: '#94a3b8', fontFamily: 'Outfit' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#94a3b8' } },
            fill: { opacity: 1 },
            theme: { mode: 'dark' },
            grid: { borderColor: 'rgba(255,255,255,0.05)' }
        };

        if (chartInstances.swotShade) chartInstances.swotShade.destroy();
        chartInstances.swotShade = new ApexCharts(document.querySelector("#swotShadeChart"), swotShadeOptions);
        chartInstances.swotShade.render();

        // 2. Selectivity Gap by Range
        const ranges = ['ST', 'ET|SCN', 'KT|KS|PLT', 'SKN'];
        const avgGaps = ranges.map(r => {
            const rangeItems = items.filter(i => i.Range === r && i.Diff !== 0);
            if (rangeItems.length === 0) return 0;
            const sum = rangeItems.reduce((acc, curr) => acc + curr.Diff, 0);
            return Math.round(sum / rangeItems.length);
        });

        const rangeGapOptions = {
            series: [{ name: 'Avg Selectivity Diff %', data: avgGaps }],
            chart: { type: 'bar', height: 300, toolbar: { show: false } },
            plotOptions: { 
                bar: { 
                    horizontal: true, 
                    borderRadius: 4,
                    colors: {
                        ranges: [{ from: -100, to: 0, color: '#ef4444' }, { from: 1, to: 100, color: '#10b981' }]
                    }
                } 
            },
            dataLabels: { enabled: true, formatter: val => val + '%' },
            xaxis: { categories: ranges, labels: { style: { colors: '#94a3b8' } } },
            yaxis: { labels: { style: { colors: '#94a3b8' } } },
            theme: { mode: 'dark' },
            grid: { borderColor: 'rgba(255,255,255,0.05)' }
        };

        if (chartInstances.rangeGap) chartInstances.rangeGap.destroy();
        chartInstances.rangeGap = new ApexCharts(document.querySelector("#rangeGapChart"), rangeGapOptions);
        chartInstances.rangeGap.render();
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
        const segmentItems = allItems.filter(item => {
            const matchesBrand = filters.brand === 'all' || item.Brand === filters.brand;
            const matchesShade = filters.shade === 'all' || item.Target.Shade === filters.shade;
            const matchesSearch = item.Product.toLowerCase().includes(searchTerm);
            return matchesBrand && matchesShade && matchesSearch;
        });

        updateSummary(segmentItems);

        let visibleItems = segmentItems.filter(item => {
            return filters.swot === 'all' || item.SWOT === filters.swot;
        });

        visibleItems.sort((a, b) => a.Diff - b.Diff);
        renderItems(visibleItems);
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
