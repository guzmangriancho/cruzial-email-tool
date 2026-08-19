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

if not exist "frontend\dist\index.html" (
  echo La interfaz no esta compilada. Iniciando instalador...
  call Instalar_Cruzial.bat
  if errorlevel 1 exit /b 1
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
