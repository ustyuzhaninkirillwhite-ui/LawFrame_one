$ErrorActionPreference = 'Stop'

$auth = Invoke-RestMethod `
  -Method Post `
  -Uri 'http://127.0.0.1:8080/api/v1/authentication/sign-in' `
  -ContentType 'application/json' `
  -Body (@{
    email = 'stage14.local.1776926324@lexframe.local'
    password = 'LocalPass123!'
  } | ConvertTo-Json) `
  -TimeoutSec 20

$env:PORT = '3100'
$env:LEXFRAME_APP_BASE_URL = 'http://127.0.0.1:3000'
$env:LEXFRAME_READINESS_PROFILE = 'local-integrated'
$env:LEXFRAME_CONTRACTS_VERSION = 'stage14'
$env:LEXFRAME_DELIVERY_TRANSPORT = 'webhook'
$env:LEXFRAME_DELIVERY_WEBHOOK_URL = 'http://127.0.0.1:8091/hooks/delivery'
$env:LEXFRAME_DELIVERY_WEBHOOK_TOKEN = 'local_delivery_sandbox_token'
$env:ACTIVEPIECES_SIMULATE_RUNS = '0'
$env:LEXFRAME_RUNTIME_MASTER_SECRET = 'local_stage14_runtime_master_secret'
$env:SUPABASE_SECRET_KEY = 'local_supabase_storage_signing_secret'
$env:ACTIVEPIECES_API_KEY = $auth.token
$env:ACTIVEPIECES_SIGNING_PRIVATE_KEY = 'local_stage14_signing_private_key'
$env:ACTIVEPIECES_SIGNING_KEY_ID = 'lexframe-stage4'

@{
  PORT = $env:PORT
  LEXFRAME_APP_BASE_URL = $env:LEXFRAME_APP_BASE_URL
  LEXFRAME_READINESS_PROFILE = $env:LEXFRAME_READINESS_PROFILE
  LEXFRAME_CONTRACTS_VERSION = $env:LEXFRAME_CONTRACTS_VERSION
  LEXFRAME_DELIVERY_TRANSPORT = $env:LEXFRAME_DELIVERY_TRANSPORT
  LEXFRAME_DELIVERY_WEBHOOK_URL = $env:LEXFRAME_DELIVERY_WEBHOOK_URL
  ACTIVEPIECES_SIMULATE_RUNS = $env:ACTIVEPIECES_SIMULATE_RUNS
  SUPABASE_SECRET_KEY = $env:SUPABASE_SECRET_KEY
  ACTIVEPIECES_API_KEY_PREFIX = $env:ACTIVEPIECES_API_KEY.Substring(0, 20)
} | ConvertTo-Json | Set-Content -Path 'E:\Law_frame_main\backend-startup-env.json'

Start-Process `
  -FilePath 'node' `
  -ArgumentList 'E:\Law_frame_main\apps\backend\dist\main.js' `
  -WorkingDirectory 'E:\Law_frame_main' `
  -RedirectStandardOutput 'E:\Law_frame_main\backend-runtime.log' `
  -RedirectStandardError 'E:\Law_frame_main\backend-runtime.err.log'
