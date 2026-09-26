# P5 risk işareti uçlarının testi: GET/PUT /api/clients/{id}/risk.
# Önce setup-test-accounts.ps1 çalıştırılmış, backend açık ve CLAUDE_TEST_PASSWORD tanımlı olmalı.
# Test sonunda risk işaretlerini temizler, veri bırakmaz.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\TestLib.ps1"

$pass = 0; $fail = 0
$results = New-Object System.Collections.Generic.List[string]
function Check($name, $cond, $detail) {
  if ($cond) { $script:pass++; $results.Add("PASS  $name") }
  else { $script:fail++; $results.Add("FAIL  $name  -> $detail") }
}
function J($r) { return ($r.Body | ConvertFrom-Json) }

$tOwner = Login $script:TestAccounts.Owner
$t1 = Login $script:TestAccounts.Psy1
$t2 = Login $script:TestAccounts.Psy2

$A = @(J (Call 'GET' '/api/clients' $t1 $null))[0].id   # psikolog 1'in danışanı
$B = @(J (Call 'GET' '/api/clients' $t2 $null))[0].id   # psikolog 2'nin danışanı
$marker = 'RISKMARKER-' + (Get-Random -Maximum 99999)

# Önceki yarım kalmış çalıştırmalardan temizle
Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = '' } | Out-Null
Call 'PUT' "/api/clients/$B/risk" $t2 @{ level = '' } | Out-Null

# --- 1. başlangıç
$r = Call 'GET' "/api/clients/$A/risk" $t1 $null; $j = J $r
Check '1  ilk GET 200 ve işaret yok' ($r.Status -eq 200 -and $null -eq $j.level -and $null -eq $j.note) "status=$($r.Status) body=$($r.Body)"

# --- 2. yazma / okuma
$r = Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'medium'; note = "$marker kisa not" }
Check '2a PUT medium 200' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '2b GET seviye=medium, not doğru, updatedAt dolu' ($j.level -eq 'medium' -and $j.note -eq "$marker kisa not" -and $j.updatedAt) ($j | ConvertTo-Json -Compress)

Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'high'; note = "$marker kisa not" } | Out-Null
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '2c seviye high olarak güncellendi' ($j.level -eq 'high') ($j | ConvertTo-Json -Compress)

$r = Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'HIGH '; note = "  $marker  " }
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '2d büyük harf/boşluk normalleşti, not kırpıldı' ($r.Status -eq 200 -and $j.level -eq 'high' -and $j.note -eq $marker) "status=$($r.Status) $($j | ConvertTo-Json -Compress)"

$r = Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'low' }
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '2e notsuz kayıt: seviye=low, not boş' ($r.Status -eq 200 -and $j.level -eq 'low' -and [string]::IsNullOrEmpty($j.note)) "status=$($r.Status) $($j | ConvertTo-Json -Compress)"

# --- 3. doğrulama
$r = Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'extreme'; note = 'x' }
Check '3a geçersiz seviye -> 400' ($r.Status -eq 400) "status=$($r.Status) body=$($r.Body)"
$r = Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'high'; note = ('a' * 501) }
Check '3b 501 karakter not -> 400' ($r.Status -eq 400) "status=$($r.Status) body=$($r.Body)"
$r = Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'high'; note = ('a' * 500) }
Check '3c tam 500 karakter not -> 200' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '3d 500 karakterlik kayıt saklandı' ($j.level -eq 'high' -and $j.note.Length -eq 500) ($j | ConvertTo-Json -Compress)

# reddedilen istek önceki kaydı bozmamalı
Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'high'; note = $marker } | Out-Null
Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'extreme'; note = 'bozar' } | Out-Null
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '3e reddedilen istek mevcut kaydı bozmadı' ($j.level -eq 'high' -and $j.note -eq $marker) ($j | ConvertTo-Json -Compress)

# --- 4. erişim kuralları
$r = Call 'GET' "/api/clients/$A/risk" $t2 $null
Check '4a başka psikolog GET -> 404' ($r.Status -eq 404) "status=$($r.Status) body=$($r.Body)"
$r = Call 'PUT' "/api/clients/$A/risk" $t2 @{ level = 'low'; note = 'saldiri' }
Check '4b başka psikolog PUT -> 404' ($r.Status -eq 404) "status=$($r.Status) body=$($r.Body)"
$r = Call 'GET' "/api/clients/$A/risk" $tOwner $null
Check '4c klinik sahibi GET -> 404' ($r.Status -eq 404) "status=$($r.Status) body=$($r.Body)"
$r = Call 'PUT' "/api/clients/$A/risk" $tOwner @{ level = '' }
Check '4d klinik sahibi PUT (işareti silmeye çalışır) -> 404' ($r.Status -eq 404) "status=$($r.Status) body=$($r.Body)"
$r = Call 'GET' "/api/clients/$A/risk" $null $null
Check '4e girişsiz GET -> 401' ($r.Status -eq 401) "status=$($r.Status)"
$r = Call 'PUT' "/api/clients/$A/risk" $null @{ level = 'low' }
Check '4f girişsiz PUT -> 401' ($r.Status -eq 401) "status=$($r.Status)"
$r = Call 'GET' '/api/clients/99999999/risk' $t1 $null
Check '4g olmayan danışan GET -> 404' ($r.Status -eq 404) "status=$($r.Status)"
$r = Call 'PUT' '/api/clients/99999999/risk' $t1 @{ level = 'low' }
Check '4h olmayan danışan PUT -> 404' ($r.Status -eq 404) "status=$($r.Status)"
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '4i saldırı denemeleri sonrası kayıt değişmedi' ($j.level -eq 'high' -and $j.note -eq $marker) ($j | ConvertTo-Json -Compress)

# --- 5. sızıntı: danışan uçları
$body = (Call 'GET' '/api/clients' $t1 $null).Body
Check '5a danışan listesi yanıtında risk yok' ($body -notmatch '(?i)risk' -and $body -notmatch $marker) 'listede risk geçti'
$body = (Call 'GET' "/api/clients/$A" $t1 $null).Body
Check '5b danışan detay yanıtında risk yok' ($body -notmatch '(?i)risk' -and $body -notmatch $marker) 'detayda risk geçti'

# --- 6. sızıntı: takvim / klinik / randevu uçları (sahip, psikolog2, psikolog1 gözünden)
# Uçların boş liste dönüp yanlış "temiz" sonuç vermemesi için A danışanına geçici bir randevu açılır, sonda silinir.
$aptTitle = 'RISKTEST-RANDEVU'
$aptDate = (Get-Date).AddDays(2).ToString('yyyy-MM-dd')
$existing = @(J (Call 'GET' "/api/clients/$A/appointments" $t1 $null)) | Where-Object { $_.title -eq $aptTitle }
foreach ($e in $existing) { Call 'DELETE' "/api/clients/$A/appointments/$($e.id)" $t1 $null | Out-Null }
$r = Call 'POST' "/api/clients/$A/appointments" $t1 @{ clientId = $A; appointmentDate = $aptDate; appointmentTime = '10:00'; title = $aptTitle }
Check '6a geçici randevu oluşturuldu (sızıntı kontrolü boş listeyle yapılmasın)' ($r.Status -lt 300) "status=$($r.Status) body=$($r.Body)"
$aptId = (@(J (Call 'GET' "/api/clients/$A/appointments" $t1 $null)) | Where-Object { $_.title -eq $aptTitle } | Select-Object -First 1).id
$from = (Get-Date).AddMonths(-12).ToString('yyyy-MM-dd'); $to = (Get-Date).AddMonths(3).ToString('yyyy-MM-dd')
$paths = @(
  "/api/appointments?from=$from&to=$to", "/api/appointments?scope=clinic&from=$from&to=$to", '/api/appointments/upcoming',
  "/api/appointments/$aptId", "/api/clients/$A/appointments",
  "/api/clients/$A/notes", '/api/clinic', '/api/clinic/overview', '/api/clinic/my-earnings', '/api/packages/expiring'
)
$leak = @(); $checked = 0; $non200 = @()
foreach ($who in @(@('sahip', $tOwner), @('psikolog2', $t2), @('psikolog1', $t1))) {
  foreach ($p in $paths) {
    $r = Call 'GET' $p $who[1] $null
    if ($r.Status -eq 200) {
      $checked++
      if ($r.Body -match $marker -or $r.Body -match '(?i)"risk') { $leak += "$($who[0]) $p" }
    } else { $non200 += "$($who[0]) $p ($($r.Status))" }
  }
}
Check "6b $checked yanıtta (takvim/klinik/randevu) risk sızıntısı yok" ($leak.Count -eq 0 -and $checked -gt 0) ('sızıntı: ' + ($leak -join '; '))
# Kontrolün gerçekten randevu içeren bir yanıtı taradığını kanıtla
$own = (Call 'GET' "/api/appointments?from=$from&to=$to" $t1 $null).Body
Check '6c psikolog1 randevu listesi geçici randevuyu içeriyor (kontrol boş yanıtta yapılmadı)' ($own -match $aptTitle) 'randevu listede görünmedi'
$clinicView2 = (Call 'GET' "/api/appointments?scope=clinic&from=$from&to=$to" $t2 $null).Body
$clinicViewOwner = (Call 'GET' "/api/appointments?scope=clinic&from=$from&to=$to" $tOwner $null).Body
$results.Add("INFO  klinik takviminde geçici randevu görünüyor mu: psikolog2=$([bool]($clinicView2 -match 'RISKTEST' -or $clinicView2 -match [string]$aptDate)), sahip=$([bool]($clinicViewOwner -match [string]$aptDate))")
if ($non200.Count -gt 0) { $results.Add('INFO  200 dönmeyen uçlar (sızıntı kontrolüne dahil değil): ' + ($non200 -join ', ')) }

# --- 7. danışan güncelleme riski silmiyor
$r = Call 'PUT' "/api/clients/$A" $t1 @{ phone = '5550000000' }
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '7  danışan bilgisi güncellenince risk korunuyor' ($r.Status -eq 200 -and $j.level -eq 'high' -and $j.note -eq $marker) "status=$($r.Status) $($j | ConvertTo-Json -Compress)"

# --- 8. kaldırma
$r = Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = ''; note = 'kalmamali' }
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '8a boş seviye ile işaret ve not kaldırıldı' ($r.Status -eq 200 -and $null -eq $j.level -and $null -eq $j.note -and $null -eq $j.updatedAt) "status=$($r.Status) $($j | ConvertTo-Json -Compress)"
Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = 'high'; note = $marker } | Out-Null
$r = Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = $null }
$j = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
Check '8b level=null ile de kaldırılabiliyor' ($r.Status -eq 200 -and $null -eq $j.level) "status=$($r.Status) $($j | ConvertTo-Json -Compress)"

# --- 9. psikologlar birbirinden bağımsız
Call 'PUT' "/api/clients/$B/risk" $t2 @{ level = 'medium'; note = 'B notu' } | Out-Null
$ja = J (Call 'GET' "/api/clients/$A/risk" $t1 $null)
$jb = J (Call 'GET' "/api/clients/$B/risk" $t2 $null)
Check '9  psikologlar bağımsız (A boş, B medium)' ($null -eq $ja.level -and $jb.level -eq 'medium') "A=$($ja | ConvertTo-Json -Compress) B=$($jb | ConvertTo-Json -Compress)"

# --- temizlik
if ($aptId) { Call 'DELETE' "/api/clients/$A/appointments/$aptId" $t1 $null | Out-Null }
Call 'PUT' "/api/clients/$B/risk" $t2 @{ level = '' } | Out-Null
Call 'PUT' "/api/clients/$A/risk" $t1 @{ level = '' } | Out-Null

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$results | ForEach-Object { $_ }
'----'
"TOPLAM: $pass geçti, $fail kaldı"
if ($fail -gt 0) { exit 1 }
