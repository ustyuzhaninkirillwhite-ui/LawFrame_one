$ErrorActionPreference = "Stop"

$SecretDir = Join-Path $env:USERPROFILE ".lexframe\secrets"
$KeyFile = Join-Path $SecretDir "lexframe.keys.local.json"
$Owner = "$env:USERDOMAIN\$env:USERNAME"

New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null

if (!(Test-Path $KeyFile)) {
@'
{
  "schema_version": "1.0",
  "default_route": "owner_default_ai",
  "keys": [
    {
      "id": "owner_default_ai",
      "provider": "xai",
      "model": "model-id-from-project-instruction",
      "api_key": "PASTE_KEY_HERE",
      "enabled": true,
      "priority": 1,
      "purposes": ["ai_gateway", "workflow_planning", "activepieces_custom_piece"],
      "max_monthly_budget": null,
      "notes": "local owner key; never commit"
    }
  ]
}
'@ | Set-Content -Encoding UTF8 -NoNewline $KeyFile
}

icacls $SecretDir /inheritance:r | Out-Null
icacls $SecretDir /grant:r "${Owner}:(OI)(CI)F" | Out-Null
icacls $SecretDir /remove:g "Everyone" "Users" "Authenticated Users" 2>$null | Out-Null

icacls $KeyFile /inheritance:r | Out-Null
icacls $KeyFile /grant:r "${Owner}:F" | Out-Null
icacls $KeyFile /remove:g "Everyone" "Users" "Authenticated Users" 2>$null | Out-Null

Write-Host "LexFrame local keys file:" $KeyFile
Write-Host "Review ACL with: icacls `"$KeyFile`""
