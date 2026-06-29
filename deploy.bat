@echo off
REM ============================================================
REM  Cheep — TEK TIK DEPLOY (Windows)
REM  Yereldeki degisiklikleri commit + push eder, sunucuda pull + rebuild tetikler.
REM  Geride yerel art2k birakmaz: kaynak git'ten, veri sunucudaki volume'da.
REM
REM  Gereksinimler (bir kez kuruldu):
REM    - deploy\.droplet-ip      : sunucu IP'si (tek satir)
REM    - %USERPROFILE%\.ssh\cheep_deploy : SSH ozel anahtari
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist "deploy\.droplet-ip" (
  echo [HATA] deploy\.droplet-ip bulunamadi. Icine sunucu IP'sini yazin.
  exit /b 1
)
set /p DROPLET_IP=<deploy\.droplet-ip
set SSH_KEY=%USERPROFILE%\.ssh\cheep_deploy

echo === Cheep deploy -^> %DROPLET_IP% ===

echo [1/3] Yerel degisiklikler commit'leniyor...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "deploy: %DATE% %TIME%"
) else (
  echo   (commit'lenecek degisiklik yok)
)

echo [2/3] origin/main'e push...
git push origin main
if errorlevel 1 ( echo [HATA] git push basarisiz & exit /b 1 )

echo [3/3] Sunucuda pull + rebuild...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no root@%DROPLET_IP% "bash /opt/cheep/deploy/deploy.sh"
if errorlevel 1 ( echo [HATA] uzak deploy basarisiz & exit /b 1 )

echo.
echo === BITTI === API: http://%DROPLET_IP%:3000/api/v1
endlocal
