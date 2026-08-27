@echo off
REM ============================================================================
REM GestPlan - aplica as migracoes num Postgres local e roda as duas suites.
REM
REM Uso:  rodar_testes.bat            (banco "gestplan_teste" em localhost)
REM       rodar_testes.bat meubanco
REM
REM Precisa do psql no PATH. O banco e APAGADO e recriado a cada execucao -
REM nao aponte para producao.
REM ============================================================================
setlocal

if "%~1"=="" (set BANCO=gestplan_teste) else (set BANCO=%~1)
if "%PGUSER%"=="" set PGUSER=postgres

echo.
echo  Banco de teste: %BANCO%
echo.

dropdb --if-exists %BANCO% 2>nul
createdb %BANCO% || goto :erro

echo  [1/4] stub do Supabase (auth.users, papeis)
psql -q -d %BANCO% -v ON_ERROR_STOP=1 -f testes\00_stub_supabase.sql || goto :erro

echo  [2/4] migracoes
for %%f in (supabase\migrations\*.sql) do (
  echo        %%~nxf
  psql -q -d %BANCO% -v ON_ERROR_STOP=1 -f "%%f" || goto :erro
)

echo  [3/4] regras de negocio
psql -q -d %BANCO% -v ON_ERROR_STOP=1 -f testes\01_regras.sql || goto :erro

echo  [4/4] permissao
psql -q -d %BANCO% -v ON_ERROR_STOP=1 -f testes\02_permissao.sql || goto :erro

echo.
echo  ==========================================
echo   Tudo passou.
echo  ==========================================
echo.
exit /b 0

:erro
echo.
echo  !! FALHOU - veja a mensagem acima.
echo.
exit /b 1
