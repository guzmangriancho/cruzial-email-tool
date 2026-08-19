#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

printf '\033]0;%s\007' "Cruzial Local"
echo "====================================================="
echo "               INICIANDO CRUZIAL LOCAL"
echo "====================================================="
echo

if [[ ! -f ".env" || ! -x "venv-mac/bin/python" || ! -f "frontend/dist/index.html" ]]; then
  echo "Falta completar la instalación para macOS."
  echo "Ejecutando Instalar_Cruzial_Mac.command..."
  ./Instalar_Cruzial_Mac.command
fi

PYTHON="$PWD/venv-mac/bin/python"
URL="http://127.0.0.1:8000/clientes"
HEALTH="http://127.0.0.1:8000/health"

# Si Cruzial ya está ejecutándose en este Mac, simplemente abre el navegador.
if curl -fsS --max-time 1 "$HEALTH" 2>/dev/null | grep -q '"ok"'; then
  echo "Cruzial ya está iniciado. Abriendo navegador..."
  open "$URL"
  exit 0
fi

echo "[1/2] Iniciando servidor local..."
"$PYTHON" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

READY=0
for _ in {1..40}; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[ERROR] Cruzial se ha cerrado durante el arranque."
    echo "Revisa logs/cruzial.log."
    wait "$SERVER_PID" || true
    exit 1
  fi
  if curl -fsS --max-time 1 "$HEALTH" 2>/dev/null | grep -q '"ok"'; then
    READY=1
    break
  fi
  sleep 0.25
done

if [[ "$READY" -ne 1 ]]; then
  echo "[ERROR] El servidor no respondió a tiempo. Revisa logs/cruzial.log."
  exit 1
fi

echo "[2/2] Abriendo navegador..."
open "$URL"
echo
echo "Cruzial está funcionando en este Mac."
echo "Mantén esta ventana abierta. Para detenerlo pulsa Control+C."
echo "BBDD: revisa CRUZIAL_DB_PATH en .env si está en un volumen de red."
echo
wait "$SERVER_PID"
