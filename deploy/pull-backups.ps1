# ============================================
# Cheep — yedekleri sunucudan BU BİLGİSAYARA çeker.
#
# NEDEN VAR: gecelik yedek çalışıyor, doğrulanıyor ve 14 gün saklanıyor —
# ama hepsi AYNI droplet'te duruyor. Sunucu kaybı yedekleri de götürür,
# yani teknik olarak hiç yedek yok demektir.
#
# Bu betik parayla ya da yeni bir üçüncü tarafla çözmez: dump'ları var olan
# SSH anahtarıyla çeker. Yedek 5-6 MB, günde bir dosya.
#
# Bilgisayar her gün açık olmayabilir; bu yüzden betik SON dosyayı değil,
# yerelde OLMAYAN tüm dosyaları çeker — arada kaçırılan günler bir sonraki
# çalıştırmada tamamlanır.
#
# Kullanım:
#   powershell -ExecutionPolicy Bypass -File deploy\pull-backups.ps1
#
# Zamanlanmış görev olarak kurmak için (günde bir, 10:00):
#   schtasks /create /tn "Cheep yedek cek" /tr "powershell -ExecutionPolicy Bypass -File C:\dev\Cheep\deploy\pull-backups.ps1" /sc daily /st 10:00
# ============================================

$ErrorActionPreference = 'Stop'

$SshKey     = "$env:USERPROFILE\.ssh\cheep_deploy"
$Server     = 'root@129.212.193.203'
$RemoteDir  = '/opt/cheep/backups'
$LocalDir   = "$env:USERPROFILE\CheepBackups"
$KeepDays   = 60          # yerelde sunucudan UZUN tut: asıl amaç bu.

function Log($m) { Write-Host ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }

if (-not (Test-Path $SshKey)) { throw "SSH anahtarı yok: $SshKey" }
if (-not (Test-Path $LocalDir)) { New-Item -ItemType Directory -Path $LocalDir | Out-Null }

Log "sunucudaki yedekler listeleniyor"
$remote = & ssh -i $SshKey -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 `
    $Server "ls -1 $RemoteDir/cheep-*.dump 2>/dev/null" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $remote) { throw "sunucuya bağlanılamadı ya da yedek yok" }

$remoteFiles = @($remote | Where-Object { $_ -match 'cheep-.*\.dump$' } | ForEach-Object { $_.Trim() })
Log ("sunucuda {0} yedek var" -f $remoteFiles.Count)

$copied = 0
foreach ($rf in $remoteFiles) {
    $name = Split-Path $rf -Leaf
    $dest = Join-Path $LocalDir $name
    if (Test-Path $dest) { continue }          # zaten çekilmiş
    Log "  çekiliyor: $name"
    & scp -i $SshKey -o StrictHostKeyChecking=accept-new "${Server}:$rf" $dest
    if ($LASTEXITCODE -ne 0) { Log "  !! $name çekilemedi"; continue }
    $copied++
}

if ($copied -eq 0) { Log "yeni yedek yok — yerel kopya güncel" }
else { Log "$copied yeni yedek çekildi" }

# Yerelde eskiyenleri temizle. Sunucudakinden UZUN tutuluyor: sunucu 14 gün
# saklıyor, burada 60 gün duruyor — asıl kazanç bu.
$cutoff = (Get-Date).AddDays(-$KeepDays)
$old = Get-ChildItem $LocalDir -Filter 'cheep-*.dump' | Where-Object { $_.LastWriteTime -lt $cutoff }
if ($old) { $old | Remove-Item -Force; Log ("{0} eski yerel yedek silindi" -f $old.Count) }

$all = Get-ChildItem $LocalDir -Filter 'cheep-*.dump' | Sort-Object LastWriteTime
$total = [math]::Round((($all | Measure-Object Length -Sum).Sum / 1MB), 1)
Log ("yerel kopya: {0} dosya, {1} MB, en yeni {2}" -f `
    $all.Count, $total, $(if ($all) { $all[-1].Name } else { '-' }))

# Çekilen en yeni dosya gerçekten bir Postgres dump'ı mı? Boş/kesik dosya
# sessizce "yedek var" sanılmasın.
if ($all) {
    $newest = $all[-1]
    if ($newest.Length -lt 100KB) { throw "en yeni yedek şüpheli küçük: $($newest.Name) ($($newest.Length) bayt)" }
    $head = [System.IO.File]::ReadAllBytes($newest.FullName)[0..4]
    $magic = -join ($head | ForEach-Object { [char]$_ })
    if ($magic -notlike 'PGDMP*') { throw "en yeni yedek pg_dump biçiminde değil: $($newest.Name)" }
    Log "en yeni yedek doğrulandı (PGDMP başlığı, $([math]::Round($newest.Length/1MB,1)) MB)"
}

Log "bitti"
