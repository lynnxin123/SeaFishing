# Repair subpackage page files and remove legacy duplicates under pages/.
# Run: powershell -ExecutionPolicy Bypass -File D:\SeaFishing\miniprogram\scripts\repair-subpackages.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$maps = @(
  @{ Legacy = 'pages\booking-orders'; Target = 'packageOrder\pages\booking-orders' },
  @{ Legacy = 'pages\event-orders'; Target = 'packageOrder\pages\event-orders' },
  @{ Legacy = 'pages\map-favorites'; Target = 'packageOrder\pages\map-favorites' },
  @{ Legacy = 'pages\boat-favorites'; Target = 'packageOrder\pages\boat-favorites' },
  @{ Legacy = 'pages\event-detail'; Target = 'packageEvent\pages\event-detail' },
  @{ Legacy = 'pages\event-register'; Target = 'packageEvent\pages\event-register' },
  @{ Legacy = 'pages\event-feature'; Target = 'packageEvent\pages\event-feature' },
  @{ Legacy = 'pages\login'; Target = 'packageUser\pages\login' },
  @{ Legacy = 'pages\verify'; Target = 'packageUser\pages\verify' },
  @{ Legacy = 'pages\agreement'; Target = 'packageUser\pages\agreement' },
  @{ Legacy = 'pages\messages'; Target = 'packageUser\pages\messages' },
  @{ Legacy = 'pages\ship-detail'; Target = 'packageBoat\pages\ship-detail' }
)

foreach ($m in $maps) {
  $legacy = Join-Path $root $m.Legacy
  $target = Join-Path $root $m.Target
  if (-not (Test-Path $legacy)) { continue }

  New-Item -ItemType Directory -Force -Path $target | Out-Null
  Copy-Item -Path (Join-Path $legacy '*') -Destination $target -Force -ErrorAction SilentlyContinue
  Write-Host "Synced $($m.Legacy) -> $($m.Target)"

  Remove-Item -Recurse -Force $legacy
  Write-Host "Removed legacy $($m.Legacy)"
}

Write-Host ''
Write-Host 'Repair done. In WeChat DevTools: Project -> Clear cache -> Recompile.'
