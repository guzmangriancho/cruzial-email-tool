#!/bin/bash
set -u
cd "$(dirname "$0")" || exit 1

printf '\033]0;%s\007' "Cruzial Local"
echo "====================================================="
echo "               INICIANDO CRUZIAL LOCAL"
echo "====================================================="
echo

INSTALLER="./Instalar_Cruzial_Mac.command"
PYTHON="$PWD/venv-mac/bin/python"
URL="http://127.0.0.1:8000/clientes"
HEALTH="http://127.0.0.1:8000/health"
OPENAPI="http://127.0.0.1:8000/openapi.json"
REQUIRED_ROUTE="/api/configuracion/firma-email"
LOG_DIR="$PWD/logs"
STARTUP_LOG="$LOG_DIR/servidor-mac.log"

mkdir -p "$LOG_DIR"

run_installer() {
  echo "Falta completar o reparar la instalación para macOS."
  echo "Ejecutando Instalar_Cruzial_Mac.command..."
  if [[ ! -f "$INSTALLER" ]]; then
    echo "[ERROR] No existe $INSTALLER"
    exit 1
  fi
  chmod +x "$INSTALLER" 2>/dev/null || true
  "$INSTALLER" || exit 1
}

# El proyecto usa venv-mac en macOS. Si no existe, repara la instalación.
if [[ ! -f ".env" || ! -x "$PYTHON" ]]; then
  run_installer
fi

if [[ ! -x "$PYTHON" ]]; then
  echo "[ERROR] No se ha creado correctamente venv-mac/bin/python."
  echo "Ejecuta manualmente Instalar_Cruzial_Mac.command y revisa el error mostrado."
  exit 1
fi

# Comprueba que el entorno Python actual puede cargar el backend y que contiene
# la ruta requerida. Esto evita arrancar con un entorno incompleto o anticuado.
if ! "$PYTHON" -c "from backend.main import app; assert any(getattr(r, 'path', '') == '$REQUIRED_ROUTE' for r in app.routes)" >/dev/null 2>&1; then
  echo "[ERROR] El entorno Python no puede cargar correctamente el backend actual"
  echo "o no encuentra la ruta $REQUIRED_ROUTE."
  echo
  echo "Intentando reparar la instalación..."
  run_installer

  if ! "$PYTHON" -c "from backend.main import app; assert any(getattr(r, 'path', '') == '$REQUIRED_ROUTE' for r in app.routes)" >/dev/null 2>&1; then
    echo "[ERROR] La reparación no ha solucionado el backend."
    echo "Revisa $STARTUP_LOG o ejecuta:"
    echo "\"$PYTHON\" -c \"from backend.main import app; print([r.path for r in app.routes])\""
    exit 1
  fi
fi

# Recompila el frontend cuando el código fuente sea más nuevo que dist.
FRONTEND_STALE=0
if [[ ! -f "frontend/dist/index.html" ]]; then
  FRONTEND_STALE=1
elif find frontend/src frontend/package.json frontend/package-lock.json frontend/vite.config.ts \
  -type f -newer frontend/dist/index.html -print -quit 2>/dev/null | grep -q .; then
  FRONTEND_STALE=1
fi

if [[ "$FRONTEND_STALE" -eq 1 ]]; then
  echo "Se han detectado cambios en la interfaz. Recompilando..."

  NPM_BIN=""
  if command -v npm >/dev/null 2>&1; then
    NPM_BIN="$(command -v npm)"
  elif [[ -x /opt/homebrew/bin/npm ]]; then
    NPM_BIN="/opt/homebrew/bin/npm"
  elif [[ -x /usr/local/bin/npm ]]; then
    NPM_BIN="/usr/local/bin/npm"
  fi

  if [[ -z "$NPM_BIN" ]]; then
    echo "[ERROR] No se ha encontrado Node.js / npm."
    echo "Instala Node.js LTS para poder recompilar la interfaz."
    exit 1
  fi

  export PATH="$(dirname "$NPM_BIN"):$PATH"

  (
    cd frontend || exit 1

    if [[ ! -d node_modules ]]; then
      echo "Instalando dependencias del frontend..."
      "$NPM_BIN" install || exit 1
    fi

    "$NPM_BIN" run build || exit 1
  ) || {
    echo "[ERROR] No se pudo compilar la interfaz."
    exit 1
  }
fi

# Si ya hay algo escuchando en 8000, no asumimos que sea la versión correcta.
EXISTING_PID="$(lsof -tiTCP:8000 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"

if [[ -n "$EXISTING_PID" ]]; then
  # Si responde como Cruzial Y expone la ruta actual, reutilizamos el proceso.
  if curl -fsS --max-time 2 "$HEALTH" 2>/dev/null | grep -q '"ok"' \
     && curl -fsS --max-time 2 "$OPENAPI" 2>/dev/null | grep -q "\"$REQUIRED_ROUTE\""; then
    echo "Cruzial ya está iniciado con el backend actualizado."
    echo "Abriendo navegador..."
    open "$URL"
    exit 0
  fi

  EXISTING_CMD="$(ps -p "$EXISTING_PID" -o command= 2>/dev/null || true)"

  # Solo cerramos automáticamente el proceso si parece ser una instancia vieja
  # de este mismo backend. Nunca matamos un proceso ajeno que use el puerto 8000.
  if echo "$EXISTING_CMD" | grep -q "uvicorn" && echo "$EXISTING_CMD" | grep -q "backend.main:app"; then
    echo "Se ha detectado una instancia anterior de Cruzial en el puerto 8000."
    echo "Cerrando proceso antiguo (PID $EXISTING_PID)..."
    kill "$EXISTING_PID" 2>/dev/null || true

    for _ in $(seq 1 20); do
      if ! kill -0 "$EXISTING_PID" 2>/dev/null; then
        break
      fi
      sleep 0.25
    done

    if kill -0 "$EXISTING_PID" 2>/dev/null; then
      kill -9 "$EXISTING_PID" 2>/dev/null || true
    fi
  else
    echo "[ERROR] El puerto 8000 está ocupado por otro proceso:"
    echo "PID: $EXISTING_PID"
    echo "$EXISTING_CMD"
    echo
    echo "Ciérralo antes de iniciar Cruzial."
    exit 1
  fi
fi

echo "[1/2] Iniciando servidor local..."
echo "Python: $PYTHON"
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

# Esperamos hasta 90 segundos. No basta con /health: también comprobamos
# que OpenAPI contiene la ruta de firma, para no abrir una versión antigua.
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

  if curl -fsS --max-time 1 "$HEALTH" 2>/dev/null | grep -q '"ok"' \
     && curl -fsS --max-time 1 "$OPENAPI" 2>/dev/null | grep -q "\"$REQUIRED_ROUTE\""; then
    READY=1
    break
  fi

  if (( i % 20 == 0 )); then
    echo "  El backend sigue iniciándose... ($((i / 2)) s)"
  fi

  sleep 0.5
done

if [[ "$READY" -ne 1 ]]; then
  echo
  echo "[ERROR] El servidor arrancó, pero no expone correctamente $REQUIRED_ROUTE."
  echo "Últimas líneas del arranque:"
  echo "-----------------------------------------------------"
  tail -n 80 "$STARTUP_LOG" 2>/dev/null || true
  echo "-----------------------------------------------------"
  echo "Log completo: $STARTUP_LOG"
  exit 1
fi

echo "[2/2] Abriendo navegador..."
open "$URL"

echo
echo "Cruzial está funcionando en este Mac."
echo "Backend comprobado: $REQUIRED_ROUTE disponible."
echo "Mantén esta ventana abierta. Para detenerlo pulsa Control+C."
echo "BBDD: revisa CRUZIAL_DB_PATH en .env si está en un volumen de red."
echo

wait "$SERVER_PID"
