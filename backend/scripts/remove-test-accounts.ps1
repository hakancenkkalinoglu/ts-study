# claude-*@test.local hesaplarını ve test kliniğini siler (kayıtları da gider).
# Sıra: psikologlar hesaplarını siler, sonra sahip kliniği silip hesabını siler.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\TestLib.ps1"
$A = $script:TestAccounts

foreach ($email in @($A.Psy1, $A.Psy2)) {
  $t = TryLogin $email
  if ($t) { $r = Call 'DELETE' '/api/auth/me' $t $null; "$email silindi ($($r.Status))" } else { "$email yok" }
}
$tOwner = TryLogin $A.Owner
if ($tOwner) {
  $r = Call 'DELETE' '/api/clinic' $tOwner $null; "klinik silindi ($($r.Status))"
  $r = Call 'DELETE' '/api/auth/me' $tOwner $null; "$($A.Owner) silindi ($($r.Status))"
} else { "$($A.Owner) yok" }
