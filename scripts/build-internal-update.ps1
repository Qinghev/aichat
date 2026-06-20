param(
    [Parameter(Mandatory = $true)]
    [int]$VersionCode,

    [Parameter(Mandatory = $true)]
    [string]$VersionName,

    [string]$BaseUrl = "https://your-domain.example/aichat",

    [string]$Notes = "Internal test update"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$gradlePath = Join-Path $repoRoot "android\app\build.gradle"
$releaseDir = Join-Path $repoRoot "release"
$docsDir = Join-Path $repoRoot "docs"
$apkName = "AIChatSandbox-debug.apk"
$apkPath = Join-Path $releaseDir $apkName
$manifestPath = Join-Path $releaseDir "update.json"
$indexPath = Join-Path $releaseDir "index.html"
$noJekyllPath = Join-Path $releaseDir ".nojekyll"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$base = $BaseUrl.TrimEnd("/")
$previousUpdateManifestUrl = $env:VITE_UPDATE_MANIFEST_URL

$gradle = Get-Content -Raw -Path $gradlePath
$gradle = $gradle -replace "versionCode\s+\d+", "versionCode $VersionCode"
$gradle = $gradle -replace 'versionName\s+"[^"]+"', "versionName `"$VersionName`""
[System.IO.File]::WriteAllText($gradlePath, $gradle, $utf8NoBom)

Push-Location $repoRoot
try {
    $env:VITE_UPDATE_MANIFEST_URL = "$base/update.json"
    npm.cmd run android:debug
    if ($LASTEXITCODE -ne 0) { throw "Android debug build failed with exit code $LASTEXITCODE" }
    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
    Copy-Item -Force ".\android\app\build\outputs\apk\debug\app-debug.apk" $apkPath

    $hash = (Get-FileHash $apkPath -Algorithm SHA256).Hash
    $manifest = [ordered]@{
        versionCode = $VersionCode
        versionName = $VersionName
        apkUrl = "$base/$apkName"
        sha256 = $hash
        notes = $Notes
        mandatory = $false
        createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), $utf8NoBom)
    [System.IO.File]::WriteAllText(
        $indexPath,
        "<!doctype html><meta charset=`"utf-8`"><title>WeChat Update</title><pre>Internal update channel. APK: $apkName</pre>",
        $utf8NoBom
    )
    [System.IO.File]::WriteAllText($noJekyllPath, "", $utf8NoBom)

    New-Item -ItemType Directory -Force -Path $docsDir | Out-Null
    Copy-Item -Force $apkPath (Join-Path $docsDir $apkName)
    Copy-Item -Force $manifestPath (Join-Path $docsDir "update.json")
    Copy-Item -Force $indexPath (Join-Path $docsDir "index.html")
    Copy-Item -Force $noJekyllPath (Join-Path $docsDir ".nojekyll")

    Write-Host "Built $apkPath"
    Write-Host "Generated $manifestPath"
    Write-Host "Generated $indexPath"
    Write-Host "Copied update site files to $docsDir"
    Write-Host "Update manifest url embedded in APK: $base/update.json"
} finally {
    $env:VITE_UPDATE_MANIFEST_URL = $previousUpdateManifestUrl
    Pop-Location
}
