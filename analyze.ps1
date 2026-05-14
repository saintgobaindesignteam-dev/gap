$productsPath = "c:\Users\K7813444\OneDrive - Saint-Gobain\Desktop\2026\ACE\products.json"
$products = Get-Content $productsPath | ConvertFrom-Json

$sgProducts = $products | Where-Object { $_.Brand -eq "Saint-Gobain" }
$competitionProducts = $products | Where-Object { $_.Brand -ne "Saint-Gobain" }

function Is-ShadeMatch($s1, $s2) {
    if (-not $s1 -or -not $s2) { return $true }
    $a = $s1.ToString().ToLower()
    $b = $s2.ToString().ToLower()
    if ($a -eq $b) { return $true }
    if (($a -eq "neutral" -or $a -eq "grey") -and ($b -eq "neutral" -or $b -eq "grey")) { return $true }
    return $false
}

function Compute-Score($p, $t) {
    $shadePenalty = if (Is-ShadeMatch $p.Shade $t.Shade) { 0 } else { 500000 }
    $shgc_p = [double]$p.SHGC; $shgc_t = [double]$t.SHGC
    $vlt_p = [double]$p.VLT; $vlt_t = [double]$t.VLT
    $u_p = [double]$p.UValue; $u_t = [double]$t.UValue
    $shgcDev = [Math]::Abs($shgc_p - $shgc_t) * 10000
    $vltDev = [Math]::Abs($vlt_p - $vlt_t) * 500
    $uDev = [Math]::Abs($u_p - $u_t) * 2000
    return $shadePenalty + $shgcDev + $vltDev + $uDev
}

$results = New-Object System.Collections.Generic.List[PSObject]

foreach ($target in $competitionProducts) {
    $pool = $sgProducts | Where-Object { $_.GlazingType -eq $target.GlazingType -and $_.Standard -eq $target.Standard }
    
    if ($null -eq $pool -or $pool.Count -eq 0) {
        $results.Add([PSCustomObject]@{
            Brand = $target.Brand
            Product = $target.ProductName
            SWOT = "Opportunity"
            Reason = "No SG products in this segment ($($target.GlazingType)/$($target.Standard))."
            Target = $target
            BestMatch = $null
            Diff = 0
        })
        continue
    }

    $bestMatch = $null
    $bestScore = 1000000000
    foreach ($p in $pool) {
        $score = Compute-Score $p $target
        if ($score -lt $bestScore) { $bestScore = $score; $bestMatch = $p }
    }

    $t_shgc_adj = if ([double]$target.SHGC -eq 0) { 1 } else { [double]$target.SHGC }
    $tRatio = ([double]$target.VLT) / $t_shgc_adj
    $p_shgc_adj = if ([double]$bestMatch.SHGC -eq 0) { 1 } else { [double]$bestMatch.SHGC }
    $pRatio = ([double]$bestMatch.VLT) / $p_shgc_adj
    $ratioDiff = $pRatio - $tRatio

    $cat = "Weakness"
    $res = "SG performance is lower than competition."

    if ($bestScore -gt 100000) {
        $cat = "Threat"
        $res = "Critical Gap: High technical deviation or shade mismatch."
    } elseif ($ratioDiff -ge 0.00) {
        $cat = "Strength"
        $res = "SG product matches or outperforms competition selectivity."
    } elseif ($ratioDiff -lt -0.15) {
        $cat = "Threat"
        $res = "Significant performance gap (>15% selectivity difference)."
    }

    $results.Add([PSCustomObject]@{
        Brand = $target.Brand
        Product = $target.ProductName
        SWOT = $cat
        Reason = $res
        Target = $target
        BestMatch = $bestMatch
        Diff = [Math]::Round($ratioDiff * 100, 1)
    })
}

$summary = @{
    total = $results.Count
    strengths = ($results | Where-Object { $_.SWOT -eq "Strength" }).Count
    weaknesses = ($results | Where-Object { $_.SWOT -eq "Weakness" }).Count
    opportunities = ($results | Where-Object { $_.SWOT -eq "Opportunity" }).Count
    threats = ($results | Where-Object { $_.SWOT -eq "Threat" }).Count
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

$jsonOutput = @{
    summary = $summary
    items = $results
}

$jsonOutput | ConvertTo-Json -Depth 5 | Out-File -FilePath "c:\Users\K7813444\OneDrive - Saint-Gobain\Desktop\2026\ACE\gap\gap_data.json" -Encoding utf8
Write-Host "SWOT Analysis complete."
