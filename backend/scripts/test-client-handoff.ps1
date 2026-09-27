# K7 danışan devri testi: bir üye ayrılınca/çıkarılınca danışanları kişisel OLMAZ, kliniğe bağlı ama
# sahipsiz kalır; sahip ya da sekreter başka bir psikoloğa atayabilir. Bu script atama uçlarının yetki ve
# doğrulama kurallarını dener (ayrılma/çıkarılma akışı zaten test-multi-clinic.ps1 bölüm 8'de deneniyor).
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
$secEmail = "claude-k7-devir-sekreter-$n@test.local"

$tOwner = Login $script:TestAccounts.Owner
$t1 = Login $script:TestAccounts.Psy1
$t2 = Login $script:TestAccounts.Psy2
$X = (J (Call 'GET' '/api/clinic' $tOwner $null)).clinic.id
$psy1Id = (J (Call 'GET' '/api/auth/me' $t1 $null)).id
$psy2Id = (J (Call 'GET' '/api/auth/me' $t2 $null)).id
$ownerId = (J (Call 'GET' '/api/auth/me' $tOwner $null)).id

# Önceki yarım kalmış çalıştırmalardan temizle (t1/t2'ye atanmış ya da hâlâ sahipsiz kalmış olabilir)
foreach ($c in @(J (Call 'GET' '/api/clients' $t1 $null))) { if ($c.name -like 'K7Devir-*') { Call 'DELETE' "/api/clients/$($c.id)" $t1 $null | Out-Null } }
foreach ($c in @(J (Call 'GET' '/api/clients' $t2 $null))) { if ($c.name -like 'K7Devir-*') { Call 'DELETE' "/api/clients/$($c.id)" $t2 $null | Out-Null } }
foreach ($c in @(J (Call 'GET' "/api/clinic/clients/unassigned?clinicId=$X" $tOwner $null))) {
  if ($c.name -like 'K7Devir-*') {
    Call 'PUT' "/api/clients/$($c.id)/assign?clinicId=$X" $tOwner @{ userId = $psy1Id } | Out-Null
    Call 'DELETE' "/api/clients/$($c.id)" $t1 $null | Out-Null
  }
}
$oldInv = @(J (Call 'GET' "/api/clinic/invitations?clinicId=$X" $tOwner $null)) | Where-Object { $_.email -eq $secEmail }
foreach ($i in $oldInv) { Call 'DELETE' "/api/clinic/invitations/$($i.id)?clinicId=$X" $tOwner $null | Out-Null }

$c1 = $null; $c2 = $null; $tSec = $null

try {
  # --- 1. hazırlık: iki sahipsiz danışan (elle üretiyoruz: psikolog 1'de oluşturup owner ile atamadan önce
  # doğrudan veritabanı yolu olmadığı için, gerçek akış test-multi-clinic.ps1'de deneniyor; burada sahipsiz
  # durumu owner'ın önce bir sahte atamayı geri almasıyla değil, taze bir üyenin ayrılmasıyla kuruyoruz.
  $tmpEmail = "claude-k7-devir-gecici-$n@test.local"
  $r = Call 'POST' '/api/auth/register' $null @{ email = $tmpEmail; password = $pw; displayName = 'Claude K7 Devir Geçici' }
  $tTmp = (J $r).token
  $xInvite = (J (Call 'GET' '/api/clinic' $tOwner $null)).clinic.inviteCode
  Call 'POST' '/api/clinic/join' $tTmp @{ inviteCode = $xInvite } | Out-Null
  $c1 = (J (Call 'POST' '/api/clients' $tTmp @{ name = "K7Devir-Bir-$n"; email = "k7devir-$n@test.local" })).id
  $c2 = (J (Call 'POST' '/api/clients' $tTmp @{ name = "K7Devir-Iki-$n" })).id
  Call 'POST' '/api/clinic/leave' $tTmp $null | Out-Null
  Call 'DELETE' '/api/auth/me' $tTmp $null | Out-Null
  Check '1a iki danışan da sahipsizler listesinde' (
    @(@(J (Call 'GET' "/api/clinic/clients/unassigned?clinicId=$X" $tOwner $null)) | Where-Object { $_.id -eq $c1 -or $_.id -eq $c2 }).Count -eq 2
  ) 'listede yok'

  # --- 2. yetki: sahip olmayan, ASSIGN_CLIENTS'siz üye listeleyemez ve atayamaz
  Check '2a düz üye (psikolog 2) sahipsizler listesini göremez (403)' ((Call 'GET' "/api/clinic/clients/unassigned?clinicId=$X" $t2 $null).Status -eq 403) 'göründü'
  Check '2b düz üye (psikolog 2) atayamaz (403)' ((Call 'PUT' "/api/clients/$c1/assign?clinicId=$X" $t2 @{ userId = $psy2Id }).Status -eq 403) 'atadı'

  # --- 3. sahip: geçersiz hedefler
  Check '3a olmayan danışan 404' ((Call 'PUT' "/api/clients/999999999/assign?clinicId=$X" $tOwner @{ userId = $psy1Id }).Status -eq 404) 'hata dönmedi'
  Check '3b kliniğe üye olmayana atanamaz (400)' ((Call 'PUT' "/api/clients/$c1/assign?clinicId=$X" $tOwner @{ userId = 999999999 }).Status -eq 400) 'atandı'

  # --- 4. sahip: geçerli atama
  $r = Call 'PUT' "/api/clients/$c1/assign?clinicId=$X" $tOwner @{ userId = $psy1Id }
  Check '4a sahip danışanı psikolog 1e atar (200)' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
  Check '4b psikolog 1 artık danışanı görür' ((Call 'GET' "/api/clients/$c1" $t1 $null).Status -eq 200) 'göremiyor'
  Check '4c sahipsizler listesinden çıktı' (@(@(J (Call 'GET' "/api/clinic/clients/unassigned?clinicId=$X" $tOwner $null)) | Where-Object { $_.id -eq $c1 }).Count -eq 0) 'hâlâ listede'
  Check '4d zaten atanmış danışan tekrar atanamaz (409)' ((Call 'PUT' "/api/clients/$c1/assign?clinicId=$X" $tOwner @{ userId = $psy2Id }).Status -eq 409) 'atandı'

  # --- 5. sekreter de atayabilir, ama sekretere atanamaz
  $r = Call 'POST' "/api/clinic/invitations?clinicId=$X" $tOwner @{ email = $secEmail; role = 'secretary' }
  $token = ((J $r).inviteUrl -split '/invite/')[1]
  Call 'POST' "/api/auth/invitations/$token/accept" $null @{ password = $pw; displayName = 'Claude K7 Devir Sekreter' } | Out-Null
  $tSec = Login $secEmail
  $secId = (J (Call 'GET' '/api/auth/me' $tSec $null)).id
  Check '5a sekretere danışan atanamaz (400)' ((Call 'PUT' "/api/clients/$c2/assign?clinicId=$X" $tOwner @{ userId = $secId }).Status -eq 400) 'atandı'
  $r = Call 'PUT' "/api/clients/$c2/assign?clinicId=$X" $tSec @{ userId = $psy2Id }
  Check '5b sekreter sahipsiz danışanı psikolog 2ye atar (200)' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
  Check '5c psikolog 2 artık danışanı görür' ((Call 'GET' "/api/clients/$c2" $t2 $null).Status -eq 200) 'göremiyor'
}
finally {
  # Danışan kime atanmış olursa olsun (owner, psy1 ya da psy2), hangi token silebilirse siler.
  foreach ($id in @($c1, $c2)) {
    if (-not $id) { continue }
    foreach ($tok in @($t1, $t2, $tOwner)) {
      if ((Call 'DELETE' "/api/clients/$id" $tok $null).Status -lt 300) { break }
    }
  }
  if ($tSec) {
    Call 'POST' '/api/clinic/leave' $tSec $null | Out-Null
    Call 'DELETE' '/api/auth/me' $tSec $null | Out-Null
  }
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$results | ForEach-Object { $_ }
'----'
"TOPLAM: $pass geçti, $fail kaldı"
if ($fail -gt 0) { exit 1 }
