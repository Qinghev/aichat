param(
    [string]$Repo = "git@github.com:Qinghev/aichat.git",
    [string]$Branch = "gh-pages",
    [string]$Message = "Update internal Android build"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$releaseDir = Join-Path $repoRoot "release"
$deployDir = Join-Path $repoRoot ".deploy-gh-pages"

$required = @("AIChatSandbox-debug.apk", "update.json", "index.html", ".nojekyll")
foreach ($name in $required) {
    $path = Join-Path $releaseDir $name
    if (!(Test-Path $path)) {
        throw "Missing release file: $path"
    }
}

if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

foreach ($name in $required) {
    Copy-Item -Force (Join-Path $releaseDir $name) (Join-Path $deployDir $name)
}

Push-Location $deployDir
try {
    git init
    git checkout -b $Branch
    git remote add origin $Repo
    git add .
    git commit -m $Message
    git push -f origin $Branch
} finally {
    Pop-Location
}

Write-Host "Published update channel:"
Write-Host "https://qinghev.github.io/aichat/update.json"
