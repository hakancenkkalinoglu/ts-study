# claude-*@test.local test hesaplarını, test kliniğini ve danışanları kurar. Tekrar çalıştırmak güvenlidir
# (olanı atlar). Backend çalışıyor olmalı, CLAUDE_TEST_PASSWORD tanımlı olmalı.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\TestLib.ps1"
$pw = Get-TestPassword
$A = $script:TestAccounts

# 1) Sahip: yoksa kayıt ol
$tOwner = TryLogin $A.Owner
if (-not $tOwner) {
  $r = Call 'POST' '/api/auth/register' $null @{ email = $A.Owner; password = $pw; displayName = 'Claude Sahip' }
  if ($r.Status -ne 201 -and $r.Status -ne 200) { throw "Sahip kaydı başarısız ($($r.Status)): $($r.Body)" }
  $tOwner = Login $A.Owner
  'sahip hesabı oluşturuldu'
} else { 'sahip hesabı var' }

# 2) Klinik: yoksa oluştur
$clinic = Call 'GET' '/api/clinic' $tOwner $null
if ($clinic.Status -ne 200 -or $null -eq ($clinic.Body | ConvertFrom-Json).clinic) {
  $r = Call 'POST' '/api/clinic' $tOwner @{ name = $script:TestClinicName }
  if ($r.Status -ge 300) { throw "Klinik oluşturulamadı ($($r.Status)): $($r.Body)" }
  'klinik oluşturuldu'
} else { 'klinik var' }

# 3) Psikologlar: yoksa davetle ekle
foreach ($pair in @(@($A.Psy1, 'Claude Psikolog 1'), @($A.Psy2, 'Claude Psikolog 2'))) {
  if (TryLogin $pair[0]) { "$($pair[0]) var"; continue }
  $inv = Call 'POST' '/api/clinic/invitations' $tOwner @{ email = $pair[0] }
  if ($inv.Status -ge 300) { throw "Davet oluşturulamadı ($($pair[0]), $($inv.Status)): $($inv.Body)" }
  $token = (($inv.Body | ConvertFrom-Json).inviteUrl -split '/')[-1]
  $acc = Call 'POST' "/api/auth/invitations/$token/accept" $null @{ password = $pw; displayName = $pair[1] }
  if ($acc.Status -ge 300) { throw "Davet kabul edilemedi ($($pair[0]), $($acc.Status)): $($acc.Body)" }
  "$($pair[0]) oluşturuldu ve kliniğe eklendi"
}

# 4) Her psikologa en az 2 danışan
foreach ($email in @($A.Psy1, $A.Psy2)) {
  $t = Login $email
  $list = (Call 'GET' '/api/clients' $t $null).Body | ConvertFrom-Json
  $have = @($list).Count
  for ($i = $have + 1; $i -le 2; $i++) {
    $r = Call 'POST' '/api/clients' $t @{ name = "Claude Danışan $i ($($email.Split('@')[0]))" }
    if ($r.Status -ge 300) { throw "Danışan eklenemedi ($($r.Status)): $($r.Body)" }
  }
  "$email danışan sayısı: $([Math]::Max($have, 2))"
}
'Kurulum tamam.'
