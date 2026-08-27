@echo off
REM ============================================================================
REM GestPlan - aplica as migracoes num Postgres descartavel e roda as suites.
REM
REM Acha sozinho com que Postgres falar, nesta ordem:
REM   1. psql no PATH          (Postgres instalado no Windows)
REM   2. o container do Supabase local (precisa de "supabase start" rodando)
REM
REM Uso:  rodar_testes.bat            (banco "gestplan_teste")
REM       rodar_testes.bat meubanco
REM
REM O banco de teste e APAGADO e recriado a cada execucao. Ele nao tem nada a
REM ver com o seu banco de producao no Supabase - roda so na sua maquina.
REM ============================================================================
setlocal enabledelayedexpansion

if "%~1"=="" (set BANCO=gestplan_teste) else (set BANCO=%~1)
if "%PGUSER%"=="" set PGUSER=postgres

set MODO=
set CONTAINER=

where psql >nul 2>&1
if %errorlevel%==0 set MODO=LOCAL

if not defined MODO (
  where docker >nul 2>&1
  if !errorlevel!==0 (
    for /f "delims=" %%c in ('docker ps --filter "name=supabase_db" --format "{{.Names}}" 2^>nul') do set CONTAINER=%%c
    if defined CONTAINER set MODO=DOCKER
  )
)

if not defined MODO goto :semPostgres

if "%MODO%"=="LOCAL"  echo  Postgres: psql local, usuario %PGUSER%
if "%MODO%"=="DOCKER" echo  Postgres: container %CONTAINER% (Supabase local)
echo  Banco de teste: %BANCO%
echo.

call :recriar || goto :erro

echo  [1/3] stub do Supabase (auth.users, papeis)
call :roda "testes\00_stub_supabase.sql" || goto :erro

echo  [2/3] migracoes
for %%f in (supabase\migrations\*.sql) do (
  echo        %%~nxf
  call :roda "%%f" || goto :erro
)

echo  [3/3] suites
REM Roda toda suite testes\0N_*.sql em ordem, menos o stub. Suite nova entra
REM so criando o arquivo — nada a alterar aqui.
for %%f in (testes\0*.sql) do (
  if /i not "%%~nxf"=="00_stub_supabase.sql" (
    echo        %%~nxf
    call :roda "%%f" || goto :erro
  )
)

echo.
echo  ==========================================
echo   Tudo passou.
echo  ==========================================
echo.
exit /b 0


REM ---------------------------------------------------------------------------
:recriar
if "%MODO%"=="LOCAL" (
  psql -q -U %PGUSER% -d postgres -c "drop database if exists %BANCO%" >nul 2>&1
  psql -q -U %PGUSER% -d postgres -c "create database %BANCO%"
) else (
  docker exec -i %CONTAINER% psql -q -U postgres -d postgres -c "drop database if exists %BANCO%" >nul 2>&1
  docker exec -i %CONTAINER% psql -q -U postgres -d postgres -c "create database %BANCO%"
)
exit /b %errorlevel%

REM ---------------------------------------------------------------------------
:roda
if "%MODO%"=="LOCAL" (
  psql -q -U %PGUSER% -d %BANCO% -v ON_ERROR_STOP=1 -f "%~1"
) else (
  docker exec -i %CONTAINER% psql -q -U postgres -d %BANCO% -v ON_ERROR_STOP=1 < "%~1"
)
exit /b %errorlevel%

REM ---------------------------------------------------------------------------
:semPostgres
echo.
echo  Nao achei com que Postgres falar. Duas saidas, qualquer uma serve:
echo.
echo  A) Subir o Supabase local (usa o Docker, nao instala Postgres no Windows):
echo.
echo       supabase start
echo.
echo     Da primeira vez ele baixa as imagens e demora alguns minutos. Depois
echo     e so rodar este .bat de novo.
echo.
echo  B) Instalar o Postgres no Windows, se preferir psql a mao:
echo.
echo       winget install -e --id PostgreSQL.PostgreSQL.17
echo.
echo     Depois acrescente ao PATH:
echo       C:\Program Files\PostgreSQL\17\bin
echo     e abra um terminal NOVO (PATH so vale em terminal aberto depois).
echo.
exit /b 1

REM ---------------------------------------------------------------------------
:erro
echo.
echo  !! FALHOU - veja a mensagem acima.
echo.
exit /b 1
