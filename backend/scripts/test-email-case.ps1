# Türkçe locale tuzağı (I -> ı) regresyon testi: büyük "I" içeren e-postalar küçük "i" olarak normalleşmeli.
# Kapsam: kayıt, giriş, çift kayıt, danışan e-postası, klinik daveti. Kendi açtığı kayıtları siler.
# Önce setup-test-accounts.ps1 çalıştırılmış, backend açık ve CLAUDE_TEST_PASSWORD tanımlı olmalı.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\TestLib.ps1"

$pass = 0; $fail = 0
$results = New-Object System.Collections.Generic.List[string]
function Check($name, $cond, $detail) {
  if ($cond) { $script:pass++; $results.Add("PASS  $name") }
  else { $script:fail++; $results.Add("FAIL  $name  -> $detail") }
}
function J($r) { return ($r.Body | ConvertFrom-Json) }

$pw = Get-TestPassword
$n = Get-Random -Maximum 99999
$upper = "CLAUDE-TESTI-$n@TEST.LOCAL"        # büyük I içerir
$lower = "claude-testi-$n@test.local"       # beklenen normalleşmiş hâl
$bad   = $lower.Replace('i', [string][char]0x0131)   # hatalı (noktasız ı) hâl

$tOwner = Login $script:TestAccounts.Owner
$t1 = Login $script:TestAccounts.Psy1
$regToken = $null; $clientId = $null; $inviteId = $null

try {
  # --- 1. kayıt
  $r = Call 'POST' '/api/auth/register' $null @{ email = $upper; password = $pw; displayName = 'Claude Email Test' }
  Check '1a büyük I içeren e-postayla kayıt 201' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  if ($r.Status -lt 300) { $regToken = (J $r).token; $email = (J $r).email }
  Check '1b yanıttaki e-posta küçük i ile (ı değil)' ($email -ceq $lower) "beklenen=$lower gelen=$email"
  $stored = docker exec testpsikolog-postgres psql -U testpsikolog -d testpsikolog -tAc "SELECT email FROM app_users WHERE email ILIKE 'claude-test%-$n@%';" 2>&1
  Check '1c veritabanında küçük i ile saklandı' (("$stored").Trim() -ceq $lower) "db=$stored"

  # --- 2. giriş (küçük ve büyük harfle)
  $r = Call 'POST' '/api/auth/login' $null @{ email = $lower; password = $pw }
  Check '2a küçük harfle giriş 200' ($r.Status -eq 200) "status=$($r.Status)"
  $r = Call 'POST' '/api/auth/login' $null @{ email = $upper; password = $pw }
  Check '2b BÜYÜK harfle giriş 200 (aynı hesap)' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'POST' '/api/auth/login' $null @{ email = ($lower.Substring(0, 1).ToUpper() + $lower.Substring(1)); password = $pw }
  Check '2c "Ilk harfi büyük" (telefon klavyesi) yazımla giriş 200' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'POST' '/api/auth/login' $null @{ email = $upper; password = 'yanlis-sifre-123' }
  Check '2d büyük harfli e-postayla yanlış şifre yine 401' ($r.Status -eq 401) "status=$($r.Status)"

  # --- 3. aynı e-postayla ikinci kayıt reddedilmeli
  $r = Call 'POST' '/api/auth/register' $null @{ email = $lower; password = $pw; displayName = 'Kopya' }
  Check '3  küçük harfli aynı e-postayla ikinci kayıt reddedildi' ($r.Status -ge 400 -and $r.Status -lt 500) "status=$($r.Status)"

  # --- 4. danışan e-postası
  $cEmail = "CLAUDE-CLIENTI-$n@X.COM"
  $r = Call 'POST' '/api/clients' $t1 @{ name = "Email Test Danisan $n"; email = $cEmail }
  Check '4a büyük I içeren danışan e-postası kabul edildi' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  if ($r.Status -lt 300) { $clientId = (J $r).id }
  if ($clientId) {
    $c = J (Call 'GET' "/api/clients/$clientId" $t1 $null)
    Check '4b danışan e-postası küçük i ile saklandı' ($c.email -ceq "claude-clienti-$n@x.com") "gelen=$($c.email)"
    $r = Call 'POST' '/api/clients' $t1 @{ name = 'Kopya'; email = "claude-clienti-$n@x.com" }
    Check '4c aynı e-posta (küçük harf) ikinci danışan -> 409' ($r.Status -eq 409) "status=$($r.Status)"
  }

  # --- 5. klinik daveti
  $iEmail = "CLAUDE-INVITEI-$n@TEST.LOCAL"
  $r = Call 'POST' '/api/clinic/invitations' $tOwner @{ email = $iEmail }
  Check '5a büyük I içeren e-postaya davet 2xx' ($r.Status -lt 300) "status=$($r.Status) body=$($r.Body)"
  if ($r.Status -lt 300) { $inviteId = (J $r).id; $invEmail = (J $r).email }
  Check '5b davet e-postası küçük i ile' ($invEmail -ceq "claude-invitei-$n@test.local") "gelen=$invEmail"
}
finally {
  # --- temizlik
  if ($inviteId) { Call 'DELETE' "/api/clinic/invitations/$inviteId" $tOwner $null | Out-Null }
  if ($clientId) { Call 'DELETE' "/api/clients/$clientId" $t1 $null | Out-Null }
  if ($regToken) { Call 'DELETE' '/api/auth/me' $regToken $null | Out-Null }
}

# hatalı (ı'lı) kayıt DB'de kalmadı mı
$leftover = docker exec testpsikolog-postgres psql -U testpsikolog -d testpsikolog -tAc "SELECT count(*) FROM app_users WHERE email ~ '[ıİ]' OR email ILIKE 'claude-test%-$n@%';" 2>&1
Check '6  test sonrası artık/bozuk hesap kalmadı' (("$leftover").Trim() -eq '0') "kalan=$leftover"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$results | ForEach-Object { $_ }
'----'
"TOPLAM: $pass geçti, $fail kaldı"
if ($fail -gt 0) { exit 1 }
