# Move login/verify/agreement/messages/ship-detail into subpackages.
# Run: powershell -ExecutionPolicy Bypass -File D:\SeaFishing\miniprogram\scripts\migrate-extra-subpackages.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

New-Item -ItemType Directory -Force -Path packageUser\pages, packageBoat\pages | Out-Null

$userPages = @('login', 'verify', 'agreement', 'messages')
$boatPages = @('ship-detail')

foreach ($p in $userPages) {
  if (Test-Path "pages\$p") {
    Move-Item -Path "pages\$p" -Destination "packageUser\pages\$p" -Force
    Write-Host "Moved pages\$p -> packageUser\pages\$p"
  }
}

foreach ($p in $boatPages) {
  if (Test-Path "pages\$p") {
    Move-Item -Path "pages\$p" -Destination "packageBoat\pages\$p" -Force
    Write-Host "Moved pages\$p -> packageBoat\pages\$p"
  }
}

$jsFiles = Get-ChildItem -Recurse packageUser, packageBoat -Filter *.js -ErrorAction SilentlyContinue
foreach ($f in $jsFiles) {
  $text = Get-Content $f.FullName -Raw -Encoding UTF8
  $new = $text -replace "require\('\.\./\.\./", "require('../../../"
  if ($new -ne $text) {
    [System.IO.File]::WriteAllText($f.FullName, $new, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Patched requires in $($f.Name)"
  }
}

$pathFiles = @(
  'utils\auth.js',
  'utils\bookingNavigate.js',
  'pages\boat\boat.js',
  'pages\my\my.js',
  'packageOrder\pages\boat-favorites\boat-favorites.js'
)
$replacements = @{
  '/pages/login/login' = '/packageUser/pages/login/login'
  '/pages/verify/verify' = '/packageUser/pages/verify/verify'
  '/pages/agreement/agreement' = '/packageUser/pages/agreement/agreement'
  '/pages/messages/messages' = '/packageUser/pages/messages/messages'
  '/pages/ship-detail/ship-detail' = '/packageBoat/pages/ship-detail/ship-detail'
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
$remove = $userPages + $boatPages | ForEach-Object { "pages/$_/$_" }
$app.pages = @($app.pages | Where-Object { $_ -notin $remove })
$existing = @($app.subPackages)
$existing += @(
  @{
    root  = 'packageUser'
    pages = $userPages | ForEach-Object { "pages/$_/$_" }
  },
  @{
    root  = 'packageBoat'
    pages = $boatPages | ForEach-Object { "pages/$_/$_" }
  }
)
$app | Add-Member -NotePropertyName subPackages -NotePropertyValue $existing -Force
$app | Add-Member -NotePropertyName preloadRule -NotePropertyValue @{
  'pages/boat/boat' = @{ network = 'all'; packages = @('packageBoat') }
  'pages/my/my'     = @{ network = 'wifi'; packages = @('packageOrder') }
} -Force
$json = $app | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($appJsonPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Updated app.json'

Write-Host 'Done. Rebuild in WeChat DevTools.'
