# Test betikleri için ortak yardımcılar. Doğrudan çalıştırılmaz, diğer betikler dot-source eder.
# Şifre repoda tutulmaz: CLAUDE_TEST_PASSWORD kullanıcı ortam değişkeninden okunur.

$script:Base = if ($env:TEST_API_BASE) { $env:TEST_API_BASE } else { 'http://localhost:3000' }

$script:TestAccounts = @{
  Owner = 'claude-sahip@test.local'
  Psy1  = 'claude-psikolog1@test.local'
  Psy2  = 'claude-psikolog2@test.local'
}
$script:TestClinicName = 'Claude Test Kliniği'

function Get-TestPassword {
  # [string] dönüşümü şart: PowerShell 5.1'de ham metin ek özellik taşır ve JSON'a nesne olarak gider.
  [string]$pw = $env:CLAUDE_TEST_PASSWORD
  if (-not $pw) { $pw = [Environment]::GetEnvironmentVariable('CLAUDE_TEST_PASSWORD', 'User') }
  if (-not $pw) { throw 'CLAUDE_TEST_PASSWORD ortam değişkeni tanımlı değil.' }
  return $pw
}

function Call($method, $path, $token, $body) {
  $h = @{}
  if ($token) { $h['Authorization'] = "Bearer $token" }
  $req = @{ Uri = "$script:Base$path"; Method = $method; UseBasicParsing = $true; Headers = $h; TimeoutSec = 30 }
  if ($null -ne $body) {
    $req['Body'] = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
    $req['ContentType'] = 'application/json; charset=utf-8'
  }
  try {
    $r = Invoke-WebRequest @req
    return @{ Status = [int]$r.StatusCode; Body = $r.Content }
  } catch {
    $resp = $_.Exception.Response
    if ($null -eq $resp) { throw }
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    return @{ Status = [int]$resp.StatusCode; Body = $sr.ReadToEnd() }
  }
}

# Başarısızsa $null döner.
function TryLogin($email) {
  $r = Call 'POST' '/api/auth/login' $null @{ email = $email; password = (Get-TestPassword) }
  if ($r.Status -ne 200) { return $null }
  return ($r.Body | ConvertFrom-Json).token
}

function Login($email) {
  $t = TryLogin $email
  if (-not $t) { throw "Giriş başarısız: $email. Önce setup-test-accounts.ps1 çalıştırın." }
  return $t
}
