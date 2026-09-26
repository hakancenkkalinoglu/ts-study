# K6 çoklu klinik testi: klinikler birbirini görmez, psikoloğun takvimi ortak, danışan tek kliniğe ait,
# raporlar klinik klinik. Kendi açtığı klinik, danışan, randevu ve hesabı siler.
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
$yName = 'Claude Test Kliniği 2'
$day = '2031-03-10'; $day2 = '2031-03-11'
$sharedEmail = "k6-ortak-$n@test.local"

$tOwner = Login $script:TestAccounts.Owner   # X sahibi, yalnızca X üyesi
$t1 = Login $script:TestAccounts.Psy1        # X üyesi, testte Y'nin sahibi olur
$t2 = Login $script:TestAccounts.Psy2        # yalnızca X üyesi
$X = (J (Call 'GET' '/api/clinic' $tOwner $null)).clinic.id
$xInvite = (J (Call 'GET' '/api/clinic' $tOwner $null)).clinic.inviteCode
$Y = $null; $cX = $null; $cY = $null; $cP = $null; $c2 = $null; $tTmp = $null

# Önceki yarım kalmış çalıştırmalardan temizle
foreach ($c in @(J (Call 'GET' '/api/clinics' $t1 $null))) {
  if ($c.name -eq $yName -and $c.role -eq 'owner') { Call 'DELETE' "/api/clinic?clinicId=$($c.id)" $t1 $null | Out-Null }
}
foreach ($c in @(J (Call 'GET' '/api/clients' $t1 $null))) { if ($c.name -like 'K6-*') { Call 'DELETE' "/api/clients/$($c.id)" $t1 $null | Out-Null } }
foreach ($c in @(J (Call 'GET' '/api/clients' $t2 $null))) { if ($c.name -like 'K6-*') { Call 'DELETE' "/api/clients/$($c.id)" $t2 $null | Out-Null } }

try {
  # --- 1. bir psikolog iki klinikte
  $r = Call 'POST' '/api/clinic' $t1 @{ name = $yName }
  Check '1a klinik üyesi psikolog kendi kliniğini kurabilir (201)' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $Y = (J $r).id
  $r = Call 'POST' "/api/clinic/rooms?clinicId=$Y" $t1 @{ name = "K6-YODA-$n" }
  Check '1b Y kliniğine özel oda eklendi' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $yRoom = (J (Call 'GET' "/api/clinic/rooms?clinicId=$Y" $t1 $null) | Where-Object { $_.name -eq "K6-YODA-$n" }).id
  $xRoom = @(J (Call 'GET' "/api/clinic/rooms?clinicId=$X" $t1 $null))[0].id
  $list = @(J (Call 'GET' '/api/clinics' $t1 $null))
  Check '1c GET /api/clinics iki klinik döndürür' ($list.Count -eq 2) "sayı=$($list.Count)"
  $r = Call 'GET' '/api/clinic' $t1 $null
  Check '1d birden fazla klinikte clinicId olmadan GET /api/clinic 400' ($r.Status -eq 400) "status=$($r.Status) body=$($r.Body)"
  Check '1e X için rol member, Y için owner' ((J (Call 'GET' "/api/clinic?clinicId=$X" $t1 $null)).clinic.role -eq 'member' -and (J (Call 'GET' "/api/clinic?clinicId=$Y" $t1 $null)).clinic.role -eq 'owner') 'roller beklenenden farklı'
  Check '1f tek klinikli kullanıcı clinicId vermeden eskisi gibi çalışır' ((J (Call 'GET' '/api/clinic' $tOwner $null)).clinic.id -eq $X) 'sahip kliniği okunamadı'

  # --- 2. danışan tek kliniğe ait
  $r = Call 'POST' '/api/clients' $t1 @{ name = "K6-yok-$n" }
  Check '2a iki klinikli psikolog danışanda klinik vermezse 400' ($r.Status -eq 400) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'POST' '/api/clients' $t1 @{ name = "K6-Y-$n"; email = $sharedEmail; clinicId = $Y }
  Check '2b Y danışanı oluştu' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"; $cY = (J $r).id
  $r = Call 'POST' '/api/clients' $t1 @{ name = "K6-X-$n"; email = $sharedEmail; clinicId = $X }
  Check '2c aynı e-posta başka klinikte ayrı kayıt olabilir' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"; $cX = (J $r).id
  $r = Call 'POST' '/api/clients' $t1 @{ name = "K6-X2-$n"; email = $sharedEmail; clinicId = $X }
  Check '2d aynı klinikte aynı e-posta 409' ($r.Status -eq 409) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'POST' '/api/clients' $t1 @{ name = "K6-P-$n"; clinicId = 0 }
  Check '2e clinicId=0 kişisel danışan' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"; $cP = (J $r).id
  $mine = @(J (Call 'GET' '/api/clients' $t1 $null))
  $gx = $mine | Where-Object { $_.id -eq $cX }; $gy = $mine | Where-Object { $_.id -eq $cY }; $gp = $mine | Where-Object { $_.id -eq $cP }
  Check '2f danışanların clinicId değerleri doğru (X, Y, boş)' ($gx.clinicId -eq $X -and $gy.clinicId -eq $Y -and $null -eq $gp.clinicId) "x=$($gx.clinicId) y=$($gy.clinicId) p=$($gp.clinicId)"
  $r = Call 'POST' '/api/clients' $t2 @{ name = "K6-P2-$n"; clinicId = $Y }
  Check '2g üyesi olmadığı kliniğe danışan eklenemez (404)' ($r.Status -eq 404) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'POST' '/api/clients' $t2 @{ name = "K6-P2-$n" }
  Check '2h tek klinikli psikolog danışanı otomatik kendi kliniğine' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"; $c2 = (J $r).id
  Check '2i otomatik klinik X' ((J (Call 'GET' "/api/clients/$c2" $t2 $null)).clinicId -eq $X) 'clinicId X değil'

  # --- 3. randevu: klinik danışandan, oda o klinikten, çakışma psikolog bazında
  function Appt($tok, $cid, $date, $time, $room) {
    $b = @{ appointmentDate = $date; appointmentTime = $time; durationMinutes = 50 }
    if ($room) { $b['roomId'] = $room }
    return Call 'POST' "/api/clients/$cid/appointments" $tok $b
  }
  $r = Appt $t1 $cY $day '10:00' $yRoom
  Check '3a Y danışanına Y odasıyla randevu' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $r = Appt $t1 $cX $day '10:30' $null
  Check '3b iki klinikte çakışan saat 409 (psikolog bazında)' ($r.Status -eq 409) "status=$($r.Status) body=$($r.Body)"
  $r = Appt $t1 $cX $day '12:00' $xRoom
  Check '3c X danışanına X odasıyla randevu' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $r = Appt $t1 $cY $day '14:00' $xRoom
  Check '3d Y danışanına X odası 400' ($r.Status -eq 400) "status=$($r.Status) body=$($r.Body)"
  $r = Appt $t1 $cX $day '14:00' $yRoom
  Check '3e X danışanına Y odası 400' ($r.Status -eq 400) "status=$($r.Status) body=$($r.Body)"
  $r = Appt $t1 $cP $day '14:00' $xRoom
  Check '3f kişisel danışana oda seçilemez 400' ($r.Status -eq 400) "status=$($r.Status) body=$($r.Body)"
  $r = Appt $t1 $cP $day '15:00' $null
  Check '3g kişisel danışana odasız randevu' ($r.Status -eq 201) "status=$($r.Status) body=$($r.Body)"
  $ap = @{}
  foreach ($c in @(@('X', $cX), @('Y', $cY), @('P', $cP))) {
    $ap[$c[0]] = @(J (Call 'GET' "/api/clients/$($c[1])/appointments" $t1 $null))[0]
  }
  Check '3h randevunun kliniği danışandan (X, Y, boş)' ($ap.X.clinicId -eq $X -and $ap.Y.clinicId -eq $Y -and $null -eq $ap.P.clinicId) "x=$($ap.X.clinicId) y=$($ap.Y.clinicId) p=$($ap.P.clinicId)"

  # --- 4. klinik takvimi: diğer klinik yalnızca "Kapalı" bloğu, hiçbir ayrıntı sızmaz
  $q = "scope=clinic&from=$day&to=$day"
  $r = Call 'GET' "/api/appointments?$q" $tOwner $null
  $rows = @(J $r)
  $blocks = @($rows | Where-Object { $_.title -eq 'Kapalı' })
  Check '4a X sahibi: Y ve kişisel randevu "Kapalı" bloğu olarak görünür' ($blocks.Count -eq 2) "blok sayısı=$($blocks.Count)"
  Check '4b bloklarda klinik, oda, danışan bilgisi yok' (@($blocks | Where-Object { $null -ne $_.clinicId -or $null -ne $_.roomId -or $null -ne $_.roomName -or $null -ne $_.clientName -or $null -ne $_.clientEmail }).Count -eq 0) ($blocks | ConvertTo-Json -Compress)
  Check '4c X sahibinin yanıtında Y kliniğine ait hiçbir iz yok' ($r.Body -notmatch "K6-YODA|K6-Y-|$yName") 'Y izi sızdı'
  Check '4d X randevusu klinik içinde görünür (oda ve klinik dolu)' (@($rows | Where-Object { $_.clinicId -eq $X -and $_.roomId -eq $xRoom }).Count -eq 1) ($rows | ConvertTo-Json -Compress)
  $r = Call 'GET' "/api/appointments?$q" $t1 $null
  Check '4e iki klinikli psikolog clinicId vermeden klinik takvimi 400' ($r.Status -eq 400) "status=$($r.Status)"
  $rowsX = @(J (Call 'GET' "/api/appointments?$q&clinicId=$X" $t1 $null))
  $full = @($rowsX | Where-Object { $_.mine -eq $true -and $_.clientName -eq "K6-X-$n" })
  Check '4f psikolog X takvimini seçince kendi X randevusu tam görünür, Y "Kapalı"' ($full.Count -eq 1 -and @($rowsX | Where-Object { $_.title -eq 'Kapalı' }).Count -eq 2) ($rowsX | ConvertTo-Json -Compress)
  $rowsY = @(J (Call 'GET' "/api/appointments?$q&clinicId=$Y" $t1 $null))
  Check '4g psikolog Y takvimini seçince Y tam, X ve kişisel "Kapalı"' (@($rowsY | Where-Object { $_.mine -eq $true -and $_.clientName -eq "K6-Y-$n" }).Count -eq 1 -and @($rowsY | Where-Object { $_.title -eq 'Kapalı' }).Count -eq 2) ($rowsY | ConvertTo-Json -Compress)
  $all = @(J (Call 'GET' "/api/appointments?from=$day&to=$day" $t1 $null))
  Check '4h "benim takvimim" tüm kliniklerdeki randevuları tam gösterir' ($all.Count -eq 3 -and @($all | Where-Object { $_.clientName }).Count -eq 3) "sayı=$($all.Count)"

  # --- 5. klinikler arası yetki
  Check '5a X sahibi Y odalarını göremez (404)' ((Call 'GET' "/api/clinic/rooms?clinicId=$Y" $tOwner $null).Status -eq 404) 'X sahibi Y odalarını okudu'
  Check '5b X sahibi Y kliniğini okuyamaz (404)' ((Call 'GET' "/api/clinic?clinicId=$Y" $tOwner $null).Status -eq 404) 'X sahibi Y kliniğini okudu'
  Check '5c X sahibi Y raporunu göremez (404)' ((Call 'GET' "/api/clinic/fee-report?clinicId=$Y" $tOwner $null).Status -eq 404) 'X sahibi Y raporunu okudu'
  Check '5d X sahibi Y kliniğini yeniden adlandıramaz (404)' ((Call 'PUT' "/api/clinic?clinicId=$Y" $tOwner @{ name = 'ele geçirildi' }).Status -eq 404) 'X sahibi Y adını değiştirdi'
  Check '5e psikolog X üyesi olarak X raporunu göremez (403), Y sahibi olarak görür (200)' ((Call 'GET' "/api/clinic/fee-report?clinicId=$X" $t1 $null).Status -eq 403 -and (Call 'GET' "/api/clinic/fee-report?clinicId=$Y" $t1 $null).Status -eq 200) 'rol bazlı yetki klinik başına çalışmıyor'
  Check '5f Psy2 (yalnızca X) Y davetlerini listeleyemez (404)' ((Call 'GET' "/api/clinic/invitations?clinicId=$Y" $t2 $null).Status -eq 404) 'Y davetleri okundu'
  $av = @(J (Call 'GET' "/api/appointments/room-availability?clinicId=$Y&date=$day&time=10:00&duration=50" $t1 $null))
  Check '5g oda doluluğu seçilen kliniğin odalarını gösterir (Y odası dolu)' (@($av | Where-Object { $_.name -eq "K6-YODA-$n" -and $_.busy }).Count -eq 1 -and @($av | Where-Object { $_.id -eq $xRoom }).Count -eq 0) ($av | ConvertTo-Json -Compress)

  # --- 6. raporlar: klinik klinik
  $all = @(J (Call 'GET' "/api/clinic/my-earnings-all?from=2031-03-01&to=2031-03-31" $t1 $null))
  $ex = $all | Where-Object { $_.clinicId -eq $X }; $ey = $all | Where-Object { $_.clinicId -eq $Y }
  Check '6a my-earnings-all her klinik için ayrı rapor (X:1 seans, Y:1 seans)' ($all.Count -eq 2 -and $ex.report.sessions -eq 1 -and $ey.report.sessions -eq 1) ($all | ConvertTo-Json -Depth 5 -Compress)
  $one = J (Call 'GET' "/api/clinic/my-earnings?clinicId=$Y&from=2031-03-01&to=2031-03-31" $t1 $null)
  Check '6b tek klinik raporu yalnızca o kliniğin seansları' ($one.sessions -eq 1) "sessions=$($one.sessions)"
  Check '6c tek klinikli psikolog için my-earnings-all tek elemanlı' (@(J (Call 'GET' '/api/clinic/my-earnings-all' $tOwner $null)).Count -eq 1) 'eleman sayısı 1 değil'

  # --- 7. danışanın kliniğini değiştirmek
  $r = Call 'PUT' "/api/clients/$cX" $t1 @{ clinicId = $Y }
  Check '7a aynı e-postalı danışan, e-postası çakışan kliniğe taşınamaz (409)' ($r.Status -eq 409) "status=$($r.Status) body=$($r.Body)"
  $r = Call 'PUT' "/api/clients/$cX" $t1 @{ clinicId = 0 }
  Check '7b danışan kişisel yapıldı' ($r.Status -eq 200 -and $null -eq (J (Call 'GET' "/api/clients/$cX" $t1 $null)).clinicId) "status=$($r.Status) body=$($r.Body)"
  $a = @(J (Call 'GET' "/api/clients/$cX/appointments" $t1 $null))[0]
  Check '7c gelecekteki randevu klinikten ve odadan çıktı' ($null -eq $a.clinicId -and $null -eq $a.roomId) "clinicId=$($a.clinicId) roomId=$($a.roomId)"
  $r = Call 'PUT' "/api/clients/$cX" $t1 @{ clinicId = $X }
  $a = @(J (Call 'GET' "/api/clients/$cX/appointments" $t1 $null))[0]
  Check '7d X kliniğine geri alındı, randevu X etiketli' ($r.Status -eq 200 -and $a.clinicId -eq $X) "status=$($r.Status) clinicId=$($a.clinicId)"

  # --- 8. klinikten ayrılan psikolog (Karar 7) ve kliniksiz psikolog kendi kliniğini kurar (Karar 8)
  $tmpEmail = "claude-k6-$n@test.local"
  $r = Call 'POST' '/api/auth/register' $null @{ email = $tmpEmail; password = $pw; displayName = 'Claude K6 Geçici' }
  $tTmp = (J $r).token
  Check '8a kliniksiz psikolog hesabı' ($r.Status -lt 300 -and $null -eq (J (Call 'GET' '/api/clinic' $tTmp $null)).clinic) "status=$($r.Status)"
  $r = Call 'POST' '/api/clinic/join' $tTmp @{ inviteCode = $xInvite }
  Check '8b davet koduyla X kliniğine katıldı' ($r.Status -lt 300) "status=$($r.Status) body=$($r.Body)"
  $cid = (J (Call 'POST' '/api/clients' $tTmp @{ name = "K6-gecici-$n" })).id
  Appt $tTmp $cid '2020-01-10' '10:00' $xRoom | Out-Null
  Appt $tTmp $cid $day2 '10:00' $xRoom | Out-Null
  $r = Call 'POST' '/api/clinic/leave' $tTmp $null
  Check '8c klinikten ayrıldı (200)' ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
  Check '8d danışan psikologda kaldı ve kişisel oldu' ((J (Call 'GET' "/api/clients/$cid" $tTmp $null)).clinicId -eq $null) 'danışan hâlâ klinikli'
  $apps = @(J (Call 'GET' "/api/clients/$cid/appointments" $tTmp $null))
  $past = $apps | Where-Object { $_.appointmentDate -like '2020-*' }; $future = $apps | Where-Object { $_.appointmentDate -like '2031-*' }
  Check '8e geçmiş randevu klinik etiketini korudu' ($past.clinicId -eq $X) "clinicId=$($past.clinicId)"
  Check '8f gelecekteki randevu klinikten ve odadan çıktı' ($null -eq $future.clinicId -and $null -eq $future.roomId) "clinicId=$($future.clinicId) roomId=$($future.roomId)"
  $r = Call 'POST' '/api/clinic' $tTmp @{ name = "K6 Geçici Klinik $n" }
  Check '8g kliniksiz psikolog kendi kliniğini kurar ve sahip olur' ($r.Status -eq 201 -and (J $r).role -eq 'owner') "status=$($r.Status) body=$($r.Body)"
}
finally {
  # --- temizlik
  foreach ($id in @($cX, $cY, $cP)) { if ($id) { Call 'DELETE' "/api/clients/$id" $t1 $null | Out-Null } }
  if ($c2) { Call 'DELETE' "/api/clients/$c2" $t2 $null | Out-Null }
  if ($Y) { Call 'DELETE' "/api/clinic?clinicId=$Y" $t1 $null | Out-Null }
  if ($tTmp) {
    Call 'DELETE' '/api/clinic' $tTmp $null | Out-Null
    Call 'DELETE' '/api/auth/me' $tTmp $null | Out-Null
  }
}

# artık kalmadı mı
$left = docker exec testpsikolog-postgres psql -U testpsikolog -d testpsikolog -tAc "SELECT (SELECT count(*) FROM clients WHERE name LIKE 'K6-%') + (SELECT count(*) FROM clinics WHERE name LIKE 'Claude Test Klini% 2' OR name LIKE 'K6 Ge%ici Klinik%') + (SELECT count(*) FROM app_users WHERE email LIKE 'claude-k6-%');" 2>&1
Check '9  test sonrası artık kayıt kalmadı' (("$left").Trim() -eq '0') "kalan=$left"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$results | ForEach-Object { $_ }
'----'
"TOPLAM: $pass geçti, $fail kaldı"
if ($fail -gt 0) { exit 1 }
