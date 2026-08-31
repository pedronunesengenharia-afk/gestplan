#!/usr/bin/env bash
# Roda as suites num banco descartavel dentro do container `gestplan-teste`.
# O rodar_testes.bat procura psql ou o container do Supabase local; nesta
# maquina nao ha nenhum dos dois, entao este atalho fala com o container direto.
set -u
cd "$(dirname "$0")"
C=gestplan-teste
docker start $C >/dev/null 2>&1
docker exec $C psql -U postgres -c "drop database if exists gestplan_teste" \
                    -c "create database gestplan_teste" >/dev/null 2>&1
R() { docker exec -i $C psql -q -v ON_ERROR_STOP=1 -U postgres -d gestplan_teste < "$1" 2>&1; }
R testes/00_stub_supabase.sql >/dev/null
for f in supabase/migrations/*.sql; do
  R "$f" >/dev/null 2>&1 || { echo "FALHOU a migracao $(basename "$f")"; R "$f" | grep -i error | head -3; exit 1; }
done
tot=0; falhou=0
for f in testes/0[1-9]*.sql; do
  saida=$(R "$f")
  n=$(printf '%s' "$saida" | grep -c "^NOTICE:.*  ok   ")
  tot=$((tot+n))
  erro=$(printf '%s' "$saida" | grep -iE "FALHOU|^ERROR" | head -1)
  if [ -n "$erro" ]; then falhou=1; printf "  %-28s %3d  <-- %s\n" "$(basename "$f")" "$n" "$erro"
  else printf "  %-28s %3d\n" "$(basename "$f")" "$n"; fi
done
echo "  TOTAL: $tot"
exit $falhou
