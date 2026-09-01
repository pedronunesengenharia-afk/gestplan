#!/usr/bin/env bash
# Aplica as migracoes num banco limpo e roda as suites.
#
# NAO sabe conversar com o Postgres: recebe isso pronto na variavel PSQL, que e
# um comando que le SQL da entrada padrao. Existe assim porque sao dois mundos
# com o mesmo conteudo — a maquina do Pedro fala com um container de Docker, a
# integracao continua fala com um servico do GitHub — e duas copias do mesmo
# roteiro divergem no primeiro teste novo.
#
#   PSQL='docker exec -i gestplan-teste psql -q -v ON_ERROR_STOP=1 -U postgres -d gestplan_teste'
#   PSQL='psql -q -v ON_ERROR_STOP=1 "postgresql://..."'
set -u
: "${PSQL:?defina PSQL com o comando que fala com o banco de teste}"

R() { eval "$PSQL" < "$1" 2>&1; }

R testes/00_stub_supabase.sql > /dev/null || { echo "falhou o stub"; exit 1; }

for f in supabase/migrations/*.sql; do
  saida=$(R "$f")
  if printf '%s' "$saida" | grep -qi "^ERROR"; then
    echo "FALHOU a migracao $(basename "$f")"
    printf '%s' "$saida" | grep -i "^ERROR" | head -3
    exit 1
  fi
done

total=0
falhou=0
# `[0-9][0-9]_` e nao `0[1-9]`: com o padrao antigo a decima suite nunca era
# encontrada, e o laco terminava em silencio dizendo que tudo passou. Suite que
# nao roda e pior que suite que falha.
for f in testes/[0-9][0-9]_*.sql; do
  case "$(basename "$f")" in 00_*) continue;; esac
  saida=$(R "$f")
  n=$(printf '%s' "$saida" | grep -c "^NOTICE:.*  ok   ")
  total=$((total + n))
  erro=$(printf '%s' "$saida" | grep -iE "FALHOU|^ERROR" | head -1)
  if [ -n "$erro" ]; then
    falhou=1
    printf "  %-28s %3d  <-- %s\n" "$(basename "$f")" "$n" "$erro"
  else
    printf "  %-28s %3d\n" "$(basename "$f")" "$n"
  fi
done
echo "  TOTAL: $total"
exit $falhou
