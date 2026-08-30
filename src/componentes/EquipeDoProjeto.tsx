import { useEffect, useState } from 'react'
import {
  alocacoesDoProjeto, alocar, atualizarAlocacao, desalocar,
  type Alocacao, type Pessoa,
} from '../lib/banco'
import { data as formatarData } from '../lib/formato'

/**
 * A equipe do projeto: quem está nele, com que papel e com quanto do tempo.
 *
 * É a peça que enchia o gráfico de capacidade do painel — ele vinha vazio
 * porque `alocacao` nunca recebeu uma linha, não porque o gráfico falhasse.
 *
 * A dedicação é da PESSOA NO PROJETO, não na tarefa. Uma pessoa em três
 * projetos a 50% cada está com 150% do seu tempo comprometido, e é exatamente
 * isso que a capacidade mostra: atraso que ainda não aconteceu.
 *
 * `custo_hora` não aparece aqui de propósito — veja a nota em `banco.ts`.
 */

const PAPEIS_SUGERIDOS = [
  'Gerente', 'Responsável técnico', 'Executor', 'Apoio', 'Fiscalização',
]

export function EquipeDoProjeto({
  projetoId, pessoasDisponiveis, soLeitura,
}: {
  projetoId: string
  pessoasDisponiveis: Pessoa[]
  soLeitura: boolean
}) {
  const [linhas, setLinhas] = useState<Alocacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [pessoaId, setPessoaId] = useState('')
  const [papel, setPapel] = useState('')
  const [dedicacao, setDedicacao] = useState('100')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  const recarregar = () =>
    alocacoesDoProjeto(projetoId)
      .then(setLinhas)
      .catch((e: Error) => setErro(e.message))

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    alocacoesDoProjeto(projetoId)
      .then((a) => vivo && setLinhas(a))
      .catch((e: Error) => vivo && setErro(e.message))
      .finally(() => {
        if (vivo) setCarregando(false)
      })
    return () => {
      vivo = false
    }
  }, [projetoId])

  // Quem já está no projeto não aparece de novo na lista de escolha: duas
  // linhas para a mesma pessoa dobrariam a dedicação dela sem querer.
  const jaAlocadas = new Set(linhas.filter((l) => l.ativo).map((l) => l.pessoa_id))
  const escolhiveis = pessoasDisponiveis.filter((p) => p.ativo && !jaAlocadas.has(p.id))

  const percentual = Number(dedicacao.replace(',', '.'))
  const percentualValido = Number.isFinite(percentual) && percentual > 0 && percentual <= 100
  const periodoValido = !inicio || !fim || fim >= inicio
  const podeSalvar = !salvando && pessoaId !== '' && percentualValido && periodoValido

  async function incluir() {
    setSalvando(true)
    setErro(null)
    try {
      await alocar({
        projeto_id: projetoId,
        pessoa_id: pessoaId,
        papel: papel.trim() || null,
        percentual_dedicacao: percentual,
        data_inicio: inicio || null,
        data_fim: fim || null,
      })
      setPessoaId('')
      setPapel('')
      setDedicacao('100')
      setInicio('')
      setFim('')
      setAbrindo(false)
      await recarregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function mudarDedicacao(l: Alocacao, valor: string) {
    const novo = Number(valor.replace(',', '.'))
    if (!Number.isFinite(novo) || novo <= 0 || novo > 100 || novo === l.percentual_dedicacao) return
    try {
      const mudadas = await atualizarAlocacao(l.id, { percentual_dedicacao: novo })
      if (mudadas === 0) {
        setErro('A dedicação não mudou: você não tem permissão para editar este projeto.')
        return
      }
      await recarregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function tirar(l: Alocacao) {
    setErro(null)
    try {
      const mudadas = await desalocar(l.id)
      if (mudadas === 0) {
        setErro(`${l.pessoa_nome} continua no projeto: você não tem permissão para alterá-lo.`)
        return
      }
      await recarregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const ativas = linhas.filter((l) => l.ativo)
  const soma = ativas.reduce((t, l) => t + l.percentual_dedicacao, 0)

  return (
    <section className="secao">
      <h2>
        Equipe do projeto <span className="conta">{ativas.length}</span>
        {!soLeitura && !abrindo && (
          <button className="voltar conta" onClick={() => setAbrindo(true)}>alocar alguém</button>
        )}
      </h2>

      {erro && <div className="aviso">{erro}</div>}

      {abrindo && (
        <div className="cartao">
          <dl className="campos">
            <div className="campo-linha">
              <dt><label htmlFor="al-pessoa">Pessoa</label></dt>
              <dd>
                <select
                  id="al-pessoa" className="campo" value={pessoaId}
                  onChange={(e) => setPessoaId(e.target.value)}
                >
                  <option value="">escolha…</option>
                  {escolhiveis.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                {escolhiveis.length === 0 && (
                  <p className="ajuda">Todo mundo que está cadastrado já está neste projeto.</p>
                )}
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="al-papel">Papel</label></dt>
              <dd>
                <input
                  id="al-papel" className="campo" list="papeis-de-alocacao"
                  value={papel} onChange={(e) => setPapel(e.target.value)}
                  placeholder="o que ela faz aqui"
                />
                <datalist id="papeis-de-alocacao">
                  {PAPEIS_SUGERIDOS.map((p) => <option key={p} value={p} />)}
                </datalist>
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="al-ded">Dedicação</label></dt>
              <dd>
                <input
                  id="al-ded" className="campo" type="number" min="1" max="100" step="5"
                  value={dedicacao} onChange={(e) => setDedicacao(e.target.value)}
                />
                {!percentualValido && dedicacao !== '' && (
                  <p className="erro-campo">Um número entre 1 e 100.</p>
                )}
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="al-ini">De</label></dt>
              <dd>
                <input
                  id="al-ini" className="campo" type="date"
                  value={inicio} onChange={(e) => setInicio(e.target.value)}
                />
              </dd>
            </div>

            <div className="campo-linha">
              <dt><label htmlFor="al-fim">Até</label></dt>
              <dd>
                <input
                  id="al-fim" className="campo" type="date"
                  value={fim} onChange={(e) => setFim(e.target.value)}
                />
                {!periodoValido && <p className="erro-campo">O fim vem antes do início.</p>}
              </dd>
            </div>
          </dl>

          <p className="ajuda">
            Sem datas, a alocação vale desde já e não termina — é o caso comum. Com datas, a
            pessoa só entra na conta de capacidade dentro do período.
          </p>

          <p className="acoes">
            <button className="botao botao--acao" onClick={incluir} disabled={!podeSalvar}>
              {salvando ? 'Alocando…' : 'Alocar'}
            </button>
            <button className="botao" onClick={() => { setAbrindo(false); setErro(null) }}>
              cancelar
            </button>
          </p>
        </div>
      )}

      {carregando ? (
        <p className="vazio">Carregando…</p>
      ) : ativas.length === 0 ? (
        <p className="vazio">
          Ninguém alocado. Enquanto for assim, este projeto não entra na capacidade da equipe —
          não há como somar o tempo de quem não foi declarado.
        </p>
      ) : (
        <>
          <div className="tabela-rolavel">
            <table>
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Papel</th>
                  <th className="direita">Dedicação</th>
                  <th className="data">De</th>
                  <th className="data">Até</th>
                  {!soLeitura && <th />}
                </tr>
              </thead>
              <tbody>
                {ativas.map((l) => (
                  <tr key={l.id}>
                    <td>{l.pessoa_nome}</td>
                    <td>{l.papel ?? '—'}</td>
                    <td className="num direita">
                      {soLeitura ? (
                        `${l.percentual_dedicacao}%`
                      ) : (
                        <>
                          <input
                            className="campo campo--dedicacao" type="number" min="1" max="100" step="5"
                            defaultValue={l.percentual_dedicacao}
                            aria-label={`Dedicação de ${l.pessoa_nome}`}
                            onBlur={(e) => mudarDedicacao(l, e.target.value)}
                          />
                          {' %'}
                        </>
                      )}
                    </td>
                    <td className="dado">{formatarData(l.data_inicio)}</td>
                    <td className="dado">{formatarData(l.data_fim)}</td>
                    {!soLeitura && (
                      <td>
                        <button className="voltar" onClick={() => tirar(l)}>tirar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    Somado neste projeto
                    {ativas.length > 1 && ` — ${ativas.length} pessoas`}
                  </td>
                  <td className="num direita">{soma}%</td>
                  <td colSpan={soLeitura ? 2 : 3} />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="ajuda">
            Este total é o esforço somado <strong>neste</strong> projeto. Quem está passando de
            100% no conjunto dos projetos aparece na capacidade da equipe, no Painel.
          </p>
        </>
      )}
    </section>
  )
}
