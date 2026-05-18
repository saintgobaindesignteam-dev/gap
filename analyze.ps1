$productsPath = "c:\Users\K7813444\OneDrive - Saint-Gobain\Desktop\2026\ACE\products.json"
$products = Get-Content $productsPath | ConvertFrom-Json

$sgProducts = $products | Where-Object { $_.Brand -eq "Saint-Gobain" }
$competitionProducts = $products | Where-Object { $_.Brand -ne "Saint-Gobain" }

function Get-CompRange($name, $brand) {
    if ($brand -eq "Asahi") {
        if ($name -match "Ecoscense Enhance") { return "ST" }
        if ($name -match "Ecoscense Edge")    { return "ET|SCN" }
        if ($name -match "Ecoscense Essence") { return "KT|KS|PLT" }
        if ($name -match "Ecoscense Exceed")  { return "SKN" }
        if ($name -match "Ecoscense Spectra") { return "SKN" }
    }
    if ($brand -eq "Guardian") {
        if ($name -match "Sun Guard Solar Plus")       { return "ET|SCN" }
        if ($name -match "Sun Guard Solar")            { return "ST" }
        if ($name -match "Sun Guard High Performance") { return "KT|KS|PLT" }
        if ($name -match "Sun Guard Double Silver")    { return "SKN" }
        if ($name -match "Sun Guard HD")               { return "ST" }
    }
    return $null
}

function Get-SGRange($name) {
    if ($name -like "ST *")  { return "ST" }
    if ($name -like "STB *") { return "ST" }
    if ($name -like "ET *")  { return "ET|SCN" }
    if ($name -like "SCN *") { return "ET|SCN" }
    if ($name -like "KT *")  { return "KT|KS|PLT" }
    if ($name -like "KS *")  { return "KT|KS|PLT" }
    if ($name -like "PLT*")  { return "KT|KS|PLT" }
    if ($name -like "KBRZ*") { return "KT|KS|PLT" }
    if ($name -like "KBT*")  { return "KT|KS|PLT" }
    if ($name -like "KG *")  { return "KT|KS|PLT" }
    if ($name -like "STR *") { return "KT|KS|PLT" }
    if ($name -like "STC *") { return "KT|KS|PLT" }
    if ($name -like "STG *") { return "KT|KS|PLT" }
    if ($name -like "SKN *") { return "SKN" }
    return "OTHER"
}

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
    $targetRange = Get-CompRange $target.ProductName $target.Brand
    
    # Filter SG products by range bridge
    $pool = $sgProducts | Where-Object { 
        $_.GlazingType -eq $target.GlazingType -and 
        $_.Standard -eq $target.Standard -and
        ($null -eq $targetRange -or (Get-SGRange $_.ProductName) -eq $targetRange)
    }
    
    if ($null -eq $pool -or $pool.Count -eq 0) {
        $results.Add([PSCustomObject]@{
            Brand = $target.Brand
            Product = $target.ProductName
            SWOT = "Opportunity"
            Reason = "No SG products in the bridged range ($targetRange) for this segment."
            Target = $target
            BestMatch = $null
            Diff = 0
            Range = $targetRange
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
    $tRatio = ([double]$target.VLT / 100) / $t_shgc_adj
    $p_shgc_adj = if ([double]$bestMatch.SHGC -eq 0) { 1 } else { [double]$bestMatch.SHGC }
    $pRatio = ([double]$bestMatch.VLT / 100) / $p_shgc_adj
    $ratioDiff = $pRatio - $tRatio

    $cat = "Weakness"
    $res = "SG performance in this range is lower than competition."

    if ($bestScore -gt 100000) {
        $cat = "Threat"
        $res = "Critical Gap: High deviation within the bridged SG range ($targetRange)."
    } elseif ($ratioDiff -ge 0.00) {
        $cat = "Strength"
        $res = "SG range match is technically equivalent or superior."
    } elseif ($ratioDiff -lt -0.15) {
        $cat = "Threat"
        $res = "Significant performance gap within the bridged range."
    }

    $results.Add([PSCustomObject]@{
        Brand = $target.Brand
        Product = $target.ProductName
        SWOT = $cat
        Reason = $res
        Target = $target
        BestMatch = $bestMatch
        Diff = [Math]::Round($ratioDiff * 100, 1)
        Range = $targetRange
        Standard = $target.Standard
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
    sgCatalog = $sgProducts | Select-Object ProductName, VLT, SHGC, UValue, Shade, Brand, Standard
}

$jsonOutput | ConvertTo-Json -Depth 5 | Out-File -FilePath "c:\Users\K7813444\OneDrive - Saint-Gobain\Desktop\2026\ACE\gap\gap_data.json" -Encoding utf8

$csvPath = "c:\Users\K7813444\OneDrive - Saint-Gobain\Desktop\2026\ACE\gap\gap_analysis.csv"
$results | ForEach-Object {
    [PSCustomObject]@{
        "Competitor Brand"     = $_.Brand
        "Competitor Product"   = $_.Product
        "SWOT Category"        = $_.SWOT
        "Strategic Reason"     = $_.Reason
        "Glazing Range"        = $_.Range
        "Standard"             = $_.Standard
        "Efficiency Delta (%)" = $_.Diff
        "Competitor VLT (%)"   = $_.Target.VLT
        "Competitor SHGC (SF)" = $_.Target.SHGC
        "Competitor U-Value"   = $_.Target.UValue
        "Competitor Shade"     = $_.Target.Shade
        "Matched SG Product"   = if ($_.BestMatch) { $_.BestMatch.ProductName } else { "NO MATCH" }
        "SG VLT (%)"           = if ($_.BestMatch) { $_.BestMatch.VLT } else { $null }
        "SG SHGC (SF)"         = if ($_.BestMatch) { $_.BestMatch.SHGC } else { $null }
        "SG U-Value"           = if ($_.BestMatch) { $_.BestMatch.UValue } else { $null }
        "SG Shade"             = if ($_.BestMatch) { $_.BestMatch.Shade } else { $null }
    }
} | Export-Csv -Path $csvPath -NoTypeInformation -Encoding utf8

Write-Host "SWOT Analysis with Bridge Logic complete."
Write-Host "CSV gap report exported to $csvPath"
