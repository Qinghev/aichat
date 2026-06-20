param(
    [string]$Remote = "origin",
    [string]$MainBranch = "master",
    [string]$PagesBranch = "gh-pages",
    [string]$CommitMessage = "Prepare internal Android app update channel",
    [string]$UserName = "qinghe",
    [string]$UserEmail = "qinghe@example.local"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$deployDir = Join-Path $repoRoot ".deploy-gh-pages"
$docsDir = Join-Path $repoRoot "docs"

Push-Location $repoRoot
try {
    if (-not (Test-Path $docsDir)) {
        throw "Missing docs directory. Run scripts/build-internal-update.ps1 first."
    }

    $remoteUrl = (git remote get-url $Remote).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $remoteUrl) {
        throw "Unable to read git remote '$Remote'."
    }

    git config user.name $UserName
    git config user.email $UserEmail

    git add -A
    if ($LASTEXITCODE -ne 0) { throw "git add failed." }

    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "No source changes to commit."
    } else {
        git commit -m $CommitMessage
        if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
    }

    git push $Remote $MainBranch
    if ($LASTEXITCODE -ne 0) { throw "git push $Remote $MainBranch failed." }

    if (Test-Path $deployDir) {
        Remove-Item -LiteralPath $deployDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $deployDir | Out-Null
    Copy-Item -Path (Join-Path $docsDir "*") -Destination $deployDir -Recurse -Force
    Copy-Item -Path (Join-Path $docsDir ".nojekyll") -Destination $deployDir -Force

    Push-Location $deployDir
    try {
        git init
        git checkout -B $PagesBranch
        git config user.name $UserName
        git config user.email $UserEmail
        git add -A
        git commit -m "Deploy update site"
        git remote add origin $remoteUrl
        git push -f origin $PagesBranch
    } finally {
        Pop-Location
    }

    Write-Host "Published update site branch: $PagesBranch"
    Write-Host "Expected GitHub Pages URL: https://qinghev.github.io/aichat/update.json"
} finally {
    Pop-Location
}
