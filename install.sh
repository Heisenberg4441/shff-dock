#!/usr/bin/env bash
#
# SHFF Dock — установка одной командой:
#
#   curl -fsSL https://raw.githubusercontent.com/Heisenberg4441/shff-dock/master/install.sh | sudo bash
#
# Скрипт доводит машину до рабочей панели: обновляет пакеты, ставит докер,
# готовит /home/dock и поднимает панель из готового образа. Собирать ничего не
# нужно — образ уже лежит на Docker Hub.
#
# Повторный запуск обновляет панель до свежего образа и не трогает данные.

set -euo pipefail

IMAGE="${DOCK_IMAGE:-heisenberg4441/shff-dock:latest}"
DOCK_ROOT="${DOCK_ROOT:-/home/dock}"
INSTALL_DIR="${DOCK_INSTALL_DIR:-/opt/shff-dock}"
PANEL_PORT="${DOCK_PANEL_PORT:-7788}"
NETWORK="${DOCK_NETWORK:-dock}"
DO_UPGRADE=1

# ── вывод ─────────────────────────────────────────────────────────────────────

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_DIM=$'\033[2m'; C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_OFF=$'\033[0m'
else
  C_DIM=''; C_OK=''; C_WARN=''; C_ERR=''; C_OFF=''
fi

step() { printf '\n%s==>%s %s\n' "$C_OK" "$C_OFF" "$1"; }
info() { printf '    %s%s%s\n' "$C_DIM" "$1" "$C_OFF"; }
warn() { printf '%s ! %s %s\n' "$C_WARN" "$C_OFF" "$1" >&2; }
die()  { printf '\n%s ✗ %s %s\n' "$C_ERR" "$C_OFF" "$1" >&2; exit 1; }

usage() {
  cat <<'TXT'
SHFF Dock — установка панели управления контейнерами.

  curl -fsSL https://raw.githubusercontent.com/Heisenberg4441/shff-dock/master/install.sh | sudo bash

Ключи (после `bash -s --`):
  --port N        порт панели, по умолчанию 7788
  --root PATH     корень раскладки, по умолчанию /home/dock
  --no-upgrade    не делать apt upgrade, только apt update
  --help          эта справка

Те же значения читаются из переменных окружения: DOCK_PANEL_PORT, DOCK_ROOT,
DOCK_NETWORK, DOCK_IMAGE, DOCK_REGISTRY_URL.
TXT
}

while [ $# -gt 0 ]; do
  case "$1" in
    --port)       PANEL_PORT="${2:?--port требует значения}"; shift 2 ;;
    --root)       DOCK_ROOT="${2:?--root требует значения}"; shift 2 ;;
    --no-upgrade) DO_UPGRADE=0; shift ;;
    --help|-h)    usage; exit 0 ;;
    *)            die "неизвестный ключ $1 (--help покажет список)" ;;
  esac
done

case "$PANEL_PORT" in
  ''|*[!0-9]*) die "порт должен быть числом, а не «$PANEL_PORT»" ;;
esac
case "$DOCK_ROOT" in
  /*) ;;
  *)  die "корень раскладки должен быть абсолютным путём, а не «$DOCK_ROOT»" ;;
esac

# ── проверки окружения ────────────────────────────────────────────────────────

[ "$(id -u)" -eq 0 ] || die "нужны права root: повторите через sudo"

step "Проверяю систему"

[ -r /etc/os-release ] || die "не нашёл /etc/os-release — система не опознаётся"
# shellcheck disable=SC1091
. /etc/os-release

OS_ID="${ID:-unknown}"
OS_LIKE="${ID_LIKE:-}"
CODENAME="${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}"
info "${PRETTY_NAME:-$OS_ID} · $(uname -m)"

command -v apt-get >/dev/null 2>&1 || die \
  "скрипт рассчитан на Debian и Ubuntu (нужен apt-get). Поставьте docker вручную и запустите ещё раз."

# Docker публикует пакеты для debian и ubuntu; производные вроде Raspberry Pi OS
# и Mint берут репозиторий родителя.
case "$OS_ID" in
  ubuntu)          DOCKER_DISTRO=ubuntu ;;
  debian|raspbian) DOCKER_DISTRO=debian ;;
  *)
    case " $OS_LIKE " in
      *ubuntu*) DOCKER_DISTRO=ubuntu; CODENAME="${UBUNTU_CODENAME:-$CODENAME}" ;;
      *debian*) DOCKER_DISTRO=debian ;;
      *) die "$PRETTY_NAME не из семейства Debian/Ubuntu — поставьте docker вручную и запустите ещё раз" ;;
    esac
    ;;
esac

export DEBIAN_FRONTEND=noninteractive
APT_OPTS=(-y -o Dpkg::Options::=--force-confold -o Dpkg::Options::=--force-confdef)

# ── пакеты ────────────────────────────────────────────────────────────────────

step "Обновляю списки пакетов"
apt-get update -qq

if [ "$DO_UPGRADE" -eq 1 ]; then
  step "Обновляю систему"
  info "это apt upgrade всей машины; пропустить — ключ --no-upgrade"
  apt-get upgrade "${APT_OPTS[@]}" -qq
fi

step "Ставлю базовые пакеты"
apt-get install "${APT_OPTS[@]}" -qq ca-certificates curl gnupg >/dev/null

# ── докер ─────────────────────────────────────────────────────────────────────

install_docker() {
  step "Ставлю докер"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${DOCKER_DISTRO}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  [ -n "$CODENAME" ] || die "не определил кодовое имя релиза — репозиторий докера не прописать"

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DOCKER_DISTRO} ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install "${APT_OPTS[@]}" -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null

  systemctl enable --now docker >/dev/null 2>&1 || true
}

if command -v docker >/dev/null 2>&1; then
  info "докер уже стоит: $(docker --version 2>/dev/null || echo 'версия не читается')"
  if ! docker compose version >/dev/null 2>&1; then
    step "Доставляю плагин compose"
    apt-get install "${APT_OPTS[@]}" -qq docker-compose-plugin >/dev/null \
      || die "не поставился docker-compose-plugin — панель поднимает стеки именно им"
  fi
else
  install_docker
fi

docker compose version >/dev/null 2>&1 || die "docker compose так и не появился, дальше идти незачем"

# Докер мог быть установлен, но лежать. Панель без демона бесполезна.
if ! docker info >/dev/null 2>&1; then
  systemctl start docker >/dev/null 2>&1 || true
  sleep 2
  docker info >/dev/null 2>&1 || die "демон докера не отвечает: проверьте systemctl status docker"
fi

# ── раскладка ─────────────────────────────────────────────────────────────────

step "Готовлю раскладку"

# Каталоги данных стеков создаются от имени того, кто запустил sudo, — иначе
# всё окажется во владении root и сервисы не смогут туда писать.
PUID="${SUDO_UID:-1000}"
PGID="${SUDO_GID:-1000}"

# Кого показывать оператором в панели. Через sudo это известно наверняка;
# при запуске от чистого root пусто — панель поищет владельца PUID в /etc/passwd.
OPERATOR="${DOCK_OPERATOR:-${SUDO_USER:-}}"

mkdir -p "$DOCK_ROOT" "$INSTALL_DIR"
info "данные:  $DOCK_ROOT"
info "конфиг:  $INSTALL_DIR/docker-compose.yml"

cat > "$INSTALL_DIR/docker-compose.yml" <<YAML
# Создано install.sh — правьте, если понимаете, что делаете.
#
#   cd $INSTALL_DIR && docker compose up -d

services:
  dock:
    image: \${DOCK_IMAGE}
    container_name: shff-dock
    restart: unless-stopped

    ports:
      - "\${DOCK_PANEL_PORT}:7788"

    volumes:
      # Управление контейнерами хоста.
      - /var/run/docker.sock:/var/run/docker.sock

      # Раскладка стеков. Путь одинаков внутри и снаружи — только поэтому
      # bind-монтирования, которые панель пишет в compose-файлы стеков,
      # разрешаются на хосте в те же каталоги.
      - \${DOCK_ROOT}:\${DOCK_ROOT}

      # Метрики про железо, а не про контейнер.
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/host/rootfs:ro

    environment:
      DOCK_DRIVER: docker
      DOCK_ROOT: \${DOCK_ROOT}
      DOCK_DOCKER_SOCKET: /var/run/docker.sock
      DOCK_NETWORK: \${DOCK_NETWORK}
      DOCK_PUID: \${DOCK_PUID}
      DOCK_PGID: \${DOCK_PGID}
      DOCK_REGISTRY_URL: \${DOCK_REGISTRY_URL}
      DOCK_REGISTRY_TTL: \${DOCK_REGISTRY_TTL}
      # Имя хоста и часовой пояс панель определяет по /host/rootfs сама;
      # оператора точнее знает установщик — из sudo.
      DOCK_OPERATOR: \${DOCK_OPERATOR}
      LOG_LEVEL: \${LOG_LEVEL}

    networks:
      - dock

# Та же сеть, в которую панель включает поднятые ею стеки.
networks:
  dock:
    name: \${DOCK_NETWORK}
YAML

# .env перезаписывается только тем, что скрипт знает наверняка; всё остальное,
# что человек мог туда дописать руками, сохраняется.
ENV_FILE="$INSTALL_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  info "нашёл прежний .env, сохраняю как .env.bak"
  cp "$ENV_FILE" "$ENV_FILE.bak"
fi

cat > "$ENV_FILE" <<ENV
DOCK_IMAGE=$IMAGE
DOCK_PANEL_PORT=$PANEL_PORT
DOCK_ROOT=$DOCK_ROOT
DOCK_NETWORK=$NETWORK
DOCK_PUID=$PUID
DOCK_PGID=$PGID

# Пусто — панель определит по хосту сама.
DOCK_OPERATOR=$OPERATOR

# Пусто — берётся реестр SHFF. Свой репозиторий стеков указывается raw-адресом:
# https://raw.githubusercontent.com/<owner>/<repo>/<ref>
DOCK_REGISTRY_URL=${DOCK_REGISTRY_URL:-}
DOCK_REGISTRY_TTL=${DOCK_REGISTRY_TTL:-60}

LOG_LEVEL=${LOG_LEVEL:-info}
ENV
chmod 600 "$ENV_FILE"

# ── запуск ────────────────────────────────────────────────────────────────────

# Имя проекта задаётся явно: тогда повторный запуск обновляет тот же
# контейнер, а не спорит с прежним за имя shff-dock.
compose() { docker compose -p shff-dock -f "$INSTALL_DIR/docker-compose.yml" "$@"; }

step "Тяну образ панели"
compose pull --quiet || die "не скачался $IMAGE — проверьте сеть и имя образа"

step "Поднимаю панель"
compose up -d

step "Жду, пока панель ответит"
READY=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PANEL_PORT}/api/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done

LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
[ -n "$LAN_IP" ] || LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$LAN_IP" ] || LAN_IP="<адрес-хоста>"

if [ "$READY" -eq 1 ]; then
  printf '\n%s ✓ %s Панель поднята: %shttp://%s:%s%s\n\n' \
    "$C_OK" "$C_OFF" "$C_OK" "$LAN_IP" "$PANEL_PORT" "$C_OFF"
else
  warn "панель не ответила за две минуты — образ скачан и контейнер запущен, но здоровье не подтвердилось"
  printf '    %sжурнал: docker logs shff-dock%s\n\n' "$C_DIM" "$C_OFF"
fi

cat <<TXT
${C_DIM}журнал:${C_OFF}    docker logs -f shff-dock
${C_DIM}обновить:${C_OFF}  повторите эту же команду установки
${C_DIM}погасить:${C_OFF}  docker compose -p shff-dock -f $INSTALL_DIR/docker-compose.yml down
${C_DIM}данные:${C_OFF}    $DOCK_ROOT ${C_DIM}(остаются после docker compose down)${C_OFF}
TXT

[ "$READY" -eq 1 ] || exit 1
