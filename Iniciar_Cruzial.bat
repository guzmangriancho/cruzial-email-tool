@echo off
setlocal
cd /d "%~dp0"
title Cruzial Local
color 0B

echo =====================================================
echo               INICIANDO CRUZIAL LOCAL
echo =====================================================
echo.

if not exist ".env" (
  echo [ERROR] Falta el archivo .env.
  echo Ejecuta Instalar_Cruzial.bat o copia .env.example como .env.
  pause
  exit /b 1
)

if not exist "venv\Scripts\python.exe" (
  echo No existe el entorno Python. Iniciando instalador...
  call Instalar_Cruzial.bat
  if errorlevel 1 exit /b 1
)

set "FRONTEND_STALE=0"
if not exist "frontend\dist\index.html" (
  set "FRONTEND_STALE=1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$dist=(Get-Item 'frontend\dist\index.html').LastWriteTimeUtc; $newer=Get-ChildItem 'frontend\src' -Recurse -File | Where-Object { $_.LastWriteTimeUtc -gt $dist } | Select-Object -First 1; if (-not $newer) { $newer=Get-Item 'frontend\package.json','frontend\package-lock.json','frontend\vite.config.ts' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTimeUtc -gt $dist } | Select-Object -First 1 }; if ($newer) { exit 0 } else { exit 1 }" >nul 2>nul
  if not errorlevel 1 set "FRONTEND_STALE=1"
)

if "%FRONTEND_STALE%"=="1" (
  echo Se han detectado cambios en la interfaz. Recompilando...
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] No se ha encontrado Node.js / npm.
    echo Instala Node.js LTS para poder recompilar la interfaz.
    pause
    exit /b 1
  )
  pushd frontend
  if not exist "node_modules" (
    echo Instalando dependencias del frontend...
    call npm install
    if errorlevel 1 (
      popd
      pause
      exit /b 1
    )
  )
  call npm run build
  if errorlevel 1 (
    popd
    echo [ERROR] No se pudo compilar la interfaz.
    pause
    exit /b 1
  )
  popd
)

echo [1/2] Iniciando Cruzial en este equipo...
start "Cruzial Local" /min cmd /k "cd /d ""%~dp0"" && venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

echo [2/2] Abriendo el navegador...
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:8000/clientes

echo.
echo Cruzial Local iniciado.
echo BBDD: revisa CRUZIAL_DB_PATH en .env si quieres moverla a la red.
timeout /t 2 /nobreak >nul
exit /b 0
