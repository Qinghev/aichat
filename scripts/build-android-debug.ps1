$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$jdkRoot = Join-Path $root ".tools\jdk21"
$sdkRoot = Join-Path $root ".tools\android-sdk"
$gradleBin = Join-Path $root ".tools\gradle-8.11.1\bin\gradle.bat"

if (-not (Test-Path $jdkRoot)) {
  throw "Missing local JDK 21 at $jdkRoot"
}

if (-not (Test-Path $sdkRoot)) {
  throw "Missing local Android SDK at $sdkRoot"
}

if (-not (Test-Path $gradleBin)) {
  throw "Missing local Gradle at $gradleBin"
}

$jdk = Get-ChildItem $jdkRoot -Directory | Select-Object -First 1 -ExpandProperty FullName

$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:Path = "$jdk\bin;$sdkRoot\cmdline-tools\latest\bin;$sdkRoot\platform-tools;$env:Path"

Push-Location $root
try {
  npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "npm build failed with exit code $LASTEXITCODE" }
  npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed with exit code $LASTEXITCODE" }
  & $gradleBin -p android assembleDebug --no-daemon --offline
  if ($LASTEXITCODE -ne 0) { throw "Gradle assembleDebug failed with exit code $LASTEXITCODE" }
}
finally {
  Pop-Location
}
