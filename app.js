document.addEventListener('DOMContentLoaded', async () => {
    const gapContainer = document.getElementById('gap-container');
    const summaryStats = document.getElementById('summary-stats');
    const sgToggle = document.getElementById('toggle-sg');
    const allChips = document.querySelectorAll('.chip');
    
    // KPI elements
    const leadershipEl = document.getElementById('leadership-index');
    const coverageEl = document.getElementById('portfolio-coverage');
    const coverageDescEl = document.getElementById('coverage-desc');
    const strongestAssetEl = document.getElementById('strongest-asset');
    const assetDescEl = document.getElementById('asset-desc');

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

    function getRangeUpgrade(currentRange) {
        if (!currentRange) return "ET";
        if (currentRange.includes("ST")) return "ET Range";
        if (currentRange.includes("ET") || currentRange.includes("SCN")) return "KT/KS Range";
        if (currentRange.includes("KT") || currentRange.includes("KS") || currentRange.includes("PLT")) return "SKN Range";
        if (currentRange.includes("SKN")) return "SKN Elite / Custom Solutions";
        return "next-tier coating";
    }

    function getRecommendation(item) {
        if (item.SWOT === 'Strength') return "Leverage this technical advantage in sales pitches. Highlight SG efficiency.";
        if (item.SWOT === 'Opportunity') return "Identify potential project specifications where this competitor range is used and propose a custom SG solution.";
        
        if (item.SWOT === 'Threat' || item.SWOT === 'Weakness') {
            const upgrade = getRangeUpgrade(item.Range);
            if (item.BestMatch && item.BestMatch.SHGC > item.Target.SHGC) {
                const shgcDiff = (item.BestMatch.SHGC - item.Target.SHGC).toFixed(2);
                return `Strategic Action: Match is ${shgcDiff} higher in SHGC. Recommend practical upgrade to ${upgrade} to meet thermal targets.`;
            }
            return `Strategic Action: Technical gap identified. Focus on lead-time or project-specific benefits while ${upgrade} alternatives are explored.`;
        }
        return "Monitor competitor performance trends in this segment.";
    }

    function getReasoning(item) {
        if (item.SWOT === 'Strength') return 'SG range has equal or superior efficiency.';
        if (item.SWOT === 'Opportunity') return 'SG currently unrepresented in this bridged range segment.';
        if (!item.BestMatch) return 'No compatible SG range found.';
        
        const reasons = [];
        if (item.BestMatch.SHGC > item.Target.SHGC) {
            const diff = (item.BestMatch.SHGC - item.Target.SHGC).toFixed(2);
            reasons.push(`SHGC is ${diff} too high`);
        }
        if (item.BestMatch.VLT < item.Target.VLT - 5) {
            reasons.push(`VLT is ${Math.round(item.Target.VLT - item.BestMatch.VLT)}% lower`);
        }
        
        return reasons.length > 0 ? reasons.join(' and ') + '.' : item.Reason;
    }

    function updateKPIs(filteredItems) {
        const total = filteredItems.length || 1;
        const strengths = filteredItems.filter(i => i.SWOT === 'Strength');
        const opportunities = filteredItems.filter(i => i.SWOT === 'Opportunity').length;
        
        // 1. Market Leadership
        leadershipEl.innerText = Math.round((strengths.length / total) * 100) + '%';

        // 2. Portfolio Coverage
        const matchedItems = filteredItems.filter(i => i.BestMatch !== null).length;
        const coverage = Math.round((matchedItems / total) * 100);
        coverageEl.innerText = coverage + '%';
        coverageDescEl.innerText = `We have suitable matches for ${matchedItems} out of ${total} competitor products.`;

        // 3. Strongest Asset
        const rangeWins = {};
        strengths.forEach(s => {
            const range = s.Range || 'Generic';
            rangeWins[range] = (rangeWins[range] || 0) + 1;
        });

        let bestRange = 'N/A';
        let maxWins = 0;
        for (const r in rangeWins) {
            if (rangeWins[r] > maxWins) {
                maxWins = rangeWins[r];
                bestRange = r;
            }
        }

        strongestAssetEl.innerText = bestRange;
        assetDescEl.innerText = bestRange !== 'N/A' 
            ? `${bestRange} is your strongest asset, dominating in ${maxWins} technical segments.`
            : "No dominant technical lead identified in this segment.";
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
        const shades = ['Blue', 'Green', 'Grey', 'Neutral', 'Bronze'];
        const swotSeries = [
            { name: 'Strengths', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Strength').length), color: '#10b981' },
            { name: 'Weaknesses', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Weakness').length), color: '#ef4444' },
            { name: 'Opportunities', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Opportunity').length), color: '#3b82f6' },
            { name: 'Threats', data: shades.map(s => items.filter(i => i.Target.Shade === s && i.SWOT === 'Threat').length), color: '#f59e0b' }
        ];

        const chartEvents = {
            dataPointSelection: (event, chartContext, config) => {
                const shade = shades[config.dataPointIndex];
                applyFilter('shade', shade);
            }
        };

        if (!chartInstances.swotShade) {
            chartInstances.swotShade = new ApexCharts(document.querySelector("#swotShadeChart"), {
                chart: { type: 'bar', height: 250, stacked: true, toolbar: { show: false }, events: chartEvents },
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

        const standardData = items.filter(i => i.SWOT !== 'Threat').map(i => ({ x: i.Target.VLT, y: i.Target.SHGC }));
        const outlierData = items.filter(i => i.SWOT === 'Threat').map(i => ({ x: i.Target.VLT, y: i.Target.SHGC }));
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

        gapContainer.innerHTML = items.map(item => {
            const reasoning = getReasoning(item);
            const recommendation = getRecommendation(item);
            const tSel = (item.Target.VLT/100) / (item.Target.SHGC || 1);
            const pSel = item.BestMatch ? (item.BestMatch.VLT/100) / (item.BestMatch.SHGC || 1) : 0;
            const getFillLabel = (u) => (u < 2.0) ? "Argon Fill" : "Air Fill";
            const compFill = getFillLabel(item.Target.UValue);
            const sgFill = item.BestMatch ? getFillLabel(item.BestMatch.UValue) : "-";
            const isUWin = item.BestMatch && (item.BestMatch.UValue < item.Target.UValue);

            return `
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
                    <div class="grid-header">Metric</div>
                    <div class="grid-header comp-color">${item.Brand}</div>
                    <div class="grid-header sg-color">Saint-Gobain</div>
                    
                    <div class="grid-label">Matched Product</div>
                    <div class="grid-val" style="font-size: 0.6rem; opacity: 0.7">Competitor Target</div>
                    <div class="grid-val highlight-val" style="font-size: 0.75rem">${item.BestMatch ? item.BestMatch.ProductName : 'NO MATCH'}</div>

                    <div class="grid-label">Filling</div>
                    <div class="grid-val" style="font-size: 0.65rem">${compFill}</div>
                    <div class="grid-val" style="font-size: 0.65rem; color: var(--accent-blue)">${sgFill}</div>

                    <div class="grid-label">VLT</div>
                    <div class="grid-val-group">
                        <div class="grid-val">${item.Target.VLT}%</div>
                        <div class="spec-bar-container"><div class="spec-bar comp" style="width: ${item.Target.VLT}%"></div></div>
                    </div>
                    <div class="grid-val-group">
                        <div class="grid-val highlight-val">${item.BestMatch ? item.BestMatch.VLT + '%' : '-'}</div>
                        <div class="spec-bar-container"><div class="spec-bar sg" style="width: ${item.BestMatch ? item.BestMatch.VLT : 0}%"></div></div>
                    </div>

                    <div class="grid-label">SHGC</div>
                    <div class="grid-val-group">
                        <div class="grid-val">${item.Target.SHGC}</div>
                        <div class="spec-bar-container"><div class="spec-bar comp" style="width: ${item.Target.SHGC * 100}%"></div></div>
                    </div>
                    <div class="grid-val-group">
                        <div class="grid-val highlight-val">${item.BestMatch ? item.BestMatch.SHGC : '-'}</div>
                        <div class="spec-bar-container"><div class="spec-bar sg" style="width: ${item.BestMatch ? item.BestMatch.SHGC * 100 : 0}%"></div></div>
                    </div>

                    <div class="grid-label">U-Value</div>
                    <div class="grid-val">${item.Target.UValue}</div>
                    <div class="grid-val highlight-val ${isUWin ? 'strength-color' : ''}" style="${isUWin ? 'font-weight: 900; background: rgba(16,185,129,0.1); border-radius: 4px;' : ''}">
                        ${item.BestMatch ? item.BestMatch.UValue : '-'}
                        ${isUWin ? '<span style="font-size: 0.5rem; display: block;">TECHNICAL WIN</span>' : ''}
                    </div>

                    <div class="grid-label">Selectivity</div>
                    <div class="grid-val">${tSel.toFixed(2)}</div>
                    <div class="grid-val highlight-val">${pSel > 0 ? pSel.toFixed(2) : '-'}</div>
                </div>

                <div class="comparison">
                    <div class="comp-label">STRATEGIC ANALYSIS</div>
                    <div class="gap-indicator swot-${item.SWOT.toLowerCase()}">${reasoning}</div>
                    <div class="recommendation-box">
                        <span class="rec-title">Recommended Action</span>
                        ${recommendation}
                    </div>
                    <div class="diff-info">Efficiency Delta: ${item.Diff > 0 ? '+' : ''}${item.Diff}%</div>
                </div>
            </div>
        `}).join('');
    }

    function applyFilter(type, val) {
        document.querySelectorAll(`.chip[data-filter="${type}"]`).forEach(c => {
            c.classList.toggle('active', c.dataset.val === val);
        });
        filters[type] = val;
        filterData();
    }

    function filterData() {
        const segmentItems = allItems.filter(item => {
            const matchesBrand = filters.brand === 'all' || item.Brand === filters.brand;
            const matchesShade = filters.shade === 'all' || item.Target.Shade === filters.shade;
            return matchesBrand && matchesShade;
        });

        updateSummary(segmentItems);
        updateKPIs(segmentItems);
        updateCharts(segmentItems, sgCatalog);

        let visibleItems = segmentItems.filter(item => {
            return filters.swot === 'all' || item.SWOT === filters.swot;
        });

        visibleItems.sort((a, b) => a.Diff - b.Diff);
        renderItems(visibleItems);
    }

    sgToggle.addEventListener('change', filterData);

    allChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const filterType = chip.dataset.filter;
            const filterVal = chip.dataset.val;
            applyFilter(filterType, filterVal);
        });
    });

    loadData();
});
