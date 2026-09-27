# K7 sekreter rolü testi: sekreter davetle eklenir, yalnızca randevu oluşturabilir; danışan, klinik yönetimi,
# fatura ve rapor uçlarına erişemez. Kendi açtığı geçici hesabı, danışanı ve randevuyu siler.
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
$secEmail = "claude-k7-sekreter-$n@test.local"
$day = '2031-04-10'

$tOwner = Login $script:TestAccounts.Owner
$t1 = Login $script:TestAccounts.Psy1
$X = (J (Call 'GET' '/api/clinic' $tOwner $null)).clinic.id

# Önceki yarım kalmış çalıştırmalardan temizle
foreach ($c in @(J (Call 'GET' '/api/clients' $t1 $null))) { if ($c.name -like 'K7-*') { Call 'DELETE' "/api/clients/$($c.id)" $t1 $null | Out-Null } }
$oldInv = @(J (Call 'GET' "/api/clinic/invitations?clinicId=$X" $tOwner $null)) | Where-Object { $_.email -eq $secEmail }
foreach ($i in $oldInv) { Call 'DELETE' "/api/clinic/invitations/$($i.id)?clinicId=$X" $tOwner $null | Out-Null }

$clientId = $null; $apptId = $null; $tSec = $null

try {
  # --- 1. yalnızca sahip sekreter davet edebilir, rol geçerli olmalı
  $r = Call 'POST' "/api/clinic/invitations?clinicId=$X" $t1 @{ email = $secEmail; role = 'secretary' }
  Check '1a üye (sahip olmayan) davet gönderemez (403)' ($r.Status -eq 403) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'POST' "/api/clinic/invitations?clinicId=$X" $tOwner @{ email = $secEmail; role = 'gecersiz' }
  Check '1b geçersiz rol 400' ($r.Status -eq 400) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'POST' "/api/clinic/invitations?clinicId=$X" $tOwner @{ email = $secEmail; role = 'secretary' }
  Check '1c sahip sekreter daveti oluşturur (201)' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $invite = J $r
  Check '1d davet yanıtında rol=secretary' ($invite.role -eq 'secretary') ($invite | ConvertTo-Json -Compress)
  $token = ($invite.inviteUrl -split '/invite/')[1]

  # --- 2. davet kabulüyle sekreter olarak üye olunur
  $r = Call 'GET' "/api/auth/invitations/$token" $null $null
  Check '2a davet önizlemesi görülür' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'POST' "/api/auth/invitations/$token/accept" $null @{ password = $pw; displayName = 'Claude K7 Sekreter' }
  Check '2b davet kabul edildi, hesap oluştu' ($r.Status -lt 300) "status=$($r.Status) body=$($r.Body)"
  $tSec = Login $secEmail
  $clinic = (J (Call 'GET' '/api/clinic' $tSec $null)).clinic
  Check '2c sekreterin rolü secretary' ($clinic.role -eq 'secretary') ($clinic | ConvertTo-Json -Compress)
  $perms = @($clinic.permissions)
  Check '2d yetkiler yalnızca VIEW_CLINIC_SCHEDULE, VIEW_CLINIC_CLIENTS, CREATE_APPOINTMENTS, ASSIGN_CLIENTS' (
    $perms.Count -eq 4 -and $perms -contains 'VIEW_CLINIC_SCHEDULE' -and $perms -contains 'VIEW_CLINIC_CLIENTS' -and $perms -contains 'CREATE_APPOINTMENTS' -and $perms -contains 'ASSIGN_CLIENTS'
  ) ($perms -join ',')

  # --- 3. sekreter klinik yönetimi, rapor ve fatura uçlarına giremez
  Check '3a sekreter oda ekleyemez (403)' ((Call 'POST' "/api/clinic/rooms?clinicId=$X" $tSec @{ name = 'K7-oda' }).Status -eq 403) 'oda eklendi'
  Check '3b sekreter davet gönderemez (403)' ((Call 'POST' "/api/clinic/invitations?clinicId=$X" $tSec @{ email = 'baska@test.local' }).Status -eq 403) 'davet gönderildi'
  Check '3c sekreter fee-report göremez (403)' ((Call 'GET' "/api/clinic/fee-report?clinicId=$X" $tSec $null).Status -eq 403) 'rapor okundu'
  $ownerId = (J (Call 'GET' '/api/auth/me' $tOwner $null)).id
  Check '3d sekreter üye çıkaramaz (403)' ((Call 'DELETE' "/api/clinic/members/${ownerId}?clinicId=$X" $tSec $null).Status -eq 403) 'üye çıkarıldı'

  # --- 4. sekreter kliniğin tüm danışanlarını görür (kendi danışanı yok)
  $r = Call 'POST' '/api/clients' $t1 @{ name = "K7-Danisan-$n"; clinicId = $X }
  Check '4a psikolog 1 için test danışanı oluşturuldu' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $clientId = (J $r).id
  $r = Call 'GET' "/api/clinic/clients?clinicId=$X&search=K7-Danisan-$n" $tSec $null
  Check '4b sekreter klinik danışan listesini görür' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
  $found = @(@(J $r) | Where-Object { $_.id -eq $clientId })
  Check '4c danışan listede psikolog 1 adıyla görünür' ($found.Count -eq 1 -and $found[0].therapistUserId) ($found | ConvertTo-Json -Compress)
  Check '4d sekreterin kendi /api/clients listesi boş (danışanı yok)' (@(J (Call 'GET' '/api/clients' $tSec $null)).Count -eq 0) 'sekreterin danışanı var'

  # --- 5. sekreter başka psikoloğun danışanına randevu oluşturabilir
  $r = Call 'POST' "/api/clients/$clientId/appointments" $tSec @{ appointmentDate = $day; appointmentTime = '11:00'; durationMinutes = 50 }
  Check '5a sekreter randevu oluşturur (201)' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $apptId = (J $r).id
  $apts = @(J (Call 'GET' "/api/clients/$clientId/appointments" $t1 $null))
  $created = @($apts | Where-Object { $_.id -eq $apptId })
  Check '5b psikolog 1 kendi takviminde bu randevuyu tam görür (mine=true)' ($created.Count -eq 1 -and $created[0].mine -eq $true -and $created[0].createdByName) ($created | ConvertTo-Json -Compress)

  # --- 6. sekreter klinik dışı (kişisel) danışana randevu açamaz
  $r = Call 'POST' '/api/clients' $t1 @{ name = "K7-Kisisel-$n"; clinicId = 0 }
  Check '6a psikolog 1 için kişisel danışan oluşturuldu' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $personalId = (J $r).id
  $r = Call 'POST' "/api/clients/$personalId/appointments" $tSec @{ appointmentDate = $day; appointmentTime = '13:00'; durationMinutes = 50 }
  Check '6b sekreter kişisel danışana randevu açamaz (404)' ($r.Status -eq 404) "status=$($r.Status) body=$($r.Body)"
  Call 'DELETE' "/api/clients/$personalId" $t1 $null | Out-Null

  # --- 7. sahip rolü sekreter <-> psikolog arasında değiştirebilir
  $r = Call 'PUT' "/api/clinic/members/$((J (Call 'GET' '/api/auth/me' $tSec $null)).id)/role?clinicId=$X" $tOwner @{ role = 'member' }
  Check '7a sahip sekreteri psikolog yapar (200)' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
  Check '7b rolü artık member' ((J (Call 'GET' '/api/clinic' $tSec $null)).clinic.role -eq 'member') 'rol değişmedi'
  $r = Call 'PUT' "/api/clinic/members/$((J (Call 'GET' '/api/auth/me' $tSec $null)).id)/role?clinicId=$X" $t1 @{ role = 'secretary' }
  Check '7c üye (sahip olmayan) rol değiştiremez (403)' ($r.Status -eq 403) "status=$($r.Status) body=$($r.Body)"
}
finally {
  if ($apptId -and $clientId) { Call 'DELETE' "/api/clients/$clientId/appointments/$apptId" $t1 $null | Out-Null }
  if ($clientId) { Call 'DELETE' "/api/clients/$clientId" $t1 $null | Out-Null }
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
