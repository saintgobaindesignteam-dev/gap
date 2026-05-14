document.addEventListener('DOMContentLoaded', async () => {
    const gapContainer = document.getElementById('gap-container');
    const summaryStats = document.getElementById('summary-stats');
    const sgToggle = document.getElementById('toggle-sg');
    const sfSearch = document.getElementById('sf-search');
    const resultsCountEl = document.getElementById('results-count');
    const allChips = document.querySelectorAll('.chip');
    
    // KPI elements
    const leadershipEl = document.getElementById('leadership-index');
    const threatEl = document.getElementById('threat-index');
    const weaknessEl = document.getElementById('weakness-index');

    let allItems = [];
    let sgCatalog = [];
    let filters = { brand: 'all', swot: 'all', shade: 'all', standard: 'all', sf: null };
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
        const strengths = filteredItems.filter(i => i.SWOT === 'Strength').length;
        const threats = filteredItems.filter(i => i.SWOT === 'Threat').length;
        const weaknesses = filteredItems.filter(i => i.SWOT === 'Weakness').length;
        
        leadershipEl.innerText = Math.round((strengths / total) * 100) + '%';
        threatEl.innerText = Math.round((threats / total) * 100) + '%';
        weaknessEl.innerText = Math.round((weaknesses / total) * 100) + '%';
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

        if (!chartInstances.swotShade) {
            chartInstances.swotShade = new ApexCharts(document.querySelector("#swotShadeChart"), {
                chart: { type: 'bar', height: 250, stacked: true, toolbar: { show: false } },
                xaxis: { categories: shades, labels: { style: { colors: '#94a3b8' } } },
                yaxis: { labels: { style: { colors: '#94a3b8' } } },
                legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#94a3b8' } },
                theme: { mode: 'dark' },
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
                xaxis: { categories: ranges, labels: { style: { colors: '#94a3b8' } } },
                theme: { mode: 'dark' },
                series: [{ name: 'Avg Selectivity Diff %', data: avgGaps }]
            });
            chartInstances.rangeGap.render();
        } else {
            chartInstances.rangeGap.updateSeries([{ data: avgGaps }]);
        }

        // --- PERFORMANCE FRONTIER ---
        const guardianData = items.filter(i => i.Brand === 'Guardian').map(i => ({ x: i.Target.SHGC, y: i.Target.VLT, brand: 'Guardian', name: i.Product }));
        const asahiData = items.filter(i => i.Brand === 'Asahi').map(i => ({ x: i.Target.SHGC, y: i.Target.VLT, brand: 'Asahi', name: i.Product }));
        const threatData = items.filter(i => i.SWOT === 'Threat').map(i => ({ x: i.Target.SHGC, y: i.Target.VLT, brand: i.Brand, name: i.Product }));
        
        const filteredSg = allSgItems.filter(i => {
            const matchesShade = filters.shade === 'all' || i.Shade === filters.shade;
            const matchesStd = filters.standard === 'all' || i.Standard === filters.standard;
            return matchesShade && matchesStd;
        });
        const sgData = sgToggle.checked ? filteredSg.map(i => ({ x: i.SHGC, y: i.VLT, brand: 'Saint-Gobain', name: i.ProductName })) : [];

        const frontierSeries = [
            { name: 'Saint-Gobain', data: sgData },
            { name: 'Guardian', data: guardianData },
            { name: 'Asahi', data: asahiData },
            { name: 'Market Outliers (Threats)', data: threatData }
        ];

        if (!chartInstances.frontier) {
            chartInstances.frontier = new ApexCharts(document.querySelector("#frontierChart"), {
                chart: { type: 'scatter', height: 350, zoom: { enabled: true, type: 'xy' } },
                colors: ['#10b981', '#3b82f6', '#8b5cf6', '#ef4444'],
                xaxis: { 
                    title: { text: 'Solar Factor (SF / SHGC)' }, 
                    labels: { style: { colors: '#94a3b8' }, formatter: val => parseFloat(val).toFixed(2) },
                    tickAmount: 10
                },
                yaxis: { title: { text: 'Visible Light Transmission (VLT %)' }, labels: { style: { colors: '#94a3b8' } }, min: 0, max: 100 },
                markers: { size: [5, 5, 5, 8], strokeWidth: 0, hover: { size: 10 } },
                theme: { mode: 'dark' },
                legend: { position: 'top', labels: { colors: '#94a3b8' } },
                tooltip: {
                    custom: function({series, seriesIndex, dataPointIndex, w}) {
                        const point = w.config.series[seriesIndex].data[dataPointIndex];
                        return `<div class="chart-tooltip" style="padding:10px; background: #1e293b; border: 1px solid #334155; border-radius: 8px;">
                            <div style="font-weight: 800;">${point.name}</div>
                            <div style="font-size: 0.7rem; opacity: 0.7">${point.brand}</div>
                            <div style="color: #3b82f6">SF: ${point.x}</div>
                            <div style="color: #10b981">VLT: ${point.y}%</div>
                        </div>`;
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

        const ranks = { Threat: 0, Weakness: 0, Strength: 0, Opportunity: 0 };

        gapContainer.innerHTML = items.map(item => {
            ranks[item.SWOT]++;
            const currentRank = ranks[item.SWOT];
            const reasoning = getReasoning(item);
            const recommendation = getRecommendation(item);
            const tSel = (item.Target.VLT/100) / (item.Target.SHGC || 1);
            const pSel = item.BestMatch ? (item.BestMatch.VLT/100) / (item.BestMatch.SHGC || 1) : 0;
            const isUWin = item.BestMatch && (item.BestMatch.UValue < item.Target.UValue);

            return `
            <div class="gap-card ${item.SWOT.toLowerCase()}-card">
                <div class="card-header">
                    <div class="header-left">
                        <span class="brand-tag">${item.Brand}</span>
                        <span class="range-tag">${item.Range || 'Generic'}</span>
                    </div>
                    <span class="swot-badge swot-${item.SWOT.toLowerCase()}">${item.SWOT.toUpperCase()} #${currentRank}</span>
                </div>
                <h3 class="product-name">${item.Product} <span style="font-size: 0.6rem; opacity: 0.5">(${item.Standard})</span></h3>
                
                <div class="comparison-grid">
                    <div class="grid-header">Metric</div>
                    <div class="grid-header comp-color">${item.Brand}</div>
                    <div class="grid-header sg-color">Saint-Gobain</div>
                    
                    <div class="grid-label">Matched SG Product</div>
                    <div class="grid-val" style="font-size: 0.6rem; opacity: 0.7">Benchmark</div>
                    <div class="grid-val highlight-val" style="font-size: 0.75rem">${item.BestMatch ? item.BestMatch.ProductName : 'NO MATCH'}</div>

                    <div class="grid-label">VLT</div>
                    <div class="grid-val-group">
                        <div class="grid-val">${item.Target.VLT}%</div>
                    </div>
                    <div class="grid-val-group">
                        <div class="grid-val highlight-val">${item.BestMatch ? item.BestMatch.VLT + '%' : '-'}</div>
                    </div>

                    <div class="grid-label">SHGC (SF)</div>
                    <div class="grid-val-group">
                        <div class="grid-val">${item.Target.SHGC}</div>
                    </div>
                    <div class="grid-val-group">
                        <div class="grid-val highlight-val">${item.BestMatch ? item.BestMatch.SHGC : '-'}</div>
                    </div>

                    <div class="grid-label">U-Value</div>
                    <div class="grid-val">${item.Target.UValue}</div>
                    <div class="grid-val highlight-val ${isUWin ? 'strength-color' : ''}">
                        ${item.BestMatch ? item.BestMatch.UValue : '-'}
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
        if (type === 'sf') {
            filters.sf = val ? parseFloat(val) : null;
        } else {
            document.querySelectorAll(`.chip[data-filter="${type}"]`).forEach(c => {
                c.classList.toggle('active', c.dataset.val === val);
            });
            filters[type] = val;
        }
        filterData();
    }

    function filterData() {
        const segmentItems = allItems.filter(item => {
            const matchesBrand = filters.brand === 'all' || item.Brand === filters.brand;
            const matchesShade = filters.shade === 'all' || item.Target.Shade === filters.shade;
            const matchesStd = filters.standard === 'all' || item.Standard === filters.standard;
            const matchesSF = !filters.sf || (Math.abs(item.Target.SHGC - filters.sf) <= 0.02); // Tighter tolerance for direct count
            return matchesBrand && matchesShade && matchesStd && matchesSF;
        });

        // Update Results Count
        if (filters.sf !== null) {
            resultsCountEl.innerText = `${segmentItems.length} items at SF ${filters.sf.toFixed(2)} (±0.02)`;
        } else {
            resultsCountEl.innerText = '';
        }

        updateSummary(segmentItems);
        updateKPIs(segmentItems);
        updateCharts(segmentItems, sgCatalog);

        let visibleItems = segmentItems.filter(item => {
            return filters.swot === 'all' || item.SWOT === filters.swot;
        });

        visibleItems.sort((a, b) => {
            if (a.SWOT === b.SWOT) {
                if (a.SWOT === 'Strength') return b.Diff - a.Diff;
                return a.Diff - b.Diff;
            }
            return 0;
        });

        renderItems(visibleItems);
    }

    sgToggle.addEventListener('change', filterData);
    sfSearch.addEventListener('input', (e) => applyFilter('sf', e.target.value));

    allChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const filterType = chip.dataset.filter;
            const filterVal = chip.dataset.val;
            applyFilter(filterType, filterVal);
        });
    });

    loadData();
});
