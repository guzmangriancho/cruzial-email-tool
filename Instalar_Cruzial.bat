@echo off
setlocal
cd /d "%~dp0"
title Instalador - Cruzial Local
color 0B

echo =====================================================
echo       INSTALACION CRUZIAL LOCAL
echo =====================================================
echo.

where py >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se ha encontrado Python.
  echo Instala Python 3.11 o superior marcando "Add Python to PATH".
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se ha encontrado Node.js / npm.
  echo Instala Node.js LTS y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo [AVISO] Se ha creado .env desde el ejemplo.
  echo Edita SMTP_CREDENTIALS_SECRET_KEY antes de guardar credenciales SMTP.
)

if not exist "venv\Scripts\python.exe" (
  echo [1/5] Creando entorno Python...
  py -3 -m venv venv
  if errorlevel 1 goto :error
) else (
  echo [1/5] Entorno Python ya existente.
)

echo [2/5] Actualizando pip...
"venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto :error

echo [3/5] Instalando backend...
"venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto :error

echo [4/5] Instalando frontend...
pushd frontend
call npm install
if errorlevel 1 (
  popd
  goto :error
)
echo [5/5] Compilando interfaz...
call npm run build
if errorlevel 1 (
  popd
  goto :error
)
popd

echo.
echo Instalacion completada.
echo Ya puedes ejecutar Iniciar_Cruzial.bat
pause
exit /b 0

:error
echo.
echo [ERROR] La instalacion no ha terminado correctamente.
echo Revisa los mensajes anteriores y tu conexion a Internet.
pause
exit /b 1
