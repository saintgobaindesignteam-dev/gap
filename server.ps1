$port = 8080
$path = "c:\Users\K7813444\OneDrive - Saint-Gobain\Desktop\2026\ACE"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Listening on port $port..."

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $localPath = Join-Path $path $request.Url.LocalPath.Replace("/", "\")
    if ($localPath -eq "$path\") {
        $localPath = Join-Path $path "index.html"
    }

    if (Test-Path $localPath) {
        $content = [System.IO.File]::ReadAllBytes($localPath)
        $response.ContentLength64 = $content.Length
        
        # basic mime types
        if ($localPath -match "\.html$") { $response.ContentType = "text/html" }
        elseif ($localPath -match "\.css$") { $response.ContentType = "text/css" }
        elseif ($localPath -match "\.js$") { $response.ContentType = "application/javascript" }
        elseif ($localPath -match "\.json$") { $response.ContentType = "application/json" }
        
        $response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $response.StatusCode = 404
    }
    $response.Close()
}
