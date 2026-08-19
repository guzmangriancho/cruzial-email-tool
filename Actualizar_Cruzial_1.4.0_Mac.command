#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

printf '\033]0;%s\007' "Actualizar Cruzial Local 1.4.0 - macOS"
echo "====================================================="
echo "       ACTUALIZAR CRUZIAL LOCAL 1.4.0 - macOS"
echo "====================================================="
echo
echo "Cierra Cruzial antes de continuar."
echo "Este proceso NO sustituye .env ni tu archivo .db."
echo

if [[ ! -x "venv-mac/bin/python" ]]; then
  echo "No existe el entorno de macOS. Ejecutando instalador..."
  ./Instalar_Cruzial_Mac.command
  exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] No se ha encontrado Node.js / npm."
  exit 1
fi

PYTHON="$PWD/venv-mac/bin/python"
echo "[1/3] Actualizando dependencias del backend..."
"$PYTHON" -m pip install -r backend/requirements.txt

echo "[2/3] Preparando dependencias del frontend..."
(
  cd frontend
  if [[ ! -d node_modules ]]; then
    npm install
  fi
  rm -rf dist_nuevo
  echo "[3/3] Compilando interfaz..."
  npm run build -- --outDir dist_nuevo
  rm -rf dist_anterior
  if [[ -d dist ]]; then mv dist dist_anterior; fi
  mv dist_nuevo dist
  rm -rf dist_anterior
)

chmod +x Instalar_Cruzial_Mac.command Iniciar_Cruzial_Mac.command Actualizar_Cruzial_1.4.0_Mac.command 2>/dev/null || true

echo
echo "Actualización completada."
echo "Ya puedes abrir Iniciar_Cruzial_Mac.command."
read -r -p "Pulsa Intro para cerrar..." _ || true
