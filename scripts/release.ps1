param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^v\d+\.\d+\.\d+$') {
  throw "Version must be in format vX.Y.Z (example: v0.1.0)."
}

Write-Host "Building project..."
npm run build

Write-Host "Committing changes..."
git add .
try {
  git commit -m "release: $Version"
} catch {
  Write-Host "No new commit created (possibly no staged changes)."
}

Write-Host "Pushing branch $Branch..."
git push origin $Branch

Write-Host "Tagging $Version..."
git tag $Version

git push origin $Version

Write-Host "Done. GitHub Release workflow will run for tag $Version"
