import { useEffect, useState } from 'react'
import {
  camposDoTipo, empresas as carregarEmpresas, fasesDoTipo,
  pessoas as carregarPessoas,
  type CampoDefinicao,
} from '../lib/banco'
import { data as formatarData, moeda } from '../lib/formato'

/**
 * O formulário dos campos próprios de um tipo de projeto.
 *
 * Ele não sabe o nome de nenhum campo nem o de nenhum tipo. Lê
 * `campo_definicao` e se monta: os grupos são `grupo`, a sequência é `ordem`,
 * o controle sai de `tipo_dado`, os limites de `minimo`/`maximo`, as opções de
 * `opcoes`, e a marca de exigência de `exigido_para_sair_de`.
 *
 * Campo novo cadastrado no banco aparece aqui sem uma linha de código nova. É
 * essa promessa que dispensa escrever um formulário por tipo de projeto.
 */

export type ValoresDeCampos = Record<string, unknown>

type Props = {
  tipoProjetoId: string
  valores: ValoresDeCampos
  /** Ausente = só leitura. Presente = formulário. */
  aoMudar?: (valores: ValoresDeCampos) => void
  /** A fase em que o projeto está: destaca o que falta para ele SAIR dela. */
  faseAtualId?: string | null
  /** Mensagem do banco por código de campo, mostrada ao lado do campo. */
  erros?: Record<string, string>
  desabilitado?: boolean
}

/** Vazio de verdade — o que a exigência de saída vai cobrar. */
function estaVazio(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
}

/** Como cada tipo_dado se lê quando não há o que editar. */
function valorLegivel(campo: CampoDefinicao, bruto: unknown, nomes?: Map<string, string>): string {
  if (estaVazio(bruto)) return '—'
  switch (campo.tipo_dado) {
    case 'MOEDA':
      return moeda(Number(bruto))
    case 'PERCENTUAL':
      return `${Number(bruto).toLocaleString('pt-BR')}%`
    case 'NUMERO':
      return Number(bruto).toLocaleString('pt-BR')
    case 'DATA':
      return formatarData(String(bruto))
    case 'BOOLEANO':
      return bruto ? 'Sim' : 'Não'
    case 'SELECAO_MULTIPLA':
      return Array.isArray(bruto) ? bruto.join(', ') : String(bruto)
    case 'PESSOA':
    case 'EMPRESA':
      return nomes?.get(String(bruto)) ?? String(bruto)
    default:
      return String(bruto)
  }
}

export function CamposDoTipo({
  tipoProjetoId, valores, aoMudar, faseAtualId, erros, desabilitado,
}: Props) {
  const [campos, setCampos] = useState<CampoDefinicao[]>([])
  const [fases, setFases] = useState<Map<string, string>>(new Map())
  // Só é carregado se algum campo for de PESSOA ou EMPRESA — quem decide é a
  // configuração, não uma lista de tipos escrita aqui.
  const [nomes, setNomes] = useState<Map<string, string>>(new Map())
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro(null)

    const buscar = async () => {
      const [cs, fs] = await Promise.all([camposDoTipo(tipoProjetoId), fasesDoTipo(tipoProjetoId)])
      if (!vivo) return
      setCampos(cs)
      setFases(new Map(fs.map((f) => [f.id, f.nome])))

      const precisa = new Set(cs.map((c) => c.tipo_dado))
      const mapa = new Map<string, string>()
      const buscas: Promise<void>[] = []
      if (precisa.has('PESSOA')) {
        buscas.push(carregarPessoas().then((ps) => ps.forEach((p) => mapa.set(p.id, p.nome))))
      }
      if (precisa.has('EMPRESA')) {
        buscas.push(carregarEmpresas().then((es) => es.forEach((e) => mapa.set(e.id, e.nome))))
      }
      await Promise.all(buscas)
      if (vivo) setNomes(mapa)
    }

    buscar()
      .catch((e: Error) => {
        if (vivo) setErro(e.message)
      })
      .finally(() => {
        if (vivo) setCarregando(false)
      })

    return () => {
      vivo = false
    }
  }, [tipoProjetoId])

  const editavel = Boolean(aoMudar) && !desabilitado

  function mudar(campo: CampoDefinicao, valor: unknown) {
    if (!aoMudar) return
    const novos = { ...valores }
    // Campo esvaziado sai do jsonb em vez de virar string vazia: o banco
    // pergunta se a chave existe, e "" preenchido seria mentira.
    if (estaVazio(valor)) delete novos[campo.codigo]
    else novos[campo.codigo] = valor
    aoMudar(novos)
  }

  if (carregando) return <p className="vazio">Carregando os campos…</p>
  if (erro) return <div className="aviso">{erro}</div>
  if (campos.length === 0) return null

  // Os grupos saem na ordem em que os campos aparecem: a ordem também é dado.
  const grupos: { nome: string; campos: CampoDefinicao[] }[] = []
  for (const c of campos) {
    const grupo = grupos.find((g) => g.nome === c.grupo)
    if (grupo) grupo.campos.push(c)
    else grupos.push({ nome: c.grupo, campos: [c] })
  }

  return (
    <>
      {grupos.map((g) => (
        <section className="secao" key={g.nome}>
          <h2>{g.nome}</h2>
          <dl className="campos">
            {g.campos.map((c) => {
              const bruto = valores?.[c.codigo]
              const vazio = estaVazio(bruto)
              const faseQueExige = c.exigido_para_sair_de ? fases.get(c.exigido_para_sair_de) : null
              // Trava a fase em que o projeto está agora, e ainda está em branco.
              const trancaAgora =
                vazio && c.exigido_para_sair_de !== null && c.exigido_para_sair_de === faseAtualId
              const mensagem = erros?.[c.codigo]

              return (
                <div className="campo-linha" key={c.id}>
                  <dt>
                    <label htmlFor={`campo-${c.codigo}`}>{c.rotulo}</label>
                    {faseQueExige && (
                      <span
                        className={trancaAgora ? 'exigencia exigencia--trava' : 'exigencia'}
                        title={
                          trancaAgora
                            ? `Em branco, este campo impede o projeto de sair da fase ${faseQueExige}`
                            : `Precisa estar preenchido para o projeto sair da fase ${faseQueExige}`
                        }
                      >
                        {trancaAgora ? 'falta para sair de ' : 'exigido para sair de '}
                        {faseQueExige}
                      </span>
                    )}
                  </dt>
                  <dd className={!editavel && vazio ? 'campo-vazio' : undefined}>
                    {editavel ? (
                      <Controle
                        campo={c}
                        valor={bruto}
                        nomes={nomes}
                        aoMudar={(v) => mudar(c, v)}
                      />
                    ) : (
                      valorLegivel(c, bruto, nomes)
                    )}
                    {c.ajuda && <p className="ajuda">{c.ajuda}</p>}
                    {mensagem && <p className="erro-campo">{mensagem}</p>}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </>
  )
}

/**
 * O controle de um campo, escolhido por `tipo_dado`. É o único lugar do
 * sistema que decide como se digita cada espécie de dado — e ele decide pela
 * espécie, nunca por quem o campo é.
 */
function Controle({
  campo, valor, nomes, aoMudar,
}: {
  campo: CampoDefinicao
  valor: unknown
  nomes: Map<string, string>
  aoMudar: (v: unknown) => void
}) {
  const id = `campo-${campo.codigo}`
  const texto = valor === undefined || valor === null ? '' : String(valor)

  switch (campo.tipo_dado) {
    case 'TEXTO_LONGO':
      return (
        <textarea
          id={id}
          className="campo"
          rows={4}
          value={texto}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )

    case 'NUMERO':
    case 'MOEDA':
    case 'PERCENTUAL':
      return (
        <div className="com-sufixo">
          {campo.tipo_dado === 'MOEDA' && <span className="afixo">R$</span>}
          <input
            id={id}
            className="campo num"
            type="number"
            inputMode="decimal"
            step={campo.tipo_dado === 'NUMERO' ? 1 : 0.01}
            min={campo.minimo ?? (campo.tipo_dado === 'PERCENTUAL' ? 0 : undefined)}
            max={campo.maximo ?? (campo.tipo_dado === 'PERCENTUAL' ? 100 : undefined)}
            value={texto}
            onChange={(e) => aoMudar(e.target.value === '' ? '' : Number(e.target.value))}
          />
          {campo.tipo_dado === 'PERCENTUAL' && <span className="afixo">%</span>}
        </div>
      )

    case 'DATA':
      return (
        <input
          id={id}
          className="campo dado"
          type="date"
          value={texto.slice(0, 10)}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )

    case 'BOOLEANO':
      return (
        <label className="marcador">
          <input id={id} type="checkbox" checked={valor === true} onChange={(e) => aoMudar(e.target.checked)} />
          {valor === true ? 'Sim' : 'Não'}
        </label>
      )

    case 'SELECAO':
      return (
        <select id={id} className="campo" value={texto} onChange={(e) => aoMudar(e.target.value)}>
          <option value="">—</option>
          {campo.opcoes.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )

    case 'SELECAO_MULTIPLA': {
      const marcados = Array.isArray(valor) ? (valor as unknown[]).map(String) : []
      return (
        <div className="marcadores">
          {campo.opcoes.map((o) => (
            <label className="marcador" key={o}>
              <input
                type="checkbox"
                checked={marcados.includes(o)}
                onChange={(e) =>
                  aoMudar(e.target.checked ? [...marcados, o] : marcados.filter((m) => m !== o))
                }
              />
              {o}
            </label>
          ))}
        </div>
      )
    }

    case 'PESSOA':
    case 'EMPRESA':
      return (
        <select id={id} className="campo" value={texto} onChange={(e) => aoMudar(e.target.value)}>
          <option value="">—</option>
          {[...nomes.entries()].map(([idOpcao, nome]) => (
            <option key={idOpcao} value={idOpcao}>{nome}</option>
          ))}
        </select>
      )

    case 'ARQUIVO':
      // Arquivo vive no Storage, com política própria por projeto. Enquanto a
      // tela de anexos não existe, o campo se mostra e não se edita — melhor
      // do que um controle que finge salvar.
      return (
        <span className="campo-vazio">
          {texto || '—'} <span className="marca-etapa">anexos ainda não editáveis aqui</span>
        </span>
      )

    default:
      return (
        <input
          id={id}
          className="campo"
          type="text"
          value={texto}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )
  }
}
