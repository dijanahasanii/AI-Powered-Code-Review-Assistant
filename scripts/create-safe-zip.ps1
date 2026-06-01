# Creates a shareable project zip WITHOUT secrets, dependencies, or runtime artifacts.
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\create-safe-zip.ps1
# Optional:
#   powershell -File .\scripts\create-safe-zip.ps1 -OutputPath "C:\Backups\acr-safe.zip"

param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if (-not $OutputPath) {
  $stamp = Get-Date -Format "yyyy-MM-dd"
  $OutputPath = Join-Path $RepoRoot "AI-Code-Review-Assistant-safe-$stamp.zip"
} else {
  $OutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
}

$ExcludeDirNames = [System.Collections.Generic.HashSet[string]]::new(
  [string[]]@(
    "node_modules", ".git", "dist", "build", ".vite", "coverage", ".nyc_output",
    "logs", "reports", "test-results", ".idea"
  ),
  [StringComparer]::OrdinalIgnoreCase
)

$ExcludeFileNames = [System.Collections.Generic.HashSet[string]]::new(
  [string[]]@(".env", ".env.local", ".environment"),
  [StringComparer]::OrdinalIgnoreCase
)

$ExcludeFilePatterns = @("*.log", ".DS_Store", "Thumbs.db")

function Test-ExcludedFile([string]$Name) {
  if ($ExcludeFileNames.Contains($Name)) { return $true }
  foreach ($pat in $ExcludeFilePatterns) {
    if ($Name -like $pat) { return $true }
  }
  return $false
}

function Test-ExcludedPath([string]$FullPath) {
  $rel = $FullPath.Substring($RepoRoot.Length).TrimStart("\", "/")
  $parts = $rel -split "[\\/]"
  foreach ($part in $parts) {
    if ($ExcludeDirNames.Contains($part)) { return $true }
  }
  if ($parts.Length -gt 0 -and (Test-ExcludedFile $parts[-1])) { return $true }
  return $false
}

$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("acr-safe-zip-" + [Guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
  $files = Get-ChildItem -Path $RepoRoot -Recurse -File -Force |
    Where-Object { -not (Test-ExcludedPath $_.FullName) }

  $skipped = Get-ChildItem -Path $RepoRoot -Recurse -File -Force |
    Where-Object { Test-ExcludedPath $_.FullName }

  foreach ($file in $files) {
    $rel = $file.FullName.Substring($RepoRoot.Length).TrimStart("\", "/")
    $dest = Join-Path $staging $rel
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $file.FullName -Destination $dest -Force
  }

  if (Test-Path $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $OutputPath -CompressionLevel Optimal

  Write-Host ""
  Write-Host "Safe archive created:" -ForegroundColor Green
  Write-Host "  $OutputPath"
  Write-Host ""
  Write-Host "Included: $($files.Count) files"
  Write-Host "Excluded: $($skipped.Count) files (secrets, node_modules, reports, logs, etc.)"
  Write-Host ""
  Write-Host "Always excluded from this script:" -ForegroundColor Yellow
  Write-Host "  backend/.env, frontend/.env, any .env / .environment"
  Write-Host "  node_modules, backend/reports, logs, .git, build output"
  Write-Host ""
  Write-Host "Your local .env files were NOT copied. The app on this PC is unchanged."
}
finally {
  if (Test-Path $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
  }
}
