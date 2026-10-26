param([Parameter(Mandatory=$true)][string]$ApiBaseUrl)
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\..\frontend\scripts\build-final.ps1" -ApiBaseUrl $ApiBaseUrl
