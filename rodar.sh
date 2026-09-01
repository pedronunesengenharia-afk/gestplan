#!/usr/bin/env bash
# Roda as suites contra um Postgres descartavel no container `gestplan-teste`.
#
# O rodar_testes.bat procura psql no PATH ou o container do Supabase local;
# esta maquina nao tem nenhum dos dois, entao este atalho fala direto com um
# container `postgres:16`. O roteiro em si vive em ferramentas/rodar_suites.sh,
# que a integracao continua tambem usa.
set -u
cd "$(dirname "$0")"
C=gestplan-teste

docker start $C > /dev/null 2>&1
# `with (force)` derruba conexao aberta: sem isso o drop falha calado e as
# migracoes rodam por cima do banco velho — e o erro que aparece e
# "relation already exists", que nao diz nada sobre a causa.
docker exec $C psql -U postgres -c "drop database if exists gestplan_teste with (force)" > /dev/null 2>&1
docker exec $C psql -U postgres -c "create database gestplan_teste" > /dev/null 2>&1 \
  || { echo "nao consegui criar o banco de teste — o Docker esta de pe?"; exit 1; }

PSQL='docker exec -i gestplan-teste psql -q -v ON_ERROR_STOP=1 -U postgres -d gestplan_teste' \
  ferramentas/rodar_suites.sh
