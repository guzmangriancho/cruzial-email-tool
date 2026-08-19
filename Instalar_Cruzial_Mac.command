#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

printf '\033]0;%s\007' "Instalador - Cruzial Local (macOS)"
echo "====================================================="
echo "       INSTALACIÓN CRUZIAL LOCAL - macOS"
echo "====================================================="
echo

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[ERROR] Este instalador es para macOS."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[ERROR] No se ha encontrado Python 3."
  echo "Instala Python 3.11 o superior y vuelve a ejecutar este archivo."
  exit 1
fi

if ! python3 - <<'PY'
import sys
raise SystemExit(0 if sys.version_info >= (3, 11) else 1)
PY
then
  echo "[ERROR] Se necesita Python 3.11 o superior."
  python3 --version || true
  echo "Puedes instalar una versión actual desde python.org o con Homebrew."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] No se ha encontrado Node.js / npm."
  echo "Instala Node.js LTS y vuelve a ejecutar este archivo."
  exit 1
fi

if ! node - <<'JS'
const [major, minor] = process.versions.node.split('.').map(Number);
const ok = major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19);
process.exit(ok ? 0 : 1);
JS
then
  echo "[ERROR] La versión de Node.js es demasiado antigua para esta interfaz."
  echo "Actual: $(node --version). Se necesita Node 20.19+ o 22.12+."
  exit 1
fi

if [[ ! -f ".env" ]]; then
  cp ".env.example" ".env"
  SECRET="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  python3 - "$SECRET" <<'PY'
from pathlib import Path
import sys
p = Path('.env')
s = p.read_text(encoding='utf-8')
s = s.replace('CAMBIAR_POR_UNA_CLAVE_ALEATORIA_LARGA', sys.argv[1])
p.write_text(s, encoding='utf-8')
PY
  echo "[AVISO] Se ha creado .env con una clave local aleatoria."
fi
chmod 600 .env 2>/dev/null || true
mkdir -p logs

if [[ ! -x "venv-mac/bin/python" ]]; then
  echo "[1/5] Creando entorno Python para macOS..."
  python3 -m venv venv-mac
else
  echo "[1/5] Entorno Python para macOS ya existente."
fi

PYTHON="$PWD/venv-mac/bin/python"
echo "[2/5] Actualizando pip..."
"$PYTHON" -m pip install --upgrade pip

echo "[3/5] Instalando backend..."
"$PYTHON" -m pip install -r backend/requirements.txt

echo "[4/5] Instalando frontend..."
(
  cd frontend
  npm install
  echo "[5/5] Compilando interfaz..."
  npm run build
)

chmod +x Instalar_Cruzial_Mac.command Iniciar_Cruzial_Mac.command Actualizar_Cruzial_1.4.0_Mac.command 2>/dev/null || true

echo
echo "Instalación completada."
echo "Para Maps, asegúrate de tener Google Chrome instalado."
echo "Ya puedes abrir Iniciar_Cruzial_Mac.command."
echo
read -r -p "Pulsa Intro para cerrar..." _ || true
