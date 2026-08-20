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

python_ok() {
  "$1" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if sys.version_info >= (3, 11) else 1)
PY
}

find_python() {
  local c
  for c in python3.14 python3.13 python3.12 python3.11 python3; do
    if command -v "$c" >/dev/null 2>&1 && python_ok "$(command -v "$c")"; then
      command -v "$c"
      return 0
    fi
  done

  for c in \
    /usr/local/bin/python3.14 /usr/local/bin/python3.13 /usr/local/bin/python3.12 /usr/local/bin/python3.11 \
    /opt/homebrew/bin/python3.14 /opt/homebrew/bin/python3.13 /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 \
    /usr/local/opt/python@3.13/bin/python3.13 /opt/homebrew/opt/python@3.13/bin/python3.13; do
    if [[ -x "$c" ]] && python_ok "$c"; then
      echo "$c"
      return 0
    fi
  done

  if command -v brew >/dev/null 2>&1; then
    for formula in python@3.13 python@3.12 python@3.11; do
      local prefix
      prefix="$(brew --prefix "$formula" 2>/dev/null || true)"
      if [[ -n "$prefix" ]]; then
        for c in "$prefix"/bin/python3.* "$prefix"/libexec/bin/python3; do
          if [[ -x "$c" ]] && python_ok "$c"; then
            echo "$c"
            return 0
          fi
        done
      fi
    done
  fi
  return 1
}

PYTHON_BOOTSTRAP="$(find_python || true)"
if [[ -z "$PYTHON_BOOTSTRAP" ]]; then
  echo "[ERROR] Se necesita Python 3.11 o superior."
  echo "No se ha encontrado una versión compatible."
  echo "En macOS Ventura, si ya instalaste python@3.13 con Homebrew, prueba:"
  echo "  brew postinstall python@3.13"
  exit 1
fi

echo "Python detectado: $($PYTHON_BOOTSTRAP --version 2>&1)"
echo "Ruta: $PYTHON_BOOTSTRAP"
echo

# Node solo hace falta para compilar la interfaz la primera vez.
NEED_FRONTEND_BUILD=1
if [[ -f "frontend/dist/index.html" ]]; then
  NEED_FRONTEND_BUILD=0
fi

NODE_BIN=""
NPM_BIN=""
if [[ "$NEED_FRONTEND_BUILD" -eq 1 ]]; then
  if command -v node >/dev/null 2>&1; then NODE_BIN="$(command -v node)"; fi
  if command -v npm >/dev/null 2>&1; then NPM_BIN="$(command -v npm)"; fi

  [[ -z "$NODE_BIN" && -x /usr/local/bin/node ]] && NODE_BIN=/usr/local/bin/node
  [[ -z "$NODE_BIN" && -x /opt/homebrew/bin/node ]] && NODE_BIN=/opt/homebrew/bin/node
  [[ -z "$NPM_BIN" && -x /usr/local/bin/npm ]] && NPM_BIN=/usr/local/bin/npm
  [[ -z "$NPM_BIN" && -x /opt/homebrew/bin/npm ]] && NPM_BIN=/opt/homebrew/bin/npm

  if [[ -z "$NODE_BIN" || -z "$NPM_BIN" ]]; then
    echo "[ERROR] No se ha encontrado Node.js / npm."
    echo
    echo "En macOS Ventura NO recomendamos instalar Node 22 con Homebrew,"
    echo "porque puede compilar muchas dependencias desde cero."
    echo "Instala Node.js 22 con el instalador oficial de macOS desde:"
    echo "  https://nodejs.org/en/download/archive/v22"
    echo
    echo "Después vuelve a abrir Iniciar_Cruzial_Mac.command."
    exit 1
  fi

  if ! "$NODE_BIN" - <<'JS'
const [major, minor] = process.versions.node.split('.').map(Number);
const ok = major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19);
process.exit(ok ? 0 : 1);
JS
  then
    echo "[ERROR] La versión de Node.js es demasiado antigua."
    echo "Actual: $($NODE_BIN --version). Se necesita Node 20.19+ o 22.12+."
    exit 1
  fi

  export PATH="$(dirname "$NODE_BIN"):$PATH"
  echo "Node detectado: $($NODE_BIN --version)"
  echo "npm detectado: $($NPM_BIN --version)"
  echo
fi

if [[ ! -f ".env" ]]; then
  cp ".env.example" ".env"
  SECRET="$($PYTHON_BOOTSTRAP - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
  "$PYTHON_BOOTSTRAP" - "$SECRET" <<'PY'
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
  "$PYTHON_BOOTSTRAP" -m venv venv-mac
else
  echo "[1/5] Entorno Python para macOS ya existente."
fi

PYTHON="$PWD/venv-mac/bin/python"
echo "[2/5] Actualizando pip..."
"$PYTHON" -m pip install --upgrade pip

echo "[3/5] Instalando backend..."
"$PYTHON" -m pip install -r backend/requirements.txt

if [[ "$NEED_FRONTEND_BUILD" -eq 1 ]]; then
  echo "[4/5] Instalando frontend..."
  (
    cd frontend
    "$NPM_BIN" install
    echo "[5/5] Compilando interfaz..."
    "$NPM_BIN" run build
  )
else
  echo "[4/5] Frontend ya compilado."
  echo "[5/5] No es necesario recompilar la interfaz."
fi

chmod +x Instalar_Cruzial_Mac.command Iniciar_Cruzial_Mac.command Actualizar_Cruzial_1.4.0_Mac.command 2>/dev/null || true

echo
echo "Instalación completada."
echo "Para Maps, asegúrate de tener Google Chrome instalado."
echo "Ya puedes abrir Iniciar_Cruzial_Mac.command."
echo
read -r -p "Pulsa Intro para cerrar..." _ || true
