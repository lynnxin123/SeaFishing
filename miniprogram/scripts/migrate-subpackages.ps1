# Move low-traffic pages into subpackages to shrink main package.
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File D:\SeaFishing\miniprogram\scripts\migrate-subpackages.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

New-Item -ItemType Directory -Force -Path packageOrder\pages, packageEvent\pages | Out-Null

$orderPages = @('booking-orders', 'event-orders', 'map-favorites', 'boat-favorites')
$eventPages = @('event-detail', 'event-register', 'event-feature')

foreach ($p in $orderPages) {
  if (Test-Path "pages\$p") {
    Move-Item -Path "pages\$p" -Destination "packageOrder\pages\$p" -Force
    Write-Host "Moved pages\$p -> packageOrder\pages\$p"
  }
}

foreach ($p in $eventPages) {
  if (Test-Path "pages\$p") {
    Move-Item -Path "pages\$p" -Destination "packageEvent\pages\$p" -Force
    Write-Host "Moved pages\$p -> packageEvent\pages\$p"
  }
}

$jsFiles = Get-ChildItem -Recurse packageOrder, packageEvent -Filter *.js -ErrorAction SilentlyContinue
foreach ($f in $jsFiles) {
  $text = Get-Content $f.FullName -Raw -Encoding UTF8
  $new = $text -replace "require\('\.\./\.\./", "require('../../../"
  if ($new -ne $text) {
    [System.IO.File]::WriteAllText($f.FullName, $new, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Patched requires in $($f.Name)"
  }
}

$pathFiles = @(
  'utils\bookingOrders.js',
  'utils\eventService.js',
  'pages\my\my.js'
)
$replacements = @{
  '/pages/booking-orders/booking-orders' = '/packageOrder/pages/booking-orders/booking-orders'
  '/pages/event-orders/event-orders'       = '/packageOrder/pages/event-orders/event-orders'
  '/pages/map-favorites/map-favorites'     = '/packageOrder/pages/map-favorites/map-favorites'
  '/pages/boat-favorites/boat-favorites'   = '/packageOrder/pages/boat-favorites/boat-favorites'
  '/pages/event-detail/event-detail'       = '/packageEvent/pages/event-detail/event-detail'
  '/pages/event-register/event-register'   = '/packageEvent/pages/event-register/event-register'
  '/pages/event-feature/event-feature'     = '/packageEvent/pages/event-feature/event-feature'
}
foreach ($rel in $pathFiles) {
  $full = Join-Path $root $rel
  if (-not (Test-Path $full)) { continue }
  $text = Get-Content $full -Raw -Encoding UTF8
  $new = $text
  foreach ($kv in $replacements.GetEnumerator()) {
    $new = $new.Replace($kv.Key, $kv.Value)
  }
  if ($new -ne $text) {
    [System.IO.File]::WriteAllText($full, $new, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Updated paths in $rel"
  }
}

$appJsonPath = Join-Path $root 'app.json'
$app = Get-Content $appJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$remove = $orderPages + $eventPages | ForEach-Object { "pages/$_/$_" }
$app.pages = @($app.pages | Where-Object { $_ -notin $remove })
$app | Add-Member -NotePropertyName subPackages -NotePropertyValue @(
  @{
    root  = 'packageOrder'
    pages = $orderPages | ForEach-Object { "pages/$_/$_" }
  },
  @{
    root  = 'packageEvent'
    pages = $eventPages | ForEach-Object { "pages/$_/$_" }
  }
) -Force
$json = $app | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($appJsonPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Updated app.json with subPackages'

Write-Host ''
Write-Host 'Done. Rebuild in WeChat DevTools and test navigation from My page.'
