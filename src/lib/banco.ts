import { supabase } from './supabase'

// Todo acesso a dado passa por aqui. A tela não monta consulta.
//
// Repare no que NÃO tem nestas funções: filtro por empresa, por papel, por
// permissão. Isso é decidido pela RLS no Postgres — pedir "todos os projetos"
// devolve os que a pessoa pode ver, e só. Se você sentir vontade de filtrar
// permissão aqui, a regra está faltando lá.

export type Projeto = {
  id: string
  codigo: string
  nome: string
  prioridade: 'URGENTE' | 'IMPORTANTE' | 'PLANEJAMENTO'
  pontuacao_total: number
  saude: 'VERDE' | 'AMARELO' | 'VERMELHO' | null
  frente: string | null
  seguranca: boolean
  tipo_projeto_id: string
  tipo_codigo: string
  tipo_nome: string
  tipo_cor: string
  fase_id: string
  fase_codigo: string
  fase_nome: string
  fase_categoria: string
  fase_ordem: number
  empresa_nome: string
  gerente_nome: string | null
  data_inicio_prev: string | null
  data_fim_prev: string | null
  data_inicio_real: string | null
  data_fim_real: string | null
  ativo: boolean
  // Vêm nulos para quem não tem alcance financeiro. Não é erro: é a RLS.
  valor_estimado: number | null
  valor_aprovado: number | null
  valor_orcado: number | null
  valor_realizado: number | null
  campos: Record<string, unknown>
}

export type Empresa = {
  id: string
  nome: string
  prefixo: string
  cnpj: string | null
  cidade: string | null
  uf: string | null
  ativo: boolean
}

export type Pessoa = {
  id: string
  nome: string
  email: string | null
  cargo: string | null
  proprietario: boolean
  ativo: boolean
}

export type TipoProjeto = {
  id: string
  codigo: string
  nome: string
  descricao: string | null
  cor: string
  usa_orcamento: boolean
  usa_cronograma: boolean
  usa_medicao: boolean
  usa_pontuacao: boolean
  mede_avanco_por: string
  ordem: number
}

export type Fase = {
  id: string
  tipo_projeto_id: string
  codigo: string
  nome: string
  ordem: number
  categoria: string
  cor: string
  inicial: boolean
  conclusiva: boolean
  exige_setores: string[]
  exige_orcamento: boolean
  exige_cronograma: boolean
}

function erro(contexto: string, e: { message: string } | null): never | void {
  if (e) throw new Error(`${contexto}: ${e.message}`)
}

/**
 * Erro que veio do Postgres, com a mensagem dele preservada em `mensagem`.
 *
 * A tela precisa do texto cru para achar de que campo o erro fala — as
 * mensagens de `app.validar_campos` carregam o código do campo. Concatenar o
 * contexto na frente, como o `erro()` faz, atrapalharia essa leitura.
 */
export class ErroDoBanco extends Error {
  constructor(public contexto: string, public mensagem: string) {
    super(`${contexto}: ${mensagem}`)
    this.name = 'ErroDoBanco'
  }
}

function erroDeEscrita(contexto: string, e: { message: string } | null): void {
  if (e) throw new ErroDoBanco(contexto, e.message)
}

export async function carteira(): Promise<Projeto[]> {
  const { data, error } = await supabase
    .from('vw_projeto')
    .select('*')
    .order('pontuacao_total', { ascending: false })
    .order('codigo', { ascending: false })
  erro('Não foi possível carregar a carteira', error)
  return (data ?? []) as Projeto[]
}

/** A carteira de um tipo so — as colunas do kanban sao as fases DELE. */
export async function carteiraDoTipo(tipoId: string): Promise<Projeto[]> {
  const { data, error } = await supabase
    .from('vw_projeto')
    .select('*')
    .eq('tipo_projeto_id', tipoId)
    .order('pontuacao_total', { ascending: false })
    .order('codigo', { ascending: false })
  erro('Nao foi possivel carregar a carteira', error)
  return (data ?? []) as Projeto[]
}

export async function empresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from('empresa')
    .select('id, nome, prefixo, cnpj, cidade, uf, ativo')
    .order('nome')
  erro('Não foi possível carregar as empresas', error)
  return (data ?? []) as Empresa[]
}

export async function salvarEmpresa(e: Partial<Empresa>): Promise<Empresa> {
  const { data, error } = await supabase
    .from('empresa')
    .upsert(e)
    .select()
    .single()
  erro('Não foi possível salvar a empresa', error)
  return data as Empresa
}

export async function pessoas(): Promise<Pessoa[]> {
  const { data, error } = await supabase
    .from('pessoa')
    .select('id, nome, email, cargo, proprietario, ativo')
    .order('nome')
  erro('Não foi possível carregar as pessoas', error)
  return (data ?? []) as Pessoa[]
}

export async function tiposDeProjeto(): Promise<TipoProjeto[]> {
  const { data, error } = await supabase
    .from('tipo_projeto')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
  erro('Não foi possível carregar os tipos de projeto', error)
  return (data ?? []) as TipoProjeto[]
}

/** As fases de um tipo, na ordem. É o que a tela usa para montar o kanban. */
export async function fasesDoTipo(tipoId: string): Promise<Fase[]> {
  const { data, error } = await supabase
    .from('tipo_fase')
    .select('id, tipo_projeto_id, codigo, nome, ordem, categoria, cor, inicial, conclusiva, exige_setores, exige_orcamento, exige_cronograma')
    .eq('tipo_projeto_id', tipoId)
    .order('ordem')
  erro('Não foi possível carregar as fases', error)
  return (data ?? []) as Fase[]
}

/**
 * O esquema de um campo próprio. A tela lê isto para se montar — rótulo, tipo
 * de dado, grupo e ordem vêm daqui, nunca de uma lista no código.
 */
export type CampoDefinicao = {
  id: string
  tipo_projeto_id: string
  grupo: string
  codigo: string
  rotulo: string
  ajuda: string | null
  tipo_dado:
    | 'TEXTO' | 'TEXTO_LONGO' | 'NUMERO' | 'MOEDA' | 'PERCENTUAL'
    | 'DATA' | 'BOOLEANO' | 'SELECAO' | 'SELECAO_MULTIPLA'
    | 'PESSOA' | 'EMPRESA' | 'ARQUIVO'
  opcoes: string[]
  valor_padrao: unknown
  // Limites que o banco vai cobrar de NUMERO, MOEDA e PERCENTUAL.
  minimo: number | null
  maximo: number | null
  // Fase que o campo tranca: para SAIR dela, precisa estar preenchido.
  exigido_para_sair_de: string | null
  ordem: number
  ativo: boolean
}

export type Etapa = {
  id: string
  projeto_id: string
  pai_id: string | null
  codigo: string | null
  nome: string
  nivel: number
  ordem: number
  folha: boolean
  unidade: string | null
  quantidade: number | null
  preco_unitario: number | null
  valor: number | null
  a_confirmar: boolean
  peso_percentual: number | null
  percentual_concluido: number
}

export type Tarefa = {
  id: string
  projeto_id: string
  etapa_id: string | null
  pai_id: string | null
  codigo: string | null
  nome: string
  responsavel_id: string | null
  status: string
  marco: boolean
  data_inicio_prev: string | null
  data_fim_prev: string | null
  data_fim_real: string | null
  percentual_concluido: number
  ordem: number
}

/**
 * Uma linha de vw_pontuacao: o critério, a nota dada e quanto ela pesa.
 *
 * `pontos` é a contribuição REAL ao total do projeto — zero quando o critério
 * está desligado. `pontos_se_ligado` é o que a mesma nota valeria se ele
 * contasse. A nota de critério desligado continua na lista: alguém a deu.
 */
export type LinhaPontuacao = {
  projeto_id: string
  criterio: string
  criterio_nome: string
  criterio_descricao: string | null
  ordem: number
  ativo: boolean
  nota: number
  minimo: number
  maximo: number
  peso: number
  pontos: number
  pontos_se_ligado: number
  pontos_maximos: number
  justificativa: string | null
}

/** Um projeto da carteira. Nulo quando a RLS não o alcança — não é erro. */
export async function projeto(id: string): Promise<Projeto | null> {
  const { data, error } = await supabase
    .from('vw_projeto')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  erro('Não foi possível carregar o projeto', error)
  return (data as Projeto) ?? null
}

/** Um tipo pelo id — é dele que saem usa_orcamento, usa_pontuacao e o resto. */
export async function tipoDeProjeto(id: string): Promise<TipoProjeto | null> {
  const { data, error } = await supabase
    .from('tipo_projeto')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  erro('Não foi possível carregar o tipo de projeto', error)
  return (data as TipoProjeto) ?? null
}

/** O esquema dos campos próprios de um tipo, na ordem em que se apresentam. */
export async function camposDoTipo(tipoId: string): Promise<CampoDefinicao[]> {
  const { data, error } = await supabase
    .from('campo_definicao')
    .select('id, tipo_projeto_id, grupo, codigo, rotulo, ajuda, tipo_dado, opcoes, valor_padrao, minimo, maximo, exigido_para_sair_de, ordem, ativo')
    .eq('tipo_projeto_id', tipoId)
    .eq('ativo', true)
    .order('ordem')
  erro('Não foi possível carregar os campos do tipo', error)
  return (data ?? []) as CampoDefinicao[]
}

/** A EAP do projeto, achatada. A árvore se monta na tela, por pai_id. */
export async function etapasDoProjeto(projetoId: string): Promise<Etapa[]> {
  const { data, error } = await supabase
    .from('etapa')
    .select('id, projeto_id, pai_id, codigo, nome, nivel, ordem, folha, unidade, quantidade, preco_unitario, valor, a_confirmar, peso_percentual, percentual_concluido')
    .eq('projeto_id', projetoId)
    .order('ordem')
  erro('Não foi possível carregar as etapas', error)
  return (data ?? []) as Etapa[]
}

export async function tarefasDoProjeto(projetoId: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('tarefa')
    .select('id, projeto_id, etapa_id, pai_id, codigo, nome, responsavel_id, status, marco, data_inicio_prev, data_fim_prev, data_fim_real, percentual_concluido, ordem')
    .eq('projeto_id', projetoId)
    .order('ordem')
  erro('Não foi possível carregar as tarefas', error)
  return (data ?? []) as Tarefa[]
}

/** A pontuação aberta por critério. Vem vazia onde o tipo não pontua. */
export async function pontuacaoDoProjeto(projetoId: string): Promise<LinhaPontuacao[]> {
  const { data, error } = await supabase
    .from('vw_pontuacao')
    .select('*')
    .eq('projeto_id', projetoId)
    .order('ordem')
  erro('Não foi possível carregar a pontuação', error)
  return (data ?? []) as LinhaPontuacao[]
}

/**
 * O projeto como ele e na TABELA, nao na view.
 *
 * A carteira le `vw_projeto`, que ja resolve nomes e esconde dinheiro de quem
 * nao alcanca. O formulario precisa das colunas que a view nao carrega —
 * descricao, objetivo, problema, beneficios, local — e por isso le a tabela.
 */
export type ProjetoEdicao = {
  id: string
  codigo: string
  nome: string
  tipo_projeto_id: string
  empresa_id: string
  fase_id: string
  gerente_id: string | null
  solicitante_id: string | null
  setor: string | null
  frente: string | null
  seguranca: boolean
  descricao: string | null
  objetivo: string | null
  problema: string | null
  beneficios: string | null
  local: string | null
  cidade: string | null
  uf: string | null
  data_solicitacao: string | null
  data_inicio_prev: string | null
  data_fim_prev: string | null
  campos: Record<string, unknown>
}

/** Uma transicao declarada em tipo_transicao. Fluxo e dado, nao codigo. */
export type Transicao = {
  id: string
  de_fase_id: string
  para_fase_id: string
  rotulo: string
  papeis: string[]
  exige_motivo: boolean
  ordem: number
}

/** Um parecer de setor sobre o projeto numa fase. */
export type Parecer = {
  id: string
  projeto_id: string
  fase_id: string
  setor_codigo: string
  decisao: string
  parecer: string | null
  pessoa_id: string | null
  em: string
}

/** Uma linha do rateio entre empresas. A soma tem de fechar 100%. */
export type Rateio = {
  empresa_id: string
  percentual: number
  observacao: string | null
}

export type Setor = { codigo: string; nome: string; ordem: number }

/**
 * O projeto para edicao.
 *
 * Le `vw_projeto_edicao`, nao a tabela: a view traz as colunas que a carteira
 * nao carrega e aplica o mesmo filtro de dinheiro — as chaves de campo MOEDA
 * saem de `campos` para quem nao tem alcance financeiro.
 */
export async function projetoParaEdicao(id: string): Promise<ProjetoEdicao | null> {
  const { data, error } = await supabase
    .from('vw_projeto_edicao')
    // Literal de propósito: o cliente do Supabase tipa o retorno lendo esta
    // string em tempo de compilação, e uma constante montada some com os tipos.
    .select('id, codigo, nome, tipo_projeto_id, empresa_id, fase_id, gerente_id, solicitante_id, setor, frente, seguranca, descricao, objetivo, problema, beneficios, local, cidade, uf, data_solicitacao, data_inicio_prev, data_fim_prev, campos')
    .eq('id', id)
    .maybeSingle()
  erro('Nao foi possivel carregar o projeto para edicao', error)
  return (data as ProjetoEdicao) ?? null
}

/**
 * Cria o projeto e devolve o id.
 *
 * `codigo`, `numero` e `ano` nao vao daqui: quem os gera e o trigger
 * `app.gerar_codigo_projeto`, que conhece o prefixo da empresa e o contador do
 * ano. Mandar um codigo daqui seria disputar a numeracao com o banco.
 */
export async function criarProjeto(dados: Partial<ProjetoEdicao>): Promise<string> {
  const { data, error } = await supabase.from('projeto').insert(dados).select('id').single()
  erroDeEscrita('Nao foi possivel criar o projeto', error)
  return (data as { id: string }).id
}

export async function atualizarProjeto(id: string, dados: Partial<ProjetoEdicao>): Promise<void> {
  const { error } = await supabase.from('projeto').update(dados).eq('id', id)
  erroDeEscrita('Nao foi possivel salvar o projeto', error)
}

/**
 * Move o projeto de fase.
 *
 * O motivo vai em `motivo_arquivo` porque e de la que `app.registrar_fase` o
 * copia para o historico — vale para arquivar e para qualquer transicao que
 * peca motivo.
 */
export async function mudarFase(id: string, paraFaseId: string, motivo?: string): Promise<void> {
  const dados: Record<string, unknown> = { fase_id: paraFaseId }
  if (motivo) dados.motivo_arquivo = motivo
  const { error } = await supabase.from('projeto').update(dados).eq('id', id)
  erroDeEscrita('Nao foi possivel mudar a fase', error)
}

/** As saidas possiveis de uma fase, na ordem em que se oferecem. */
export async function transicoesDaFase(faseId: string): Promise<Transicao[]> {
  const { data, error } = await supabase
    .from('tipo_transicao')
    .select('id, de_fase_id, para_fase_id, rotulo, papeis, exige_motivo, ordem')
    .eq('de_fase_id', faseId)
    .order('ordem')
  erro('Nao foi possivel carregar as transicoes', error)
  return (data ?? []) as Transicao[]
}

export async function pareceresDoProjeto(projetoId: string): Promise<Parecer[]> {
  const { data, error } = await supabase
    .from('aprovacao')
    .select('id, projeto_id, fase_id, setor_codigo, decisao, parecer, pessoa_id, em')
    .eq('projeto_id', projetoId)
  erro('Nao foi possivel carregar os pareceres', error)
  return (data ?? []) as Parecer[]
}

export async function setores(): Promise<Setor[]> {
  const { data, error } = await supabase
    .from('setor')
    .select('codigo, nome, ordem')
    .eq('ativo', true)
    .order('ordem')
  erro('Nao foi possivel carregar os setores', error)
  return (data ?? []) as Setor[]
}

export async function rateioDoProjeto(projetoId: string): Promise<Rateio[]> {
  const { data, error } = await supabase
    .from('projeto_empresa')
    .select('empresa_id, percentual, observacao')
    .eq('projeto_id', projetoId)
  erro('Nao foi possivel carregar o rateio', error)
  return (data ?? []) as Rateio[]
}

/**
 * Troca o rateio inteiro, numa transacao so.
 *
 * A funcao `definir_rateio` apaga e regrava do lado do banco, e antecipa a
 * conferencia dos 100% para dentro da mesma transacao. Fazer isso em duas
 * requisicoes deixava a porta aberta para o projeto ficar sem rateio nenhum
 * se a segunda falhasse — e sem rateio o modelo le 100% da empresa principal,
 * que e um numero errado sem erro nenhum aparecendo.
 *
 * Lista vazia e decisao valida: significa 100% da empresa principal.
 */
export async function salvarRateio(projetoId: string, linhas: Rateio[]): Promise<void> {
  const { error } = await supabase.rpc('definir_rateio', {
    p_projeto: projetoId,
    p_linhas: linhas,
  })
  erroDeEscrita('Nao foi possivel gravar o rateio', error)
}

/**
 * O que se pode escrever numa etapa.
 *
 * `valor` fica de fora de proposito: e coluna gerada
 * (`quantidade * preco_unitario`), e o Postgres recusa escrita nela. Quem
 * calcula o dinheiro e o banco; a tela so soma o que ele devolve.
 */
export type EtapaEdicao = {
  projeto_id: string
  pai_id: string | null
  codigo: string
  nome: string
  descricao: string | null
  nivel: number
  ordem: number
  folha: boolean
  unidade: string | null
  quantidade: number
  preco_unitario: number
  a_confirmar: boolean
  peso_percentual: number
  percentual_concluido: number
}

export async function criarEtapa(dados: Partial<EtapaEdicao>): Promise<string> {
  const { data, error } = await supabase.from('etapa').insert(dados).select('id').single()
  erroDeEscrita('Nao foi possivel criar a etapa', error)
  return (data as { id: string }).id
}

export async function atualizarEtapa(id: string, dados: Partial<EtapaEdicao>): Promise<void> {
  const { error } = await supabase.from('etapa').update(dados).eq('id', id)
  erroDeEscrita('Nao foi possivel salvar a etapa', error)
}

/** Apaga a etapa. Os filhos vao junto: a chave estrangeira e `on delete cascade`. */
export async function excluirEtapa(id: string): Promise<void> {
  const { error } = await supabase.from('etapa').delete().eq('id', id)
  erroDeEscrita('Nao foi possivel excluir a etapa', error)
}

/**
 * Regrava a `ordem` de um conjunto de irmas.
 *
 * A ordem e coluna, nao consequencia do codigo: duas etapas podem se chamar
 * "1.10" e "1.9" e a segunda vir antes. Sao varias requisicoes porque nao ha
 * upsert possivel — `codigo` e `nome` sao NOT NULL e um upsert de id+ordem
 * tentaria inserir linha incompleta.
 */
export async function reordenarEtapas(linhas: { id: string; ordem: number }[]): Promise<void> {
  for (const l of linhas) {
    const { error } = await supabase.from('etapa').update({ ordem: l.ordem }).eq('id', l.id)
    erroDeEscrita('Nao foi possivel reordenar as etapas', error)
  }
}

/**
 * Os estados de uma tarefa.
 *
 * Espelham o CHECK `tarefa_status_check`. Ficariam melhor vindo do banco, mas
 * `supabase gen types` so exporta valores de tipo `enum`, e estes sao CHECK —
 * chegam ao TypeScript como `string`. Enquanto for assim, a lista mora aqui,
 * num lugar so, apontando para a constraint que manda.
 */
export const STATUS_TAREFA = [
  'NAO_INICIADA', 'EM_ANDAMENTO', 'BLOQUEADA', 'CONCLUIDA', 'CANCELADA',
] as const

/** Os tipos de ligacao entre tarefas, do CHECK `tarefa_dependencia_tipo_check`. */
export const TIPOS_DE_DEPENDENCIA = [
  { codigo: 'TI', nome: 'Termino a inicio' },
  { codigo: 'II', nome: 'Inicio a inicio' },
  { codigo: 'TT', nome: 'Termino a termino' },
  { codigo: 'IT', nome: 'Inicio a termino' },
] as const

export type TarefaEdicao = {
  projeto_id: string
  etapa_id: string | null
  pai_id: string | null
  codigo: string | null
  nome: string
  descricao: string | null
  responsavel_id: string | null
  status: string
  marco: boolean
  data_inicio_prev: string | null
  data_fim_prev: string | null
  data_inicio_real: string | null
  data_fim_real: string | null
  duracao_dias: number | null
  percentual_concluido: number
  ordem: number
  observacao: string | null
}

export type ItemChecklist = {
  id: string
  tarefa_id: string
  texto: string
  concluido: boolean
  concluido_em: string | null
  concluido_por: string | null
  ordem: number
}

export type Dependencia = {
  id: string
  tarefa_id: string
  predecessora_id: string
  tipo: string
  folga_dias: number
}

export async function criarTarefa(dados: Partial<TarefaEdicao>): Promise<string> {
  const { data, error } = await supabase.from('tarefa').insert(dados).select('id').single()
  erroDeEscrita('Nao foi possivel criar a tarefa', error)
  return (data as { id: string }).id
}

/**
 * Salva a tarefa e devolve quantas linhas mudaram.
 *
 * Zero linhas nao e erro do PostgREST: e a RLS recusando em silencio. A tela
 * usa isso para dizer "voce so pode alterar as tarefas de que e responsavel"
 * em vez de fingir que salvou.
 */
export async function atualizarTarefa(id: string, dados: Partial<TarefaEdicao>): Promise<number> {
  const { data, error } = await supabase.from('tarefa').update(dados).eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel salvar a tarefa', error)
  return (data ?? []).length
}

export async function excluirTarefa(id: string): Promise<number> {
  const { data, error } = await supabase.from('tarefa').delete().eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel excluir a tarefa', error)
  return (data ?? []).length
}

export async function reordenarTarefas(linhas: { id: string; ordem: number }[]): Promise<void> {
  for (const l of linhas) {
    const { error } = await supabase.from('tarefa').update({ ordem: l.ordem }).eq('id', l.id)
    erroDeEscrita('Nao foi possivel reordenar as tarefas', error)
  }
}

/** O checklist de todas as tarefas de um projeto, de uma vez. */
export async function checklistDasTarefas(tarefaIds: string[]): Promise<ItemChecklist[]> {
  if (tarefaIds.length === 0) return []
  const { data, error } = await supabase
    .from('tarefa_checklist')
    .select('id, tarefa_id, texto, concluido, concluido_em, concluido_por, ordem')
    .in('tarefa_id', tarefaIds)
    .order('ordem')
  erro('Nao foi possivel carregar os checklists', error)
  return (data ?? []) as ItemChecklist[]
}

export async function criarItemChecklist(
  tarefaId: string, texto: string, ordem: number,
): Promise<void> {
  const { error } = await supabase
    .from('tarefa_checklist')
    .insert({ tarefa_id: tarefaId, texto, ordem })
  erroDeEscrita('Nao foi possivel acrescentar o item', error)
}

/**
 * Marca ou desmarca um item.
 *
 * Quem marcou e quando andam juntos com o marcado: item concluido sem autor e
 * uma informacao pela metade, e desmarcar tem de limpar os tres.
 */
export async function marcarItemChecklist(
  id: string, concluido: boolean, pessoaId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('tarefa_checklist')
    .update({
      concluido,
      concluido_em: concluido ? new Date().toISOString() : null,
      concluido_por: concluido ? pessoaId : null,
    })
    .eq('id', id)
  erroDeEscrita('Nao foi possivel marcar o item', error)
}

export async function excluirItemChecklist(id: string): Promise<void> {
  const { error } = await supabase.from('tarefa_checklist').delete().eq('id', id)
  erroDeEscrita('Nao foi possivel excluir o item', error)
}

export async function reordenarChecklist(linhas: { id: string; ordem: number }[]): Promise<void> {
  for (const l of linhas) {
    const { error } = await supabase
      .from('tarefa_checklist').update({ ordem: l.ordem }).eq('id', l.id)
    erroDeEscrita('Nao foi possivel reordenar o checklist', error)
  }
}

export async function dependenciasDasTarefas(tarefaIds: string[]): Promise<Dependencia[]> {
  if (tarefaIds.length === 0) return []
  const { data, error } = await supabase
    .from('tarefa_dependencia')
    .select('id, tarefa_id, predecessora_id, tipo, folga_dias')
    .in('tarefa_id', tarefaIds)
  erro('Nao foi possivel carregar as dependencias', error)
  return (data ?? []) as Dependencia[]
}

/** O banco recusa ciclo por trigger; a mensagem dele sobe inteira. */
export async function criarDependencia(
  tarefaId: string, predecessoraId: string, tipo: string, folgaDias: number,
): Promise<void> {
  const { error } = await supabase.from('tarefa_dependencia').insert({
    tarefa_id: tarefaId,
    predecessora_id: predecessoraId,
    tipo,
    folga_dias: folgaDias,
  })
  erroDeEscrita('Nao foi possivel criar a dependencia', error)
}

export async function excluirDependencia(id: string): Promise<void> {
  const { error } = await supabase.from('tarefa_dependencia').delete().eq('id', id)
  erroDeEscrita('Nao foi possivel excluir a dependencia', error)
}

/** Quem sou eu, do lado do GestPlan (não do lado do Auth). */
export async function eu(): Promise<Pessoa | null> {
  const { data: sessao } = await supabase.auth.getUser()
  if (!sessao.user) return null
  const { data, error } = await supabase
    .from('pessoa')
    .select('id, nome, email, cargo, proprietario, ativo')
    .eq('auth_user_id', sessao.user.id)
    .maybeSingle()
  erro('Não foi possível identificar o usuário', error)
  return (data as Pessoa) ?? null
}
