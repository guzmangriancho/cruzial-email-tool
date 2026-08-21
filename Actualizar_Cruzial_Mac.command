#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

printf '\033]0;%s\007' "Actualizar Cruzial Local"
echo "====================================================="
echo "             ACTUALIZAR CRUZIAL LOCAL"
echo "====================================================="
echo
echo "Cierra Cruzial antes de continuar para que el siguiente"
echo "arranque use todos los archivos actualizados."
echo

if ! command -v git >/dev/null 2>&1; then
  echo "[ERROR] Git no está instalado o no está disponible en PATH."
  read -r -p "Pulsa Intro para cerrar..." _ || true
  exit 1
fi

if [[ ! -d ".git" ]]; then
  echo "[ERROR] Esta carpeta no es un repositorio Git."
  echo "Debes ejecutar este archivo dentro de la copia clonada con git clone."
  read -r -p "Pulsa Intro para cerrar..." _ || true
  exit 1
fi

echo "[1/4] Descargando cambios con git pull..."
if ! git pull --ff-only; then
  echo
  echo "[ERROR] Git no pudo aplicar la actualización automáticamente."
  echo "Si tienes cambios locales en archivos versionados, guárdalos o revísalos antes de repetir."
  read -r -p "Pulsa Intro para cerrar..." _ || true
  exit 1
fi

PYTHON="$PWD/venv-mac/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  echo "[2/4] No existe el entorno Python. Ejecutando instalador de macOS..."
  chmod +x Instalar_Cruzial_Mac.command 2>/dev/null || true
  ./Instalar_Cruzial_Mac.command
  exit $?
fi

echo "[2/4] Actualizando dependencias del backend..."
"$PYTHON" -m pip install -r backend/requirements.txt

NPM_BIN=""
if command -v npm >/dev/null 2>&1; then NPM_BIN="$(command -v npm)"; fi
[[ -z "$NPM_BIN" && -x /usr/local/bin/npm ]] && NPM_BIN=/usr/local/bin/npm
[[ -z "$NPM_BIN" && -x /opt/homebrew/bin/npm ]] && NPM_BIN=/opt/homebrew/bin/npm

if [[ -z "$NPM_BIN" ]]; then
  echo "[ERROR] No se ha encontrado Node.js / npm."
  echo "Instala Node.js para poder recompilar la interfaz."
  read -r -p "Pulsa Intro para cerrar..." _ || true
  exit 1
fi

export PATH="$(dirname "$NPM_BIN"):$PATH"
echo "[3/4] Actualizando dependencias del frontend..."
(
  cd frontend
  "$NPM_BIN" install
  echo "[4/4] Compilando interfaz actualizada..."
  "$NPM_BIN" run build
)

echo
echo "Actualización completada correctamente."
echo "Ya puedes abrir Iniciar_Cruzial_Mac.command"
echo
read -r -p "Pulsa Intro para cerrar..." _ || true
