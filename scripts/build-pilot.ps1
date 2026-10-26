param([Parameter(Mandatory=$true)][string]$ApiBaseUrl)
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\..\frontend\scripts\build-pilot.ps1" -ApiBaseUrl $ApiBaseUrl
