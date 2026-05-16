#!/bin/sh
# POSIX sh — Alpine'da bash yok. Windows CRLF bu dosyayı kırar; .gitattributes ile LF kullanın.
# Hata durumunda çıkmak için docker-compose: /bin/sh -e /entrypoint-wrapper.sh

EP="/usr/local/bin/docker-entrypoint.sh"
if [ ! -x "$EP" ] && command -v docker-entrypoint.sh >/dev/null 2>&1; then
  EP="docker-entrypoint.sh"
fi

"$EP" postgres &
PG_PID=$!

echo "Waiting for PostgreSQL to start..."
i=0
while [ "$i" -lt 60 ]; do
  if pg_isready -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
    psql -U "${POSTGRES_USER:-postgres}" -c "ALTER USER ${POSTGRES_USER:-postgres} PASSWORD '${POSTGRES_PASSWORD:-postgres}';" >/dev/null 2>&1 \
      && echo "Password synced for user ${POSTGRES_USER:-postgres}" || true
    break
  fi
  i=$((i + 1))
  sleep 1
done

wait "$PG_PID"
