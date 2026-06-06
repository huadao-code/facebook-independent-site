param(
  [string]$HelperDir = '',
  [string]$OnlineUrl = 'https://www.lulufunnytoys.com'
)

$ErrorActionPreference = 'Stop'

$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dataDir = Join-Path $projectDir 'public\data'
$downloadDir = Join-Path $env:USERPROFILE 'Downloads'

function Write-Step($message) {
  Write-Host ''
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Invoke-Checked($file, $arguments, $workingDirectory) {
  Push-Location $workingDirectory
  try {
    & $file @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$file exited with code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Invoke-Retryable($file, $arguments, $workingDirectory, $attempts) {
  for ($attempt = 1; $attempt -le $attempts; $attempt += 1) {
    Push-Location $workingDirectory
    try {
      & $file @arguments
      if ($LASTEXITCODE -eq 0) {
        return $true
      }
    } finally {
      Pop-Location
    }

    if ($attempt -lt $attempts) {
      Write-Warning "$file failed. Retrying in 5 seconds..."
      Start-Sleep -Seconds 5
    }
  }

  return $false
}

function Get-SearchRoots {
  @($HelperDir, $downloadDir) |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
    Select-Object -Unique
}

function Find-NewestFile($fileName, $excludePath) {
  $candidates = foreach ($root in Get-SearchRoots) {
    Get-ChildItem -LiteralPath $root -Filter $fileName -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -ne $excludePath }
  }

  $candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

function Copy-NewerFile($fileName, $targetPath) {
  $source = Find-NewestFile $fileName $targetPath
  if (-not $source) {
    return $false
  }

  $target = Get-Item -LiteralPath $targetPath -ErrorAction SilentlyContinue
  if ($target -and $source.LastWriteTime -le $target.LastWriteTime) {
    return $false
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetPath) | Out-Null
  Copy-Item -LiteralPath $source.FullName -Destination $targetPath -Force
  Write-Host "Copied $fileName from $($source.DirectoryName)"
  return $true
}

function Copy-ReferencedAsset($webPath) {
  if ([string]::IsNullOrWhiteSpace($webPath)) {
    return
  }

  if ($webPath -match '^https?://') {
    return
  }

  if (-not $webPath.StartsWith('/products/') -and -not $webPath.StartsWith('/site/')) {
    return
  }

  $relativePath = $webPath.TrimStart('/').Replace('/', '\')
  $targetPath = Join-Path (Join-Path $projectDir 'public') $relativePath
  if (Test-Path -LiteralPath $targetPath) {
    return
  }

  $fileName = Split-Path -Leaf $targetPath
  $source = Find-NewestFile $fileName $targetPath
  if (-not $source) {
    Write-Warning "Missing asset: $webPath. Put $fileName in the Facebook folder or Downloads, then run again."
    return
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetPath) | Out-Null
  Copy-Item -LiteralPath $source.FullName -Destination $targetPath -Force
  Write-Host "Copied asset $fileName"
}

function Sync-ExportedFiles {
  Write-Step 'Checking exported files'

  Copy-NewerFile 'products.csv' (Join-Path $dataDir 'products.csv') | Out-Null
  Copy-NewerFile 'site.json' (Join-Path $dataDir 'site.json') | Out-Null

  $csvPath = Join-Path $dataDir 'products.csv'
  if (Test-Path -LiteralPath $csvPath) {
    Import-Csv -LiteralPath $csvPath | ForEach-Object {
      Copy-ReferencedAsset $_.image
    }
  }

  $siteJsonPath = Join-Path $dataDir 'site.json'
  if (Test-Path -LiteralPath $siteJsonPath) {
    $siteConfig = Get-Content -LiteralPath $siteJsonPath -Raw | ConvertFrom-Json
    Copy-ReferencedAsset $siteConfig.logoImage
    Copy-ReferencedAsset $siteConfig.coverImage
    if ($siteConfig.certificates) {
      $siteConfig.certificates | ForEach-Object {
        Copy-ReferencedAsset $_.image
      }
    }
  }
}

function Optimize-Images {
  $optimizer = Join-Path $projectDir 'tools\optimize-local-images.ps1'
  if (-not (Test-Path -LiteralPath $optimizer)) {
    return
  }

  Write-Step 'Optimizing large product images'
  Invoke-Checked 'powershell.exe' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $optimizer) $projectDir
}

function Commit-And-Push {
  Write-Step 'Committing content changes'

  Invoke-Checked 'git' @('add', '--', 'public/data', 'public/products', 'public/site') $projectDir
  Push-Location $projectDir
  try {
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
      $message = 'Update site content ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
      Invoke-Checked 'git' @('commit', '-m', $message) $projectDir
    } else {
      Write-Host 'No new content changes to commit.'
    }

    $branchLine = (& git status --short --branch | Select-Object -First 1)
    if ($branchLine -match '\[ahead ') {
      Write-Step 'Pushing to GitHub'
      $pushed = Invoke-Retryable 'git' @('push', 'origin', 'main') $projectDir 2
      if (-not $pushed) {
        Write-Warning 'GitHub push failed. Vercel direct deploy will continue, and the next publish will retry GitHub.'
      }
    } else {
      Write-Host 'GitHub is already up to date.'
    }
  } finally {
    Pop-Location
  }
}

function Deploy-Vercel {
  Write-Step 'Deploying to Vercel production'
  $deployed = Invoke-Retryable 'npx.cmd' @('--yes', 'vercel', 'deploy', '--prod', '--yes') $projectDir 2
  if (-not $deployed) {
    throw 'Vercel production deploy failed.'
  }
}

function Verify-Online {
  Write-Step 'Verifying online site'
  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $siteData = Invoke-RestMethod -Uri "$OnlineUrl/data/site.json?sync=$stamp" -TimeoutSec 30
  Write-Host "Online site: $OnlineUrl"
  Write-Host "Brand: $($siteData.brand)"
  Write-Host "Certificates: $($siteData.certificates.Count)"
}

Write-Host 'Facebook independent site online sync'
Write-Host "Project: $projectDir"

Sync-ExportedFiles
Optimize-Images

Write-Step 'Running production build'
Invoke-Checked 'npm.cmd' @('run', 'build') $projectDir

Commit-And-Push
Deploy-Vercel
Verify-Online

Write-Host ''
Write-Host 'DONE. You can refresh the online website now.' -ForegroundColor Green
