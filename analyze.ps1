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
    
    $p_shgc = if ($null -ne $p.SHGC) { [double]$p.SHGC } else { 0 }
    $t_shgc = if ($null -ne $t.SHGC) { [double]$t.SHGC } else { 0 }
    $shgcDev = [Math]::Abs($p_shgc - $t_shgc) * 10000
    
    $p_vlt = if ($null -ne $p.VLT) { [double]$p.VLT } else { 0 }
    $t_vlt = if ($null -ne $t.VLT) { [double]$t.VLT } else { 0 }
    $vltDev = [Math]::Abs($p_vlt - $t_vlt) * 500
    
    $p_u = if ($null -ne $p.UValue) { [double]$p.UValue } else { 0 }
    $t_u = if ($null -ne $t.UValue) { [double]$t.UValue } else { 0 }
    $uDev = [Math]::Abs($p_u - $t_u) * 2000
    
    $p_er = if ($null -ne $p.ER) { [double]$p.ER } else { 0 }
    $t_er = if ($null -ne $t.ER) { [double]$t.ER } else { 0 }
    $erDev = [Math]::Abs($p_er - $t_er) * 100
    
    $p_ir = if ($null -ne $p.IR) { [double]$p.IR } else { 0 }
    $t_ir = if ($null -ne $t.IR) { [double]$t.IR } else { 0 }
    $irDev = [Math]::Abs($p_ir - $t_ir) * 100
    
    return $shadePenalty + $shgcDev + $vltDev + $uDev + $erDev + $irDev
}

$gaps = @()
foreach ($target in $competitionProducts) {
    $pool = $sgProducts | Where-Object { $_.GlazingType -eq $target.GlazingType -and $_.Standard -eq $target.Standard }
    
    if ($pool.Count -eq 0) {
        $gaps += [PSCustomObject]@{
            Brand = $target.Brand
            Product = $target.ProductName
            Type = "Mismatch"
            Reason = "No SG products for $($target.GlazingType) / $($target.Standard)"
            Target = $target
            BestMatch = $null
            Score = 1000000
            Diff = 0
        }
        continue
    }

    $bestMatch = $null
    $bestScore = 1000000000
    
    foreach ($p in $pool) {
        $score = Compute-Score $p $target
        if ($score -lt $bestScore) {
            $bestScore = $score
            $bestMatch = $p
        }
    }

    $targetVLT = if ($null -ne $target.VLT) { [double]$target.VLT } else { 0 }
    $targetSHGC = if ($null -ne $target.SHGC -and [double]$target.SHGC -ne 0) { [double]$target.SHGC } else { 1 }
    $tRatio = $targetVLT / $targetSHGC
    
    $bestVLT = if ($null -ne $bestMatch.VLT) { [double]$bestMatch.VLT } else { 0 }
    $bestSHGC = if ($null -ne $bestMatch.SHGC -and [double]$bestMatch.SHGC -ne 0) { [double]$bestMatch.SHGC } else { 1 }
    $pRatio = $bestVLT / $bestSHGC
    
    $ratioDiff = $pRatio - $tRatio

    $isGap = $false
    $gapReason = ""

    if ($bestScore -gt 25000) {
        $isGap = $true
        $gapReason = "No SG product closely matches these technical specifications."
    } elseif ($ratioDiff -lt -0.15) {
        $isGap = $true
        $gapReason = "SG lacks a product with comparable selectivity (VLT/SHGC)."
    }

    if ($isGap) {
        $gaps += [PSCustomObject]@{
            Brand = $target.Brand
            Product = $target.ProductName
            Type = "Technical"
            Reason = $gapReason
            Target = $target
            BestMatch = $bestMatch
            Score = [Math]::Round($bestScore)
            Diff = [Math]::Round($ratioDiff * 100, 1)
        }
    }
}

$jsonOutput = @{
    summary = @{
        totalCompetitors = $competitionProducts.Count
        totalSG = $sgProducts.Count
        totalGaps = $gaps.Count
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    gaps = $gaps
}

$jsonOutput | ConvertTo-Json -Depth 5 | Out-File -FilePath "c:\Users\K7813444\OneDrive - Saint-Gobain\Desktop\2026\ACE\gap\gap_data.json" -Encoding utf8
Write-Host "Analysis complete. JSON saved."
