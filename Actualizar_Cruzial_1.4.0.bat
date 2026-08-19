@echo off
setlocal
cd /d "%~dp0"
title Actualizar Cruzial Local 1.4.0
color 07

echo =====================================================
echo          ACTUALIZAR CRUZIAL LOCAL 1.4.0
echo =====================================================
echo.
echo Cierra Cruzial antes de continuar.
echo Este proceso NO sustituye .env ni tu archivo .db.
echo Anade compatibilidad con macOS manteniendo Windows.
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se ha encontrado Node.js / npm.
  echo Instala Node.js LTS o ejecuta Instalar_Cruzial.bat.
  pause
  exit /b 1
)

if not exist "venv\Scripts\python.exe" (
  echo [ERROR] No existe el entorno Python de Windows.
  echo Ejecuta Instalar_Cruzial.bat.
  pause
  exit /b 1
)

echo [1/4] Actualizando dependencias del backend...
"venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto :error

pushd frontend
if not exist "node_modules" (
  echo [2/4] No existen dependencias del frontend. Instalando...
  call npm install
  if errorlevel 1 goto :error_frontend
) else (
  echo [2/4] Dependencias del frontend existentes.
)

if exist "dist_nuevo" rmdir /s /q "dist_nuevo"
echo [3/4] Compilando interfaz 1.4.0...
call npm run build -- --outDir dist_nuevo
if errorlevel 1 goto :error_frontend

if exist "dist_anterior" rmdir /s /q "dist_anterior"
if exist "dist" ren "dist" "dist_anterior"
ren "dist_nuevo" "dist"
if errorlevel 1 goto :restore_frontend
if exist "dist_anterior" rmdir /s /q "dist_anterior"

echo [4/4] Actualizacion completada.
popd

echo.
echo Ya puedes ejecutar Iniciar_Cruzial.bat
echo Tus datos, SMTP, prompt y .env se mantienen.
pause
exit /b 0

:restore_frontend
if exist "dist" rmdir /s /q "dist"
if exist "dist_anterior" ren "dist_anterior" "dist"
echo [ERROR] No se pudo sustituir la interfaz compilada.
echo Comprueba que Cruzial esta cerrado y vuelve a intentarlo.
popd
pause
exit /b 1

:error_frontend
echo.
echo [ERROR] No se ha podido compilar la interfaz.
if exist "dist_nuevo" rmdir /s /q "dist_nuevo"
popd
pause
exit /b 1

:error
echo.
echo [ERROR] No se ha podido actualizar Cruzial.
echo Revisa los mensajes anteriores.
pause
exit /b 1
