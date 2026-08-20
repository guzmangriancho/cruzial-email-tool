#!/bin/bash
set -u
cd "$(dirname "$0")" || exit 1

printf '\033]0;%s\007' "Cruzial Local"
echo "====================================================="
echo "               INICIANDO CRUZIAL LOCAL"
echo "====================================================="
echo

if [[ ! -f ".env" || ! -x "venv-mac/bin/python" || ! -f "frontend/dist/index.html" ]]; then
  echo "Falta completar la instalación para macOS."
  echo "Ejecutando Instalar_Cruzial_Mac.command..."
  ./Instalar_Cruzial_Mac.command || exit 1
fi

PYTHON="$PWD/venv-mac/bin/python"
URL="http://127.0.0.1:8000/clientes"
HEALTH="http://127.0.0.1:8000/health"
LOG_DIR="$PWD/logs"
STARTUP_LOG="$LOG_DIR/servidor-mac.log"
mkdir -p "$LOG_DIR"

# Si Cruzial ya está ejecutándose en este Mac, simplemente abre el navegador.
if curl -fsS --max-time 1 "$HEALTH" 2>/dev/null | grep -q '"ok"'; then
  echo "Cruzial ya está iniciado. Abriendo navegador..."
  open "$URL"
  exit 0
fi

echo "[1/2] Iniciando servidor local..."
echo "Registro de arranque: $STARTUP_LOG"
echo "----- $(date '+%Y-%m-%d %H:%M:%S') nuevo arranque -----" >> "$STARTUP_LOG"
"$PYTHON" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 >> "$STARTUP_LOG" 2>&1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

READY=0
# Hasta 90 s: suficiente para una primera apertura lenta o una BBDD SMB ocupada.
for i in $(seq 1 180); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo
    echo "[ERROR] Cruzial se ha cerrado durante el arranque."
    echo "Últimas líneas del error:"
    echo "-----------------------------------------------------"
    tail -n 80 "$STARTUP_LOG" 2>/dev/null || true
    echo "-----------------------------------------------------"
    echo "Log completo: $STARTUP_LOG"
    exit 1
  fi

  if curl -fsS --max-time 1 "$HEALTH" 2>/dev/null | grep -q '"ok"'; then
    READY=1
    break
  fi

  # Feedback cada 10 segundos, sin llenar la consola.
  if (( i % 20 == 0 )); then
    echo "  El backend sigue iniciándose... ($((i / 2)) s)"
  fi
  sleep 0.5
done

if [[ "$READY" -ne 1 ]]; then
  echo
  echo "[ERROR] El servidor no respondió después de 90 segundos."
  echo "Últimas líneas del arranque:"
  echo "-----------------------------------------------------"
  tail -n 80 "$STARTUP_LOG" 2>/dev/null || true
  echo "-----------------------------------------------------"
  echo "Comprueba también CRUZIAL_DB_PATH en .env y que el volumen de red esté montado."
  echo "Log completo: $STARTUP_LOG"
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
