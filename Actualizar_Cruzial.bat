@echo off
setlocal
cd /d "%~dp0"
title Actualizar Cruzial Local
color 0B

echo =====================================================
echo              ACTUALIZAR CRUZIAL LOCAL
echo =====================================================
echo.

echo Cierra Cruzial antes de continuar para que el siguiente
echo arranque use todos los archivos actualizados.
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git no esta instalado o no esta en PATH.
  echo Instala Git para Windows y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] Esta carpeta no es un repositorio Git.
  echo Debes ejecutar este archivo dentro de la copia clonada con git clone.
  pause
  exit /b 1
)

echo [1/4] Descargando cambios con git pull...
git pull --ff-only
if errorlevel 1 goto :git_error

if not exist "venv\Scripts\python.exe" (
  echo [2/4] No existe el entorno Python. Ejecutando instalador...
  call Instalar_Cruzial.bat
  if errorlevel 1 goto :error
  goto :done
)

echo [2/4] Actualizando dependencias del backend...
"venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 goto :error

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se ha encontrado Node.js / npm.
  echo Instala Node.js LTS para poder recompilar la interfaz.
  pause
  exit /b 1
)

echo [3/4] Actualizando dependencias del frontend...
pushd frontend
call npm install
if errorlevel 1 (
  popd
  goto :error
)

echo [4/4] Compilando interfaz actualizada...
call npm run build
if errorlevel 1 (
  popd
  goto :error
)
popd

:done
echo.
echo Actualizacion completada correctamente.
echo Ya puedes abrir Iniciar_Cruzial.bat
pause
exit /b 0

:git_error
echo.
echo [ERROR] Git no pudo aplicar la actualizacion automaticamente.
echo Si tienes cambios locales en archivos versionados, guardalos o revisalos antes de repetir.
pause
exit /b 1

:error
echo.
echo [ERROR] La actualizacion no ha terminado correctamente.
echo Revisa los mensajes anteriores.
pause
exit /b 1
