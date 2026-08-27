import { useEffect, useState } from 'react'
import {
  anexosDoProjeto, comentariosDoProjeto, criarComentario, editarComentario,
  enviarAnexo, excluirAnexo, excluirComentario, urlAssinada,
  ErroDoBanco, TIPOS_DE_ANEXO,
  type Anexo, type Comentario, type Pessoa,
} from '../lib/banco'
import { data as formatarData } from '../lib/formato'

/**
 * A conversa e os arquivos de um projeto.
 *
 * Comentário é do autor: só ele edita, só ele apaga — e quem decide isso é a
 * política de `comentario`, não esta tela. A tela pergunta ao banco do mesmo
 * jeito que a de tarefas: UPDATE negado volta com zero linhas.
 *
 * Anexo sobe pela sessão do usuário, nunca por service_role. O caminho é
 * `projeto/<id>/<arquivo>` porque é o segundo pedaço dele que a política do
 * Storage lê para saber de quem é o arquivo.
 */

function ehImagem(a: Anexo): boolean {
  return (a.mime ?? '').startsWith('image/')
}

export function ConversaEArquivos({
  projetoId, equipe, minhaPessoaId,
}: {
  projetoId: string
  equipe: Pessoa[]
  minhaPessoaId: string | null
}) {
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [enderecos, setEnderecos] = useState<Record<string, string>>({})

  const [texto, setTexto] = useState('')
  const [respondendo, setRespondendo] = useState<string | null>(null)
  const [mencionados, setMencionados] = useState<string[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEditado, setTextoEditado] = useState('')

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [tipoAnexo, setTipoAnexo] = useState<string>('FOTO')
  const [secao, setSecao] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([comentariosDoProjeto(projetoId), anexosDoProjeto(projetoId)])
      .then(async ([cs, as]) => {
        if (!vivo) return
        setComentarios(cs)
        setAnexos(as)
        // Bucket privado: cada arquivo precisa do seu endereço assinado.
        const mapa: Record<string, string> = {}
        for (const a of as) {
          const u = await urlAssinada(a.storage_path)
          if (u) mapa[a.id] = u
        }
        if (vivo) setEnderecos(mapa)
      })
      .catch((e: Error) => vivo && setErro(e.message))
    return () => {
      vivo = false
    }
  }, [projetoId])

  async function recarregar() {
    const [cs, as] = await Promise.all([comentariosDoProjeto(projetoId), anexosDoProjeto(projetoId)])
    setComentarios(cs)
    setAnexos(as)
    const mapa: Record<string, string> = {}
    for (const a of as) {
      const u = await urlAssinada(a.storage_path)
      if (u) mapa[a.id] = u
    }
    setEnderecos(mapa)
  }

  async function comOBanco(acao: () => Promise<void>) {
    setOcupado(true)
    setErro(null)
    try {
      await acao()
      await recarregar()
    } catch (e) {
      setErro(e instanceof ErroDoBanco ? e.mensagem : e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  const nomeDe = (id: string | null) =>
    equipe.find((p) => p.id === id)?.nome ?? 'alguém que você não alcança'

  // Por seção, na ordem em que aparecem; sem seção vai para o fim.
  const secoes: { nome: string; itens: Anexo[] }[] = []
  for (const a of anexos) {
    const chave = a.secao ?? 'Sem seção'
    const grupo = secoes.find((g) => g.nome === chave)
    if (grupo) grupo.itens.push(a)
    else secoes.push({ nome: chave, itens: [a] })
  }

  return (
    <>
      {erro && <div className="aviso">{erro}</div>}

      <section className="secao">
        <h2>Comentários <span className="conta">{comentarios.length}</span></h2>

        {comentarios.length === 0 && <p className="vazio">Ninguém comentou ainda.</p>}

        <ul className="conversa">
          {comentarios.map((c) => {
            const respondido = c.responde_id
              ? comentarios.find((x) => x.id === c.responde_id)
              : null
            const meu = c.pessoa_id === minhaPessoaId
            return (
              <li key={c.id} className={c.responde_id ? 'resposta' : undefined}>
                <div className="autoria">
                  <strong>{nomeDe(c.pessoa_id)}</strong>
                  <span className="campo-vazio">
                    {formatarData(c.criado_em.slice(0, 10))}
                    {c.editado_em && ' · editado'}
                  </span>
                </div>

                {respondido && (
                  <p className="citado">
                    respondendo {nomeDe(respondido.pessoa_id)}: “{respondido.texto.slice(0, 80)}
                    {respondido.texto.length > 80 ? '…' : ''}”
                  </p>
                )}

                {editandoId === c.id ? (
                  <>
                    <textarea
                      className="campo" rows={3} value={textoEditado}
                      onChange={(e) => setTextoEditado(e.target.value)}
                    />
                    <p className="acoes">
                      <button
                        className="botao" disabled={ocupado || textoEditado.trim() === ''}
                        onClick={() =>
                          comOBanco(async () => {
                            const n = await editarComentario(c.id, textoEditado.trim())
                            if (n === 0) {
                              setErro('A RLS recusou: comentário só é editado por quem escreveu.')
                              return
                            }
                            setEditandoId(null)
                          })}
                      >
                        Salvar
                      </button>
                      <button className="botao" onClick={() => setEditandoId(null)}>Cancelar</button>
                    </p>
                  </>
                ) : (
                  <p className="texto-comentario">{c.texto}</p>
                )}

                {c.mencionados.length > 0 && (
                  <p className="campo-vazio">
                    menciona {c.mencionados.map(nomeDe).join(', ')}
                  </p>
                )}

                {editandoId !== c.id && (
                  <p className="acoes-linha">
                    <button className="voltar" onClick={() => setRespondendo(c.id)}>responder</button>
                    {meu && (
                      <>
                        <button
                          className="voltar"
                          onClick={() => { setEditandoId(c.id); setTextoEditado(c.texto) }}
                        >
                          editar
                        </button>
                        <button
                          className="voltar" disabled={ocupado}
                          onClick={() =>
                            comOBanco(async () => {
                              const n = await excluirComentario(c.id)
                              if (n === 0) setErro('A RLS recusou a exclusão do comentário.')
                            })}
                        >
                          excluir
                        </button>
                      </>
                    )}
                  </p>
                )}
              </li>
            )
          })}
        </ul>

        <div className="novo-comentario">
          {respondendo && (
            <p className="campo-vazio">
              respondendo {nomeDe(comentarios.find((c) => c.id === respondendo)?.pessoa_id ?? null)}{' '}
              <button className="voltar" onClick={() => setRespondendo(null)}>cancelar</button>
            </p>
          )}
          <textarea
            className="campo" rows={3} placeholder="Escreva um comentário"
            value={texto} onChange={(e) => setTexto(e.target.value)}
          />
          <p className="acoes">
            <select
              className="campo" value=""
              onChange={(e) => {
                if (e.target.value && !mencionados.includes(e.target.value)) {
                  setMencionados([...mencionados, e.target.value])
                }
              }}
            >
              <option value="">mencionar alguém…</option>
              {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <button
              className="botao botao--acao"
              disabled={ocupado || texto.trim() === '' || minhaPessoaId === null}
              onClick={() =>
                comOBanco(async () => {
                  await criarComentario({
                    projeto_id: projetoId,
                    pessoa_id: minhaPessoaId as string,
                    texto: texto.trim(),
                    responde_id: respondendo,
                    mencionados,
                  })
                  setTexto('')
                  setRespondendo(null)
                  setMencionados([])
                })}
            >
              Comentar
            </button>
          </p>
          {mencionados.length > 0 && (
            <div className="fichas">
              {mencionados.map((m) => (
                <button
                  key={m} className="ficha"
                  onClick={() => setMencionados(mencionados.filter((x) => x !== m))}
                >
                  {nomeDe(m)} <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="secao">
        <h2>Anexos <span className="conta">{anexos.length}</span></h2>

        {secoes.map((g) => (
          <div key={g.nome} className="grupo-anexos">
            <h3>{g.nome}</h3>
            <div className="galeria">
              {g.itens.map((a) => (
                <figure key={a.id} className="anexo">
                  {ehImagem(a) && enderecos[a.id] ? (
                    <a href={enderecos[a.id]} target="_blank" rel="noreferrer">
                      <img src={enderecos[a.id]} alt={a.titulo} loading="lazy" />
                    </a>
                  ) : (
                    <span className="sem-miniatura">{a.mime ?? 'arquivo'}</span>
                  )}
                  <figcaption>
                    <span title={a.titulo}>{a.titulo}</span>
                    <span className="campo-vazio">
                      {a.bytes ? `${Math.round(a.bytes / 1024)} kB` : ''}
                    </span>
                    <span className="acoes-linha">
                      {enderecos[a.id] && (
                        <a className="voltar" href={enderecos[a.id]} download={a.titulo}>baixar</a>
                      )}
                      <button
                        className="voltar" disabled={ocupado}
                        onClick={() => {
                          if (!window.confirm(`Excluir "${a.titulo}"? O arquivo sai do Storage.`)) return
                          comOBanco(() => excluirAnexo(a))
                        }}
                      >
                        excluir
                      </button>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}

        <div className="novo-anexo">
          <input
            type="file"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
          <select className="campo" value={tipoAnexo} onChange={(e) => setTipoAnexo(e.target.value)}>
            {TIPOS_DE_ANEXO.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
          </select>
          <input
            className="campo" placeholder="seção (opcional)" value={secao}
            onChange={(e) => setSecao(e.target.value)}
            list="secoes-usadas"
          />
          <datalist id="secoes-usadas">
            {[...new Set(anexos.map((a) => a.secao).filter(Boolean))].map((s) => (
              <option key={s as string} value={s as string} />
            ))}
          </datalist>
          <button
            className="botao" disabled={ocupado || arquivo === null}
            onClick={() =>
              comOBanco(async () => {
                await enviarAnexo(arquivo as File, {
                  projeto_id: projetoId,
                  titulo: (arquivo as File).name,
                  tipo: tipoAnexo,
                  secao: secao.trim() || null,
                  pessoa_id: minhaPessoaId,
                })
                setArquivo(null)
                setSecao('')
              })}
          >
            {ocupado ? 'Enviando…' : 'Enviar arquivo'}
          </button>
        </div>
      </section>
    </>
  )
}
