#!/usr/bin/env python3
"""
GestPlan · sobe os anexos do desktop para o Storage do Supabase

A importação de dados já criou as linhas de `anexo` com o caminho que o arquivo
tinha no disco. Este script pega esses arquivos, manda para o Storage e corrige
o caminho para o definitivo.

Roda DEPOIS de importacao.sql. É repetível: arquivo já enviado é pulado.

Precisa da chave service_role — ela consegue escrever no Storage por cima da
RLS, e é por isso que NUNCA pode entrar no repositório nem no .env do front.
Passe pela linha de comando, na hora:

    set SUPABASE_URL=https://xxxx.supabase.co
    set SUPABASE_SERVICE_KEY=eyJ...
    python subir_anexos.py "%APPDATA%\\br.eng.habitual.gestaoprojetos"

Sem dependência externa: só a biblioteca padrão do Python.
"""

import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BUCKET = "anexos"

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def pedir(metodo: str, caminho: str, corpo=None, tipo="application/json"):
    req = urllib.request.Request(f"{URL}{caminho}", method=metodo, data=corpo)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("apikey", KEY)
    if corpo is not None:
        req.add_header("Content-Type", tipo)
    try:
        with urllib.request.urlopen(req) as r:
            texto = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(texto) if texto.strip().startswith(("{", "[")) else texto)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def anexos_pendentes():
    """Linhas cujo storage_path ainda é o caminho do desktop."""
    status, corpo = pedir(
        "GET",
        "/rest/v1/anexo?select=id,projeto_id,titulo,storage_path"
        "&storage_path=like.arquivos/*&order=id",
    )
    if status != 200:
        sair(f"Não consegui listar os anexos: {status} {corpo}")
    return corpo


def sair(msg: str):
    print(f"\n  {msg}\n", file=sys.stderr)
    sys.exit(1)


def main():
    if not URL or not KEY:
        sair("Faltam SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.")

    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else ".").expanduser()
    if not raiz.is_dir():
        sair(f"Pasta não encontrada: {raiz}")

    # Cria o bucket privado, se ainda não existir.
    status, _ = pedir(
        "POST", "/storage/v1/bucket",
        json.dumps({"id": BUCKET, "name": BUCKET, "public": False}).encode(),
    )
    print(f"  bucket '{BUCKET}': {'criado' if status in (200, 201) else 'já existia'}")

    pendentes = anexos_pendentes()
    if not pendentes:
        print("  Nada pendente — todos os anexos já estão no Storage.")
        return

    print(f"  {len(pendentes)} anexo(s) para subir.\n")
    enviados = falhas = 0

    for a in pendentes:
        origem = raiz / a["storage_path"].replace("/", os.sep)
        if not origem.is_file():
            print(f"  !! arquivo sumiu do disco: {origem}")
            falhas += 1
            continue

        destino = f"projeto/{a['projeto_id']}/{origem.name}"
        tipo = mimetypes.guess_type(origem.name)[0] or "application/octet-stream"
        dados = origem.read_bytes()

        # O nome vem do disco e traz espaco e parentese ("WhatsApp Image ... (1).jpeg").
        # Na URL isso precisa ir percent-encoded; no banco, o caminho fica cru.
        destino_url = urllib.parse.quote(destino, safe="/")
        status, corpo = pedir(
            "POST", f"/storage/v1/object/{BUCKET}/{destino_url}", dados, tipo
        )
        if status in (200, 201) or (status == 409):   # 409 = já está lá
            status2, corpo2 = pedir(
                "PATCH",
                f"/rest/v1/anexo?id=eq.{a['id']}",
                json.dumps({
                    "storage_path": destino,
                    "mime": tipo,
                    "bytes": len(dados),
                }).encode(),
            )
            if status2 in (200, 204):
                enviados += 1
                print(f"  ok  {origem.name}  ({len(dados)//1024} kB)")
            else:
                falhas += 1
                print(f"  !! subiu mas não atualizei o caminho: {status2} {corpo2}")
        else:
            falhas += 1
            print(f"  !! falhou {origem.name}: {status} {corpo}")

    print(f"\n  {enviados} enviado(s), {falhas} falha(s).")
    if falhas:
        sys.exit(1)


if __name__ == "__main__":
    main()
