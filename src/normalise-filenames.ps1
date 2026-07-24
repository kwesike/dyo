# ============================================================
#  normalise-filenames.ps1
#
#  Run from the project root:
#     cd C:\Users\GroomingMFB062\dyoibadannorth
#     powershell -ExecutionPolicy Bypass -File .\normalise-filenames.ps1
#
#  Renames every file to one convention and fixes the imports
#  that point at the old names.
#
#  The convention:
#    components and contexts -> PascalCase matching the export
#                               (AuthContext.tsx exports AuthContext)
#    plain modules in lib/   -> lowercase (payments.ts, storage.ts)
#
#  Windows treats Payments.ts and payments.ts as the same file.
#  Linux does not. Every build host is Linux, so these mismatches
#  all fail at once on the first deploy and none of it reproduces
#  on your machine. Better to sort it now.
# ============================================================

$ErrorActionPreference = "Stop"

function Move-Safely($from, $to) {
  if (-not (Test-Path $from)) { return }
  if ($from -eq $to) { return }

  $parent = Split-Path $to -Parent
  if ($parent -and -not (Test-Path $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }

  # Two steps via a temporary name: git on Windows won't record a
  # rename that differs only by capitalisation in a single move.
  $temp = "$from.tmp-rename"
  git mv -f $from $temp 2>$null
  if ($LASTEXITCODE -ne 0) { Move-Item -Force $from $temp }

  git mv -f $temp $to 2>$null
  if ($LASTEXITCODE -ne 0) { Move-Item -Force $temp $to }

  Write-Host "  $from  ->  $to"
}

Write-Host "`nMoving contexts out of components/..." -ForegroundColor Cyan
Move-Safely "src\components\Authcontext.tsx" "src\context\AuthContext.tsx"
Move-Safely "src\components\Cartcontext.tsx" "src\context\CartContext.tsx"
Move-Safely "src\components\AuthContext.tsx" "src\context\AuthContext.tsx"
Move-Safely "src\components\CartContext.tsx" "src\context\CartContext.tsx"

Write-Host "`nNormalising lib/..." -ForegroundColor Cyan
Move-Safely "src\lib\Payments.ts" "src\lib\payments.ts"
Move-Safely "src\lib\Storage.ts"  "src\lib\storage.ts"
Move-Safely "src\lib\Constants.ts" "src\lib\constants.ts"
Move-Safely "src\lib\AttendingCard.ts" "src\lib\attendingCard.ts"
Move-Safely "src\lib\ProgrammeWindow.ts" "src\lib\programmeWindow.ts"

Write-Host "`nNormalising components/..." -ForegroundColor Cyan
$componentRenames = @{
  "Routeguards.tsx"             = "RouteGuards.tsx"
  "Checkyouremail.tsx"          = "CheckYourEmail.tsx"
  "Accountpage.tsx"             = "AccountPage.tsx"
  "Programmepage.tsx"           = "ProgrammesPage.tsx"
  "Programmespage.tsx"          = "ProgrammesPage.tsx"
  "Programmedetail.tsx"         = "ProgrammeDetail.tsx"
  "Storepage.tsx"               = "StorePage.tsx"
  "Productdetail.tsx"           = "ProductDetail.tsx"
  "Checkoutpage.tsx"            = "CheckoutPage.tsx"
  "Orderreceipt.tsx"            = "OrderReceipt.tsx"
  "Adminprogrammes.tsx"         = "AdminProgrammes.tsx"
  "Adminregistrations.tsx"      = "AdminRegistrations.tsx"
  "AdminregistrationsIndex.tsx" = "AdminRegistrationsIndex.tsx"
  "Adminregistrationsindex.tsx" = "AdminRegistrationsIndex.tsx"
  "Adminproducts.tsx"           = "AdminProducts.tsx"
  "Adminorders.tsx"             = "AdminOrders.tsx"
  "Adminannouncements.tsx"      = "AdminAnnouncements.tsx"
  "Adminmembers.tsx"            = "AdminMembers.tsx"
  "Adminleadership.tsx"         = "AdminLeadership.tsx"
  "Adminlayout.tsx"             = "AdminLayout.tsx"
  "Adminhome.tsx"               = "AdminHome.tsx"
  "Signup.tsx"                  = "Signup.tsx"
}

foreach ($pair in $componentRenames.GetEnumerator()) {
  Move-Safely "src\components\$($pair.Key)" "src\components\$($pair.Value)"
}

Write-Host "`nFixing imports inside every source file..." -ForegroundColor Cyan

$replacements = @(
  @{ from = '"\.\./lib/Payments"';        to = '"../lib/payments"' },
  @{ from = '"\.\./lib/Storage"';         to = '"../lib/storage"' },
  @{ from = '"\.\./lib/Constants"';       to = '"../lib/constants"' },
  @{ from = '"\.\./lib/AttendingCard"';   to = '"../lib/attendingCard"' },
  @{ from = '"\.\./lib/ProgrammeWindow"'; to = '"../lib/programmeWindow"' },
  @{ from = '"\./\.\./lib/';              to = '"../lib/' },
  @{ from = '"\./Authcontext"';           to = '"../context/AuthContext"' },
  @{ from = '"\./Cartcontext"';           to = '"../context/CartContext"' },
  @{ from = '"\.\./components/Authcontext"'; to = '"../context/AuthContext"' },
  @{ from = '"\.\./components/Cartcontext"'; to = '"../context/CartContext"' },
  @{ from = '"\./components/Authcontext"'; to = '"./context/AuthContext"' },
  @{ from = '"\./components/Cartcontext"'; to = '"./context/CartContext"' },
  @{ from = '"\./components/Routeguards"'; to = '"./components/RouteGuards"' },
  @{ from = '"\./Routeguards"';            to = '"./RouteGuards"' }
)

$files = Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File
foreach ($file in $files) {
  $text = Get-Content $file.FullName -Raw
  $original = $text
  foreach ($r in $replacements) {
    $text = $text -replace $r.from, $r.to
  }
  if ($text -ne $original) {
    Set-Content -Path $file.FullName -Value $text -NoNewline
    Write-Host "  updated $($file.Name)"
  }
}

Write-Host "`nDone." -ForegroundColor Green
Write-Host "Next: restart the dev server, and in VS Code run"
Write-Host "  Ctrl+Shift+P -> TypeScript: Restart TS Server`n"