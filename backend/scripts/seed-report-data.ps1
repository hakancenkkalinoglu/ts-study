# Raporlar ve Klinik Raporu ekranlarını denemek için claude-*@test.local kliniğine örnek veri ekler:
# bir oda, klinik payı oranı, iki psikologda bu ay için dört farklı durumda randevular ve bir oda ücreti ödemesi.
# Tekrar çalıştırmak güvenlidir (olanı atlar). setup-test-accounts.ps1 önce çalışmış olmalı.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\TestLib.ps1"
$A = $script:TestAccounts
$aptTitle = 'Örnek rapor verisi'
$today = Get-Date
$firstOfYear = "$($today.Year)-01-01"
$period = $today.ToString('yyyy-MM')

$tOwner = Login $A.Owner
$t1 = Login $A.Psy1
$t2 = Login $A.Psy2

# Windows PowerShell 5.1: ConvertFrom-Json bir diziyi tek nesne olarak verir. Fonksiyondan dönerek dizi açılır.
function J($r) { return ($r.Body | ConvertFrom-Json) }

# 1) Oda
$rooms = @(J (Call 'GET' '/api/clinic/rooms' $tOwner $null))
if ($rooms.Count -eq 0) {
  $r = Call 'POST' '/api/clinic/rooms' $tOwner @{ name = 'Claude Oda 1' }
  if ($r.Status -ge 300) { throw "Oda açılamadı ($($r.Status)): $($r.Body)" }
  $rooms = @(J (Call 'GET' '/api/clinic/rooms' $tOwner $null))
  'oda oluşturuldu'
} else { 'oda var' }
$roomId = $rooms[0].id

# 2) Klinik payı oranı (yalnızca yoksa)
$comm = (Call 'GET' '/api/clinic/commissions' $tOwner $null).Body | ConvertFrom-Json
if ([double]$comm.defaultPercent -le 0) {
  $r = Call 'PUT' '/api/clinic/commissions/default' $tOwner @{ percent = 30; validFrom = $firstOfYear }
  if ($r.Status -ge 300) { throw "Oran ayarlanamadı ($($r.Status)): $($r.Body)" }
  'varsayılan klinik payı %30 yapıldı'
} else { "klinik payı zaten %$($comm.defaultPercent)" }

# 3) Randevular: her psikolog için 4 kayıt (geldi+ödendi, geldi+bekliyor, gelmedi, iptal), bu ay içinde geçmiş günlerde
function Seed-Appointments($token, $hour, $email) {
  $clients = @(J (Call 'GET' '/api/clients' $token $null))
  $cid = $clients[0].id
  $existing = @(J (Call 'GET' "/api/clients/$cid/appointments" $token $null)) | Where-Object { $_.title -eq $aptTitle }
  if (@($existing).Count -gt 0) { "$email randevular var"; return }
  $plan = @(
    @{ back = 3;  status = 'attended';  paid = $true;  fee = 2000 },
    @{ back = 6;  status = 'attended';  paid = $false; fee = 2000 },
    @{ back = 9;  status = 'no_show';   paid = $false; fee = 2000 },
    @{ back = 12; status = 'cancelled'; paid = $false; fee = 2000 }
  )
  foreach ($p in $plan) {
    $d = $today.AddDays(-$p.back)
    if ($d.Month -ne $today.Month) { $d = $today.AddDays(-1 * [Math]::Max(1, $today.Day - 1)) }  # ay başındaysak aynı ay içinde kal
    $body = @{ appointmentDate = $d.ToString('yyyy-MM-dd'); appointmentTime = ('{0:00}:00' -f $hour); title = $aptTitle
               isPaid = $p.paid; status = $p.status; roomId = $roomId; durationMinutes = 50; sessionFee = $p.fee }
    $r = Call 'POST' "/api/clients/$cid/appointments" $token ($body + @{ clientId = $cid })
    if ($r.Status -ge 300) { throw "Randevu açılamadı ($email, $($p.status), $($r.Status)): $($r.Body)" }
    $hour++   # aynı gün çakışmasın
  }
  "$email için 4 örnek randevu eklendi"
}
Seed-Appointments $t1 10 $A.Psy1
Seed-Appointments $t2 15 $A.Psy2

# 4) Bir oda ücreti ödemesi (psikolog 1 için, bu aya)
$fee = (Call 'GET' "/api/clinic/fee-report?month=$period" $tOwner $null).Body | ConvertFrom-Json
$row1 = @($fee.therapists) | Where-Object { @($_.payments).Count -gt 0 }
if (-not $row1) {
  $uid1 = (@($fee.therapists) | Select-Object -First 1).userId
  $r = Call 'POST' '/api/clinic/share-payments' $tOwner @{ userId = $uid1; period = $period; amount = 200; paidOn = $today.ToString('yyyy-MM-dd'); note = 'Örnek havale' }
  if ($r.Status -ge 300) { throw "Ödeme kaydedilemedi ($($r.Status)): $($r.Body)" }
  'örnek oda ücreti ödemesi eklendi'
} else { 'ödeme kaydı var' }
'Örnek veri hazır.'
