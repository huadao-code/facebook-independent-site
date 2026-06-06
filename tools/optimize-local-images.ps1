$ErrorActionPreference = 'Stop'

$imageRoots = @(
  Join-Path $PSScriptRoot '..\public\products'
)

$minimumBytes = 300KB
$maxSide = 1400
$jpegQuality = 4

foreach ($root in $imageRoots) {
  if (-not (Test-Path -LiteralPath $root)) {
    continue
  }

  Get-ChildItem -LiteralPath $root -File |
    Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' -and $_.Length -ge $minimumBytes } |
    ForEach-Object {
      $file = $_
      $temp = Join-Path $file.DirectoryName "$($file.BaseName).optimized.jpg"
      if (Test-Path -LiteralPath $temp) {
        Remove-Item -LiteralPath $temp -Force
      }

      & ffmpeg -y -i $file.FullName -vf "scale='if(gt(iw,ih),$maxSide,-1)':'if(gt(iw,ih),-1,$maxSide)'" -q:v $jpegQuality $temp 2>$null
      if ($LASTEXITCODE -ne 0) {
        if (Test-Path -LiteralPath $temp) {
          Remove-Item -LiteralPath $temp -Force
        }
        throw "ffmpeg failed while optimizing $($file.Name)"
      }

      $before = $file.Length
      $after = (Get-Item -LiteralPath $temp).Length
      if ($after -lt $before) {
        Move-Item -LiteralPath $temp -Destination $file.FullName -Force
        Write-Host "Optimized $($file.Name): $([math]::Round($before / 1KB, 1))KB -> $([math]::Round($after / 1KB, 1))KB"
      } else {
        Remove-Item -LiteralPath $temp -Force
      }
    }
}
