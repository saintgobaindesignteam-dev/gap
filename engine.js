// ===== SCORING ENGINE =====
// Loads product data and implements the matching/ranking algorithm

window.GlassEngine = (function() {
  let ALL_PRODUCTS = [];

  async function loadData() {
    try {
      // Try to fetch from Supabase first
      const { data, error } = await SG_Auth.client.from('products').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        // Map snake_case to CamelCase used in the app
        ALL_PRODUCTS = data.map(p => ({
          Brand: p.brand,
          Standard: p.standard,
          Shade: p.shade,
          GlazingType: p.glazing_type,
          ProductName: p.product_name,
          VLT: p.vlt,
          ER: p.er,
          IR: p.ir,
          SHGC: p.shgc,
          UValue: p.u_value
        }));
        console.log('Data loaded from Supabase:', ALL_PRODUCTS.length);
        return ALL_PRODUCTS;
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to local products.json', err);
    }

    const resp = await fetch('products.json');
    ALL_PRODUCTS = await resp.json();
    return ALL_PRODUCTS;
  }

  function getProducts() { return ALL_PRODUCTS; }

  function getCompetitorProducts() {
    return ALL_PRODUCTS.filter(p => p.Brand !== 'Saint-Gobain');
  }

  function getSGProducts() {
    return ALL_PRODUCTS.filter(p => p.Brand === 'Saint-Gobain');
  }

  function getUniqueValues(field) {
    return [...new Set(ALL_PRODUCTS.map(p => p[field]).filter(Boolean))].sort();
  }

  function getProductsByBrand(brand) {
    return ALL_PRODUCTS.filter(p => p.Brand === brand);
  }

  // Helper to check if shades match, treating Neutral and Grey as equivalent
  function isShadeMatch(shade1, shade2) {
    if (!shade1 || !shade2) return true;
    if (shade1 === shade2) return true;
    const s1 = shade1.toLowerCase();
    const s2 = shade2.toLowerCase();
    if ((s1 === 'neutral' || s1 === 'grey') && (s2 === 'neutral' || s2 === 'grey')) return true;
    return false;
  }

  // Core scoring formula (lower = better match)
  // Priority: 1. Glazing/Standard 2. Shade 3. SHGC / VLT (Balanced) 4. ER 5. IR 6. UValue
  function computeScore(product, target) {
    const shadePenalty = isShadeMatch(product.Shade, target.Shade) ? 0 : 1000000;
    // A 0.01 deviation in SHGC (100 pts) is balanced against a 1% deviation in VLT (100 pts)
    const shgcDev = Math.abs((product.SHGC || 0) - (target.SHGC || 0)) * 10000;
    const vltDev = Math.abs((product.VLT || 0) - (target.VLT || 0)) * 100;
    const erDev = Math.abs((product.ER || 0) - (target.ER || 0)) * 60;
    const irDev = Math.abs((product.IR || 0) - (target.IR || 0)) * 40;
    const uDev = Math.abs((product.UValue || 0) - (target.UValue || 0)) * 10;
    return shadePenalty + shgcDev + vltDev + erDev + irDev + uDev;
  }

  // Classification logic
  function classify(product, target) {
    const betterSHGC = (product.SHGC || 0) < (target.SHGC || 0);
    const betterU = (product.UValue || 0) < (target.UValue || 0);
    const betterVLT = (product.VLT || 0) > (target.VLT || 0);

    const worseSHGC = (product.SHGC || 0) > (target.SHGC || 0);
    const worseU = (product.UValue || 0) > (target.UValue || 0);
    const worseVLT = (product.VLT || 0) < (target.VLT || 0);

    const hasBetter = betterSHGC || betterU || betterVLT;
    const hasWorse = worseSHGC || worseU || worseVLT;

    if (hasBetter && !hasWorse) return 'superior';
    if (hasWorse && !hasBetter) return 'inferior';
    return 'closest';
  }

  // Generate smart explanations
  function getExplanations(product, target) {
    const explanations = [];
    const dSHGC = (product.SHGC || 0) - (target.SHGC || 0);
    const dU = (product.UValue || 0) - (target.UValue || 0);
    const dVLT = (product.VLT || 0) - (target.VLT || 0);

    if (dSHGC < -0.02) explanations.push('Lower SHGC → better solar control');
    else if (dSHGC > 0.02) explanations.push('Higher SHGC → less solar control');
    else explanations.push('Similar SHGC → equivalent solar performance');

    if (dU < -0.3) explanations.push('Lower U-value → better insulation');
    else if (dU > 0.3) explanations.push('Higher U-value → less insulation');
    else explanations.push('Similar U-value → equivalent insulation');

    if (dVLT > 3) explanations.push('Higher VLT → better daylight transmission');
    else if (dVLT < -3) explanations.push('Lower VLT → less daylight');
    else explanations.push('Similar VLT → equivalent daylight');

    return explanations;
  }

  // Get recommendation tags
  function getRecTags(product) {
    const tags = [];
    if ((product.VLT || 0) >= 50) tags.push('daylight');
    if ((product.UValue || 0) <= 1.8 || (product.SHGC || 0) <= 0.25) tags.push('energy');
    if ((product.UValue || 0) >= 2.5 && (product.SHGC || 0) >= 0.3) tags.push('cost');
    return tags;
  }

  // Main search function - returns top 3 SG matches
  function findMatches(target) {
    // Step 1: Hard filters based on Priority list
    // 1. SGU/DGU and Standard (Exact)
    // 2. Shade (Exact)
    // 3. SHGC +-0.05
    // 4. VLT +-5%
    // 5. ER +-5%
    // 6. IR +-5%
    
    const applyFilters = (levels) => {
      return ALL_PRODUCTS.filter(p => {
        if (p.Brand !== 'Saint-Gobain') return false;
        if (target.GlazingType && p.GlazingType !== target.GlazingType) return false;
        if (target.Standard && p.Standard !== target.Standard) return false;
        
        if (levels.strictShade && target.Shade && !isShadeMatch(p.Shade, target.Shade)) return false;
        if (levels.strictSHGC && target.SHGC !== undefined && Math.abs((p.SHGC || 0) - target.SHGC) > 0.05) return false;
        if (levels.strictVLT && target.VLT !== undefined && Math.abs((p.VLT || 0) - target.VLT) > 5) return false;
        if (levels.strictER && target.ER !== undefined && Math.abs((p.ER || 0) - target.ER) > 5) return false;
        if (levels.strictIR && target.IR !== undefined && Math.abs((p.IR || 0) - target.IR) > 5) return false;
        
        return true;
      });
    };

    // Try most strict first
    let candidates = applyFilters({ strictShade: true, strictSHGC: true, strictVLT: true, strictER: true, strictIR: true });
    
    // Relax from lowest priority (IR) upwards
    if (candidates.length < 3) {
      candidates = applyFilters({ strictShade: true, strictSHGC: true, strictVLT: true, strictER: true, strictIR: false });
    }
    if (candidates.length < 3) {
      candidates = applyFilters({ strictShade: true, strictSHGC: true, strictVLT: true, strictER: false, strictIR: false });
    }
    if (candidates.length < 3) {
      // Drop BOTH SHGC and VLT strict filters simultaneously to allow balanced mathematical scoring
      candidates = applyFilters({ strictShade: true, strictSHGC: false, strictVLT: false, strictER: false, strictIR: false });
    }

    // If still no results, return empty or whatever matches Brand + Glazing + Standard + Shade
    // (We do NOT relax Shade anymore as per user request)
    if (candidates.length === 0) {
      candidates = applyFilters({ strictShade: true, strictSHGC: false, strictVLT: false, strictER: false, strictIR: false });
    }

    // Step 2: Score all candidates
    const scored = candidates.map(p => ({
      ...p,
      score: computeScore(p, target),
      classification: classify(p, target),
      explanations: getExplanations(p, target),
      recTags: getRecTags(p)
    }));

    // Step 3: Sort by score ascending, return top 3
    scored.sort((a, b) => a.score - b.score);
    const top3 = scored.slice(0, 3);

    // Ensure the lowest score is tagged as 'closest' if not superior
    if (top3.length > 0 && top3[0].classification !== 'superior') {
      top3[0].classification = 'closest';
    }

    return top3;
  }

  // Export functions for PDF
  function exportPDF(results, target) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(0, 70, 173);
    doc.text('Saint-Gobain Glass Comparator', 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Generated: ' + new Date().toLocaleDateString(), 20, 28);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Target Profile:', 20, 42);
    doc.setFontSize(9);
    const tVals = [
      'SHGC: ' + (target.SHGC || '-'),
      'VLT: ' + (target.VLT || '-') + '%',
      'U-Value: ' + (target.UValue || '-'),
      'Shade: ' + (target.Shade || '-'),
      'Glazing: ' + (target.GlazingType || '-')
    ].join('  |  ');
    doc.text(tVals, 20, 50);

    let y = 65;
    results.forEach((r, i) => {
      doc.setFontSize(12);
      doc.setTextColor(0, 70, 173);
      doc.text('#' + (i + 1) + ' ' + r.ProductName + ' (' + r.classification.toUpperCase() + ')', 20, y);
      y += 8;
      doc.setFontSize(9);
      doc.setTextColor(60);
      const vals = 'SHGC: ' + r.SHGC + ' | VLT: ' + r.VLT + '% | ER: ' + r.ER + '% | IR: ' + r.IR + '% | U: ' + r.UValue;
      doc.text(vals, 20, y);
      y += 6;
      doc.text('Shade: ' + r.Shade + ' | Glazing: ' + r.GlazingType + ' | Score: ' + r.score.toFixed(1), 20, y);
      y += 8;
      r.explanations.forEach(e => { doc.text('  → ' + e, 20, y); y += 5; });
      y += 8;
    });

    doc.save('SG_Comparator_Results.pdf');
  }

  // Export to Excel
  function exportExcel(results, target) {
    const data = results.map((r, i) => ({
      'Rank': i + 1,
      'Product': r.ProductName,
      'Classification': r.classification.toUpperCase(),
      'Shade': r.Shade,
      'VLT (%)': r.VLT,
      'SHGC': r.SHGC,
      'ER (%)': r.ER,
      'IR (%)': r.IR,
      'U-Value': r.UValue,
      'Glazing': r.GlazingType,
      'Standard': r.Standard,
      'Score': Math.round(r.score * 10) / 10,
      'Insights': r.explanations.join('; ')
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.utils.sheet_add_aoa(ws, [['Target Shade: ' + (target.Shade || ''), 'Target VLT: ' + (target.VLT || ''), 'Target SHGC: ' + (target.SHGC || '')]], { origin: 'A' + (data.length + 3) });
    XLSX.writeFile(wb, 'SG_Comparator_Results.xlsx');
  }

  return { loadData, getProducts, getCompetitorProducts, getSGProducts, getUniqueValues, getProductsByBrand, findMatches, computeScore, classify, exportPDF, exportExcel };
})();
