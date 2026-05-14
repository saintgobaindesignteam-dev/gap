const fs = require('fs');
const path = require('path');

// Load products
const productsPath = path.join(__dirname, '..', 'products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

const sgProducts = products.filter(p => p.Brand === 'Saint-Gobain');
const competitionProducts = products.filter(p => p.Brand !== 'Saint-Gobain');

function isShadeMatch(s1, s2) {
    if (!s1 || !s2) return true;
    const a = s1.toLowerCase(), b = s2.toLowerCase();
    if (a === b) return true;
    if ((a === 'neutral' || a === 'grey') && (b === 'neutral' || b === 'grey')) return true;
    return false;
}

function computeScore(p, t) {
    const shadePenalty = isShadeMatch(p.Shade, t.Shade) ? 0 : 500000;
    const shgcDev = Math.abs((p.SHGC || 0) - (t.SHGC || 0)) * 10000;
    const vltDev = Math.abs((p.VLT || 0) - (t.VLT || 0)) * 500;
    const uDev = Math.abs((p.UValue || 0) - (t.UValue || 0)) * 2000;
    const erDev = Math.abs((p.ER || 0) - (t.ER || 0)) * 100;
    const irDev = Math.abs((p.IR || 0) - (t.IR || 0)) * 100;
    return shadePenalty + shgcDev + vltDev + uDev + erDev + irDev;
}

function analyzeGap() {
    const analysis = {
        summary: {
            totalCompetitionProducts: competitionProducts.length,
            totalSGProducts: sgProducts.length,
            gapsFound: 0,
            brandsAnalyzed: [...new Set(competitionProducts.map(p => p.Brand))]
        },
        gaps: []
    };

    competitionProducts.forEach(target => {
        // Filter pool by GlazingType and Standard
        const pool = sgProducts.filter(p => 
            p.GlazingType === target.GlazingType && 
            p.Standard === target.Standard
        );

        if (pool.length === 0) {
            analysis.gaps.push({
                type: 'Glazing/Standard Mismatch',
                target: target,
                reason: `No SG products found for ${target.GlazingType} / ${target.Standard}`
            });
            return;
        }

        // Find best match
        const matches = pool.map(p => ({
            product: p,
            score: computeScore(p, target),
            ratioDiff: (p.VLT / (p.SHGC || 1)) - (target.VLT / (target.SHGC || 1))
        })).sort((a, b) => a.score - b.score);

        const bestMatch = matches[0];

        // Define a gap: 
        // 1. If the best score is very high (> 100000 means shade mismatch or massive performance gap)
        // 2. If the ratioDiff is significantly negative (SG is much worse)
        
        let isGap = false;
        let gapReason = '';

        if (bestMatch.score > 20000) { // Arbitrary threshold for "poor match"
            isGap = true;
            gapReason = 'High Deviation: No SG product closely matches these technical specifications.';
        } else if (bestMatch.ratioDiff < -0.15) { // SG is > 15% worse in selectivity
            isGap = true;
            gapReason = 'Performance Gap: SG lacks a product with comparable selectivity (VLT/SHGC).';
        }

        if (isGap) {
            analysis.gaps.push({
                type: 'Technical Gap',
                target: target,
                bestSGMatch: bestMatch.product,
                score: bestMatch.score,
                ratioDiff: bestMatch.ratioDiff,
                reason: gapReason
            });
        }
    });

    analysis.summary.gapsFound = analysis.gaps.length;

    // Save report
    const outputPath = path.join(__dirname, 'gap_report.json');
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));

    // Generate MD summary
    let md = `# Gap Analysis Report\n\n`;
    md += `## Summary\n`;
    md += `- **Total Competition Products:** ${analysis.summary.totalCompetitionProducts}\n`;
    md += `- **Total SG Products:** ${analysis.summary.totalSGProducts}\n`;
    md += `- **Gaps Identified:** ${analysis.summary.gapsFound}\n`;
    md += `- **Brands Analyzed:** ${analysis.summary.brandsAnalyzed.join(', ')}\n\n`;

    md += `## Detailed Gaps\n\n`;
    analysis.gaps.forEach((gap, index) => {
        md += `### ${index + 1}. ${gap.target.Brand} - ${gap.target.ProductName}\n`;
        md += `- **Type:** ${gap.type}\n`;
        md += `- **Target Specs:** Shade: ${gap.target.Shade}, Glazing: ${gap.target.GlazingType}, VLT: ${gap.target.VLT}, SHGC: ${gap.target.SHGC}, UValue: ${gap.target.UValue}\n`;
        if (gap.bestSGMatch) {
            md += `- **Best SG Match:** ${gap.bestSGMatch.ProductName} (Score: ${Math.round(gap.score)})\n`;
            md += `- **Selectivity Diff:** ${(gap.ratioDiff * 100).toFixed(1)}%\n`;
        }
        md += `- **Reason:** ${gap.reason}\n\n`;
    });

    fs.writeFileSync(path.join(__dirname, 'gap_analysis.md'), md);
    console.log(`Analysis complete. Found ${analysis.summary.gapsFound} gaps.`);
}

analyzeGap();
