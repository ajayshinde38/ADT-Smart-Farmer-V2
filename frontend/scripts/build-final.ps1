param([Parameter(Mandatory=$true)][string]$ApiBaseUrl)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$signingPath = Join-Path $projectRoot '.private\android-signing\signing.json'
if (!(Test-Path -LiteralPath $signingPath)) { throw 'Signing credentials are missing. Restore the private owner backup before building.' }
$signing = Get-Content -LiteralPath $signingPath -Raw | ConvertFrom-Json
$env:EXPO_PUBLIC_API_BASE_URL = $ApiBaseUrl.TrimEnd('/')
$env:ADT_BUILD_PROFILE = 'production'
$env:NODE_ENV = 'production'
$socketDirectory = Join-Path $projectRoot '.private\t'
New-Item -ItemType Directory -Force $socketDirectory | Out-Null
# A short process-local TEMP fixes Windows Java socket paths. Avoid
# JAVA_TOOL_OPTIONS: its stderr banner breaks Android's Prefab parser.
$shortSocketDirectory = (& cmd /c "for %I in (`"$socketDirectory`") do @echo %~sI").Trim()
$previousTemp = $env:TEMP
$previousTmp = $env:TMP
$env:TEMP = $shortSocketDirectory
$env:TMP = $shortSocketDirectory
Remove-Item Env:JAVA_OPTS -ErrorAction SilentlyContinue
Remove-Item Env:JAVA_TOOL_OPTIONS -ErrorAction SilentlyContinue
$env:JAVA_HOME = "C:\Program Files\Unity\Hub\Editor\6000.5.6f1\Editor\Data\PlaybackEngines\AndroidPlayer\OpenJDK"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$buildJvmArguments = '-Xmx4096m -XX:MaxMetaspaceSize=512m'
$env:ADT_ANDROID_STORE_FILE = Join-Path $projectRoot '.private\android-signing\pilot.keystore'
$env:ADT_ANDROID_STORE_PASSWORD = $signing.storePassword
$env:ADT_ANDROID_KEY_ALIAS = $signing.keyAlias
$env:ADT_ANDROID_KEY_PASSWORD = $signing.keyPassword
try {
    Push-Location "$projectRoot\frontend"
    node -e "require('./app.config.js')()"
    if ($LASTEXITCODE -ne 0) { throw 'Invalid standalone backend configuration.' }
    Set-Location android
    & .\gradlew.bat :app:assembleRelease --console=plain --max-workers=2 '-PreactNativeArchitectures=arm64-v8a,x86_64' "-Dorg.gradle.jvmargs=$buildJvmArguments"
    if ($LASTEXITCODE -ne 0) { throw 'Android APK build failed.' }
    $finalApkPath = "$projectRoot\artifacts\releases\ADT-Smart-Farmer-V2-2.1.0.apk"
    Copy-Item -LiteralPath 'app\build\outputs\apk\release\app-release.apk' -Destination $finalApkPath -Force
    Write-Host "Final APK built successfully: $finalApkPath"
} finally {
    Pop-Location
    $env:TEMP = $previousTemp
    $env:TMP = $previousTmp
    Remove-Item Env:ADT_ANDROID_STORE_PASSWORD,Env:ADT_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
}
