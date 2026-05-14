document.addEventListener('DOMContentLoaded', async () => {
    const gapContainer = document.getElementById('gap-container');
    const summaryStats = document.getElementById('summary-stats');
    const searchInput = document.getElementById('search');
    const sgToggle = document.getElementById('toggle-sg');
    const allChips = document.querySelectorAll('.chip');

    let allItems = [];
    let sgCatalog = [];
    let filters = { brand: 'all', swot: 'all', shade: 'all' };
    let chartInstances = {};

    async function loadData() {
        try {
            const response = await fetch('gap_data.json');
            const data = await response.json();
            allItems = data.items;
            sgCatalog = data.sgCatalog || [];
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

    function updateCharts(items, allSgItems) {
        // 1. SWOT by Shade Stacked Chart (Uses all segment items regardless of SWOT filter)
        const shades = ['Blue', 'Green', 'Grey', 'Neutral', 'Bronze'];
        const swotSeries = [
            { name: 'Strengths', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Strength').length), color: '#10b981' },
            { name: 'Weaknesses', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Weakness').length), color: '#ef4444' },
            { name: 'Opportunities', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Opportunity').length), color: '#3b82f6' },
            { name: 'Threats', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Threat').length), color: '#f59e0b' }
        ];

        if (!chartInstances.swotShade) {
            chartInstances.swotShade = new ApexCharts(document.querySelector("#swotShadeChart"), {
                chart: { type: 'bar', height: 250, stacked: true, toolbar: { show: false } },
                plotOptions: { bar: { horizontal: false, borderRadius: 4 } },
                xaxis: { categories: shades, labels: { style: { colors: '#94a3b8' } } },
                yaxis: { labels: { style: { colors: '#94a3b8' } } },
                legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#94a3b8' } },
                theme: { mode: 'dark' },
                grid: { borderColor: 'rgba(255,255,255,0.05)' },
                series: swotSeries
            });
            chartInstances.swotShade.render();
        } else {
            chartInstances.swotShade.updateSeries(swotSeries);
        }

        // 2. Selectivity Gap by Range
        const ranges = ['ST', 'ET|SCN', 'KT|KS|PLT', 'SKN'];
        const avgGaps = ranges.map(r => {
            const rangeItems = items.filter(i => i.Range === r && i.Diff !== 0);
            if (rangeItems.length === 0) return 0;
            const sum = rangeItems.reduce((acc, curr) => acc + curr.Diff, 0);
            return Math.round(sum / rangeItems.length);
        });

        if (!chartInstances.rangeGap) {
            chartInstances.rangeGap = new ApexCharts(document.querySelector("#rangeGapChart"), {
                chart: { type: 'bar', height: 250, toolbar: { show: false } },
                plotOptions: { bar: { horizontal: true, borderRadius: 4, colors: { ranges: [{ from: -100, to: 0, color: '#ef4444' }, { from: 1, to: 100, color: '#10b981' }] } } },
                dataLabels: { enabled: true, formatter: val => val + '%' },
                xaxis: { categories: ranges, labels: { style: { colors: '#94a3b8' } } },
                theme: { mode: 'dark' },
                series: [{ name: 'Avg Selectivity Diff %', data: avgGaps }]
            });
            chartInstances.rangeGap.render();
        } else {
            chartInstances.rangeGap.updateSeries([{ data: avgGaps }]);
        }

        // 3. Performance Frontier Scatter Plot (Filtered)
        const standardData = items.filter(i => i.SWOT !== 'Threat').map(i => ({ x: i.Target.VLT, y: i.Target.SHGC }));
        const outlierData = items.filter(i => i.SWOT === 'Threat').map(i => ({ x: i.Target.VLT, y: i.Target.SHGC }));
        
        // Filter SG catalog by current shade if specified
        const filteredSg = allSgItems.filter(i => filters.shade === 'all' || i.Shade === filters.shade);
        const sgData = sgToggle.checked ? filteredSg.map(i => ({ x: i.VLT, y: i.SHGC })) : [];

        const frontierSeries = [
            { name: 'Standard Performance', data: standardData },
            { name: 'Market Outliers (Threats)', data: outlierData },
            { name: 'Saint-Gobain Catalog', data: sgData }
        ];

        if (!chartInstances.frontier) {
            chartInstances.frontier = new ApexCharts(document.querySelector("#frontierChart"), {
                chart: { type: 'scatter', height: 350, zoom: { enabled: true, type: 'xy' } },
                colors: ['#3b82f6', '#ef4444', '#10b981'],
                xaxis: { title: { text: 'VLT %' }, labels: { style: { colors: '#94a3b8' } } },
                yaxis: { title: { text: 'SHGC / SF' }, labels: { style: { colors: '#94a3b8' } } },
                markers: { size: [6, 8, 5], shape: ["circle", "circle", "square"] },
                theme: { mode: 'dark' },
                legend: { labels: { colors: '#94a3b8' } },
                tooltip: {
                    custom: function({series, seriesIndex, dataPointIndex}) {
                        let item;
                        if (seriesIndex === 0) item = items.filter(i => i.SWOT !== 'Threat')[dataPointIndex].Target;
                        else if (seriesIndex === 1) item = items.filter(i => i.SWOT === 'Threat')[dataPointIndex].Target;
                        else item = filteredSg[dataPointIndex];
                        if (!item) return '';
                        return `<div class="chart-tooltip"><b>${item.ProductName || item.Product}</b><br>VLT: ${item.VLT}% | SHGC: ${item.SHGC}</div>`;
                    }
                },
                series: frontierSeries
            });
            chartInstances.frontier.render();
        } else {
            chartInstances.frontier.updateSeries(frontierSeries);
        }
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
        
        // 1. Filter segment for summary and charts
        const segmentItems = allItems.filter(item => {
            const matchesBrand = filters.brand === 'all' || item.Brand === filters.brand;
            const matchesShade = filters.shade === 'all' || item.Target.Shade === filters.shade;
            const matchesSearch = item.Product.toLowerCase().includes(searchTerm) || item.Brand.toLowerCase().includes(searchTerm);
            return matchesBrand && matchesShade && matchesSearch;
        });

        updateSummary(segmentItems);
        updateCharts(segmentItems, sgCatalog);

        // 2. Filter for visible cards
        let visibleItems = segmentItems.filter(item => {
            return filters.swot === 'all' || item.SWOT === filters.swot;
        });

        visibleItems.sort((a, b) => a.Diff - b.Diff);
        renderItems(visibleItems);
    }

    searchInput.addEventListener('input', filterData);
    sgToggle.addEventListener('change', filterData);

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
