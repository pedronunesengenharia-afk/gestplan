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
  criado_em: string
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
  fone: string | null
  cargo: string | null
  setor: string | null
  vinculo: string
  proprietario: boolean
  ativo: boolean
  auth_user_id: string | null
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

/**
 * O que a carteira aceita filtrar. Tudo opcional; ausente = nao filtra.
 *
 * `arquivados` false esconde o que ja saiu de cena — `vw_projeto.ativo` e
 * `arquivado_em is null and categoria <> ARQUIVADO`, calculado na view.
 */
export type FiltroCarteira = {
  empresa_id?: string
  tipo_projeto_id?: string
  fase_id?: string
  prioridade?: string
  frente?: string
  seguranca?: boolean
  busca?: string
  arquivados?: boolean
}

/**
 * A carteira, filtrada pelo banco.
 *
 * Filtrar e trabalho do Postgres: trazer 29 linhas para peneirar no navegador
 * funciona hoje e para de funcionar quando forem 3.000 — e some com o indice.
 */
export async function carteiraFiltrada(f: FiltroCarteira = {}): Promise<Projeto[]> {
  let q = supabase.from('vw_projeto').select('*')

  if (f.empresa_id) q = q.eq('empresa_id', f.empresa_id)
  if (f.tipo_projeto_id) q = q.eq('tipo_projeto_id', f.tipo_projeto_id)
  if (f.fase_id) q = q.eq('fase_id', f.fase_id)
  if (f.prioridade) q = q.eq('prioridade', f.prioridade)
  if (f.frente) q = q.eq('frente', f.frente)
  if (f.seguranca) q = q.eq('seguranca', true)
  if (!f.arquivados) q = q.eq('ativo', true)

  if (f.busca && f.busca.trim() !== '') {
    // Virgula e parentese sao a sintaxe do `or` do PostgREST; um nome de
    // projeto com eles quebraria a consulta em vez de buscar.
    const termo = f.busca.trim().replace(/[,()*]/g, ' ')
    q = q.or(`codigo.ilike.%${termo}%,nome.ilike.%${termo}%`)
  }

  const { data, error } = await q
    .order('pontuacao_total', { ascending: false })
    .order('codigo', { ascending: false })
  erro('Nao foi possivel carregar a carteira', error)
  return (data ?? []) as Projeto[]
}

/** A carteira de um tipo so — as colunas do kanban sao as fases DELE. */
export async function carteiraDoTipo(tipoId: string): Promise<Projeto[]> {
  return carteiraFiltrada({ tipo_projeto_id: tipoId, arquivados: true })
}

/**
 * As frentes em uso, para o filtro se oferecer.
 *
 * Sao os valores distintos de `projeto.frente` — texto livre por enquanto,
 * como a migracao 011 registrou. O PostgREST nao faz DISTINCT, entao a coluna
 * vem inteira e se agrupa aqui: e uma coluna so, e a lista de opcoes nao e
 * filtro nenhum.
 */
export async function frentesUsadas(): Promise<string[]> {
  const { data, error } = await supabase.from('vw_projeto').select('frente')
  erro('Nao foi possivel carregar as frentes', error)
  const vistas = new Set<string>()
  for (const linha of (data ?? []) as { frente: string | null }[]) {
    if (linha.frente) vistas.add(linha.frente)
  }
  return [...vistas].sort((a, b) => a.localeCompare(b, 'pt-BR'))
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
    .select('id, nome, email, fone, cargo, setor, vinculo, proprietario, ativo, auth_user_id')
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
  // Nulos quando a pessoa não alcança dinheiro: a etapa aparece, o preço não.
  unidade: string | null
  quantidade: number | null
  preco_unitario: number | null
  valor: number | null
  a_confirmar: boolean | null
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
  data_inicio_real: string | null
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

/**
 * A EAP do projeto, achatada. A árvore se monta na tela, por pai_id.
 *
 * Lê `vw_etapa`, não a tabela: desde que o dinheiro saiu para `etapa_valor`, é
 * a view que junta as duas — e as colunas de valor vêm nulas para quem não tem
 * alcance financeiro, em vez de virem.
 */
export async function etapasDoProjeto(projetoId: string): Promise<Etapa[]> {
  const { data, error } = await supabase
    .from('vw_etapa')
    .select('id, projeto_id, pai_id, codigo, nome, nivel, ordem, folha, unidade, quantidade, preco_unitario, valor, a_confirmar, peso_percentual, percentual_concluido')
    .eq('projeto_id', projetoId)
    .order('ordem')
  erro('Não foi possível carregar as etapas', error)
  return (data ?? []) as Etapa[]
}

export async function tarefasDoProjeto(projetoId: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('tarefa')
    .select('id, projeto_id, etapa_id, pai_id, codigo, nome, responsavel_id, status, marco, data_inicio_prev, data_fim_prev, data_inicio_real, data_fim_real, percentual_concluido, ordem')
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

/**
 * O que e estrutura e o que e dinheiro.
 *
 * Desde que `etapa_valor` existe, sao duas tabelas com duas portas: a EAP e do
 * projeto e quem executa precisa dela; quantidade e preco tem a porta do
 * dinheiro. As funcoes abaixo separam a carga sozinhas, para a tela nao ter de
 * lembrar disso a cada campo.
 */
const CAMPOS_DE_DINHEIRO = ['unidade', 'quantidade', 'preco_unitario', 'a_confirmar'] as const

function separar(dados: Partial<EtapaEdicao>) {
  const estrutura: Record<string, unknown> = {}
  const dinheiro: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(dados)) {
    if ((CAMPOS_DE_DINHEIRO as readonly string[]).includes(chave)) dinheiro[chave] = valor
    else estrutura[chave] = valor
  }
  return { estrutura, dinheiro }
}

export async function criarEtapa(dados: Partial<EtapaEdicao>): Promise<string> {
  const { estrutura, dinheiro } = separar(dados)
  const { data, error } = await supabase.from('etapa').insert(estrutura).select('id').single()
  erroDeEscrita('Nao foi possivel criar a etapa', error)
  const id = (data as { id: string }).id

  // A linha de etapa_valor nasce por trigger; aqui so se preenche o que veio.
  if (Object.keys(dinheiro).length > 0) await atualizarValorDaEtapa(id, dinheiro)
  return id
}

export async function atualizarEtapa(id: string, dados: Partial<EtapaEdicao>): Promise<void> {
  const { estrutura, dinheiro } = separar(dados)
  if (Object.keys(estrutura).length > 0) {
    const { error } = await supabase.from('etapa').update(estrutura).eq('id', id)
    erroDeEscrita('Nao foi possivel salvar a etapa', error)
  }
  if (Object.keys(dinheiro).length > 0) await atualizarValorDaEtapa(id, dinheiro)
}

async function atualizarValorDaEtapa(etapaId: string, dinheiro: Record<string, unknown>) {
  const { error } = await supabase.from('etapa_valor').update(dinheiro).eq('etapa_id', etapaId)
  erroDeEscrita('Nao foi possivel salvar o valor da etapa', error)
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
/** As tarefas de varios projetos de uma vez — o painel soma por tipo. */
export async function tarefasDeProjetos(projetoIds: string[]): Promise<Tarefa[]> {
  if (projetoIds.length === 0) return []
  const { data, error } = await supabase
    .from('tarefa')
    .select('id, projeto_id, etapa_id, pai_id, codigo, nome, responsavel_id, status, marco, data_inicio_prev, data_fim_prev, data_inicio_real, data_fim_real, percentual_concluido, ordem')
    .in('projeto_id', projetoIds)
  erro('Nao foi possivel carregar as tarefas', error)
  return (data ?? []) as Tarefa[]
}

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

export type Criterio = {
  id: string
  codigo: string
  nome: string
  descricao: string | null
  tipo_projeto_id: string | null
  minimo: number
  maximo: number
  peso: number
  ordem: number
  ativo: boolean
}

export type NotaDoProjeto = {
  criterio_id: string
  nota: number
  justificativa: string | null
}

/**
 * Os criterios que valem para um tipo.
 *
 * `tipo_projeto_id` nulo quer dizer "vale para todo tipo" — e assim que o
 * modelo guarda o criterio geral, e por isso o filtro e uma alternativa, nao
 * uma igualdade.
 */
export async function criteriosDePontuacao(tipoProjetoId: string): Promise<Criterio[]> {
  const { data, error } = await supabase
    .from('pontuacao_criterio')
    .select('id, codigo, nome, descricao, tipo_projeto_id, minimo, maximo, peso, ordem, ativo')
    .or(`tipo_projeto_id.is.null,tipo_projeto_id.eq.${tipoProjetoId}`)
    .order('ordem')
  erro('Nao foi possivel carregar os criterios', error)
  return (data ?? []) as Criterio[]
}

export async function notasDoProjeto(projetoId: string): Promise<NotaDoProjeto[]> {
  const { data, error } = await supabase
    .from('projeto_pontuacao')
    .select('criterio_id, nota, justificativa')
    .eq('projeto_id', projetoId)
  erro('Nao foi possivel carregar as notas', error)
  return (data ?? []) as NotaDoProjeto[]
}

/**
 * Grava as notas.
 *
 * `pontuacao_total` e `prioridade` NAO vao daqui: sao derivados, calculados
 * por `app.recalcular_prioridade` no trigger de projeto_pontuacao. Mandar um
 * valor para eles seria disputar a conta com o banco — e perder na proxima vez
 * que alguem mudasse um peso.
 */
export async function salvarNotas(
  projetoId: string, pessoaId: string | null, notas: NotaDoProjeto[],
): Promise<void> {
  if (notas.length === 0) return
  const { error } = await supabase.from('projeto_pontuacao').upsert(
    notas.map((n) => ({
      projeto_id: projetoId,
      criterio_id: n.criterio_id,
      nota: n.nota,
      justificativa: n.justificativa,
      pessoa_id: pessoaId,
    })),
    { onConflict: 'projeto_id,criterio_id' },
  )
  erroDeEscrita('Nao foi possivel salvar a pontuacao', error)
}

/** Os cortes que separam URGENTE de IMPORTANTE, lidos de `configuracao`. */
export async function cortesDePrioridade(): Promise<{ urgente: number; importante: number }> {
  const { data, error } = await supabase
    .from('configuracao')
    .select('valor')
    .eq('chave', 'prioridade.cortes')
    .maybeSingle()
  erro('Nao foi possivel carregar os cortes de prioridade', error)
  const v = (data as { valor: { urgente?: number; importante?: number } } | null)?.valor
  return { urgente: Number(v?.urgente ?? 0.7), importante: Number(v?.importante ?? 0.25) }
}

/** As decisoes possiveis, do CHECK `aprovacao_decisao_check`. */
export const DECISOES = ['CIENTE', 'APROVADO', 'REPROVADO', 'POSTERGADO'] as const

/**
 * Registra o parecer de um setor sobre o projeto na fase.
 *
 * Upsert por (projeto, fase, setor): e a chave unica da tabela, e refazer o
 * parecer de um setor e revisao, nao linha nova. O banco ainda cobra parecer
 * escrito em REPROVADO e data em POSTERGADO — a tela pergunta antes, mas quem
 * decide continua sendo o CHECK.
 */
export async function registrarParecer(p: {
  projeto_id: string
  fase_id: string
  setor_codigo: string
  pessoa_id: string | null
  decisao: string
  parecer: string | null
  postergado_para: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('aprovacao')
    .upsert(p, { onConflict: 'projeto_id,fase_id,setor_codigo' })
  erroDeEscrita('Nao foi possivel registrar o parecer', error)
}

export type Comentario = {
  id: string
  projeto_id: string
  tarefa_id: string | null
  responde_id: string | null
  pessoa_id: string
  texto: string
  mencionados: string[]
  criado_em: string
  editado_em: string | null
}

export type Anexo = {
  id: string
  projeto_id: string
  tipo: string
  titulo: string
  storage_path: string
  mime: string | null
  bytes: number | null
  secao: string | null
  ordem: number
  criado_em: string
  criado_por: string | null
}

/** Os tipos de anexo, do CHECK `anexo_tipo_check`. */
export const TIPOS_DE_ANEXO = [
  'FOTO', 'PROJETO', 'MEMORIAL', 'ART', 'CONTRATO', 'ADITIVO', 'MEDICAO',
  'PROPOSTA', 'NOTA_FISCAL', 'RELATORIO', 'OUTRO',
] as const

export const BUCKET_ANEXOS = 'anexos'

export async function comentariosDoProjeto(projetoId: string): Promise<Comentario[]> {
  const { data, error } = await supabase
    .from('comentario')
    .select('id, projeto_id, tarefa_id, responde_id, pessoa_id, texto, mencionados, criado_em, editado_em')
    .eq('projeto_id', projetoId)
    .order('criado_em')
  erro('Nao foi possivel carregar os comentarios', error)
  return (data ?? []) as Comentario[]
}

/**
 * Escreve um comentario.
 *
 * `pessoa_id` vai explicito porque a politica `comentario_proprio` exige que
 * ele seja `app.pessoa_atual()` — escrever em nome de outro e recusado pelo
 * banco, nao pela tela.
 */
export async function criarComentario(c: {
  projeto_id: string
  pessoa_id: string
  texto: string
  responde_id: string | null
  mencionados: string[]
}): Promise<void> {
  const { error } = await supabase.from('comentario').insert(c)
  erroDeEscrita('Nao foi possivel comentar', error)
}

/** Editar e so do autor: a politica compara pessoa_id com quem esta logado. */
export async function editarComentario(id: string, texto: string): Promise<number> {
  const { data, error } = await supabase
    .from('comentario')
    .update({ texto, editado_em: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  erroDeEscrita('Nao foi possivel editar o comentario', error)
  return (data ?? []).length
}

export async function excluirComentario(id: string): Promise<number> {
  const { data, error } = await supabase.from('comentario').delete().eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel excluir o comentario', error)
  return (data ?? []).length
}

export async function anexosDoProjeto(projetoId: string): Promise<Anexo[]> {
  const { data, error } = await supabase
    .from('anexo')
    .select('id, projeto_id, tipo, titulo, storage_path, mime, bytes, secao, ordem, criado_em, criado_por')
    .eq('projeto_id', projetoId)
    .order('secao')
    .order('ordem')
  erro('Nao foi possivel carregar os anexos', error)
  return (data ?? []) as Anexo[]
}

/**
 * Manda o arquivo para o Storage e grava a linha.
 *
 * O caminho e `projeto/<id do projeto>/<arquivo>` porque a politica de
 * storage.objects le o SEGUNDO pedaco do caminho para saber de quem e o
 * arquivo. Fora dessa convencao o upload e recusado — e e o proprio banco que
 * recusa, com a sessao do usuario; nenhuma service_role passa por aqui.
 *
 * `mime` e `bytes` saem do arquivo no momento do envio: depois ninguem sabe
 * mais dizer, e "quanto pesa" e a pergunta que se faz quando o Storage enche.
 */
export async function enviarAnexo(
  arquivo: File,
  dados: { projeto_id: string; titulo: string; tipo: string; secao: string | null; pessoa_id: string | null },
): Promise<void> {
  const caminho = `projeto/${dados.projeto_id}/${arquivo.name}`

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .upload(caminho, arquivo, { upsert: false, contentType: arquivo.type || undefined })
  if (erroUpload) throw new ErroDoBanco('Nao foi possivel enviar o arquivo', erroUpload.message)

  const { error } = await supabase.from('anexo').insert({
    projeto_id: dados.projeto_id,
    tipo: dados.tipo,
    titulo: dados.titulo || arquivo.name,
    storage_path: caminho,
    mime: arquivo.type || null,
    bytes: arquivo.size,
    secao: dados.secao,
    criado_por: dados.pessoa_id,
  })
  if (error) {
    // A linha nao entrou: o arquivo orfao no bucket so confundiria.
    await supabase.storage.from(BUCKET_ANEXOS).remove([caminho])
    throw new ErroDoBanco('Nao foi possivel gravar o anexo', error.message)
  }
}

/**
 * Apaga o arquivo e depois a linha.
 *
 * Nessa ordem, e a linha vai embora mesmo que o arquivo ja nao esteja la:
 * linha apontando para arquivo inexistente e pior do que arquivo sem linha —
 * uma aparece na tela e quebra, o outro so ocupa espaco.
 */
export async function excluirAnexo(a: Anexo): Promise<void> {
  await supabase.storage.from(BUCKET_ANEXOS).remove([a.storage_path])
  const { error } = await supabase.from('anexo').delete().eq('id', a.id)
  erroDeEscrita('Nao foi possivel excluir o anexo', error)
}

/**
 * Um endereco temporario para ver ou baixar o arquivo.
 *
 * O bucket e privado: nao ha URL publica, e cada acesso passa pela politica
 * do Storage com a sessao de quem pediu.
 */
export async function urlAssinada(caminho: string, segundos = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .createSignedUrl(caminho, segundos)
  if (error) return null
  return data?.signedUrl ?? null
}

/**
 * O que esta pessoa pode neste projeto, perguntado ao banco.
 *
 * Sao as mesmas funcoes que as politicas usam, expostas em `public` pela
 * migracao 20260827230000. Antes disso a tela descobria a resposta pelo
 * numero de linhas que um UPDATE negado devolvia — funcionava, mas era
 * adivinhacao. Agora a pergunta e direta, e continua havendo uma so definicao
 * da regra: a do banco.
 */
export async function possoEditarProjeto(projetoId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('posso_editar_projeto', { p_projeto: projetoId })
  erro('Nao foi possivel conferir a permissao de edicao', error)
  return data === true
}

export async function possoVerValores(projetoId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('posso_ver_valores', { p_projeto: projetoId })
  erro('Nao foi possivel conferir o alcance financeiro', error)
  return data === true
}

export async function possoAssinar(projetoId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('posso_assinar', { p_projeto: projetoId })
  erro('Nao foi possivel conferir a permissao de parecer', error)
  return data === true
}

/* ==========================================================================
   O painel
   As seis views abaixo ja existiam e nenhuma tela consumia. Elas fazem a
   conta pesada no Postgres; aqui so se soma o que e por projeto.
   ========================================================================== */

export type LinhaCurvaS = {
  projeto_id: string
  competencia: string
  base_mes: number
  previsto_mes: number
  realizado_mes: number
}

export type LinhaFluxo = {
  projeto_id: string
  competencia: string | null
  a_pagar: number
  pago: number
  vencido: number
  parcelas: number
}

export type LinhaAvanco = {
  projeto_id: string
  peso_total: number
  avanco_fisico: number
  etapas: number
  etapas_concluidas: number
}

export type LinhaCapacidade = {
  pessoa_id: string
  pessoa_nome: string
  projetos: number
  dedicacao_total: number
  sobrealocada: boolean
}

export type TarefaAtrasada = {
  id: string
  projeto_id: string
  projeto_codigo: string
  nome: string
  dias_atraso: number
  data_fim_prev: string | null
  responsavel_nome: string | null
  caminho_critico: boolean
}

export type ProjetoARetomar = {
  id: string
  codigo: string
  nome: string
  retorno_em: string
  dias: number
  empresa_nome: string
}

export async function curvaS(): Promise<LinhaCurvaS[]> {
  const { data, error } = await supabase
    .from('vw_curva_s')
    .select('projeto_id, competencia, base_mes, previsto_mes, realizado_mes')
    .order('competencia')
  erro('Nao foi possivel carregar a curva S', error)
  return (data ?? []) as LinhaCurvaS[]
}

export async function fluxoMensal(): Promise<LinhaFluxo[]> {
  const { data, error } = await supabase
    .from('vw_fluxo_mensal')
    .select('projeto_id, competencia, a_pagar, pago, vencido, parcelas')
  erro('Nao foi possivel carregar o fluxo mensal', error)
  return (data ?? []) as LinhaFluxo[]
}

export async function avancoDosProjetos(): Promise<LinhaAvanco[]> {
  const { data, error } = await supabase
    .from('vw_avanco')
    .select('projeto_id, peso_total, avanco_fisico, etapas, etapas_concluidas')
  erro('Nao foi possivel carregar o avanco', error)
  return (data ?? []) as LinhaAvanco[]
}

export async function capacidadeDaEquipe(): Promise<LinhaCapacidade[]> {
  const { data, error } = await supabase
    .from('vw_capacidade')
    .select('pessoa_id, pessoa_nome, projetos, dedicacao_total, sobrealocada')
    .order('dedicacao_total', { ascending: false })
  erro('Nao foi possivel carregar a capacidade', error)
  return (data ?? []) as LinhaCapacidade[]
}

export async function tarefasAtrasadas(): Promise<TarefaAtrasada[]> {
  const { data, error } = await supabase
    .from('vw_tarefa_atrasada')
    .select('id, projeto_id, projeto_codigo, nome, dias_atraso, data_fim_prev, responsavel_nome, caminho_critico')
    .order('dias_atraso', { ascending: false })
  erro('Nao foi possivel carregar as tarefas atrasadas', error)
  return (data ?? []) as TarefaAtrasada[]
}

export async function projetosARetomar(): Promise<ProjetoARetomar[]> {
  const { data, error } = await supabase
    .from('vw_retomada')
    .select('id, codigo, nome, retorno_em, dias, empresa_nome')
    .order('dias', { ascending: false })
  erro('Nao foi possivel carregar os projetos a retomar', error)
  return (data ?? []) as ProjetoARetomar[]
}

/**
 * Custo realizado por categoria.
 *
 * Duas consultas em vez de um embed: o vinculo e opcional (`categoria_id` pode
 * ser nulo) e custo sem categoria precisa aparecer como "sem categoria", nao
 * sumir. Sao 171 linhas — juntar aqui e mais barato do que explicar isso ao
 * PostgREST.
 */
export async function custoPorCategoria(): Promise<{ nome: string; valor: number }[]> {
  const [{ data: custos, error: e1 }, { data: cats, error: e2 }] = await Promise.all([
    supabase.from('custo').select('valor, categoria_id'),
    supabase.from('categoria_custo').select('id, nome'),
  ])
  erro('Nao foi possivel carregar os custos', e1)
  erro('Nao foi possivel carregar as categorias', e2)

  const nomeDe = new Map((cats ?? []).map((c) => [(c as { id: string }).id, (c as { nome: string }).nome]))
  const soma = new Map<string, number>()
  for (const c of (custos ?? []) as { valor: number; categoria_id: string | null }[]) {
    const nome = (c.categoria_id && nomeDe.get(c.categoria_id)) || 'Sem categoria'
    soma.set(nome, (soma.get(nome) ?? 0) + Number(c.valor ?? 0))
  }
  return [...soma.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
}

/** Os papeis, do CHECK `pessoa_papel_papel_check`. */
export const PAPEIS = [
  { codigo: 'GERENTE_PROJETOS', nome: 'Gerente de projetos', ajuda: 'Cria e edita projeto, cronograma e orcamento na empresa.' },
  { codigo: 'TIME_TI', nome: 'Time de TI', ajuda: 'Edita os projetos do tipo TI.' },
  { codigo: 'ESTRUTURA', nome: 'Estrutura / operacao', ajuda: 'Ve o projeto e executa; nao ve dinheiro.' },
  { codigo: 'FINANCEIRO_COMPRAS', nome: 'Financeiro e compras', ajuda: 'Ve valores, custos e parcelas.' },
  { codigo: 'AVALIADOR', nome: 'Avaliador', ajuda: 'Assina parecer de setor nas fases que exigem.' },
  { codigo: 'EXTERNO', nome: 'Externo (fornecedor)', ajuda: 'So o que o contrato dele alcanca. Nunca ve dinheiro alheio.' },
] as const

/** Os vinculos possiveis, do CHECK `pessoa_vinculo_check`. */
export const VINCULOS = ['CLT', 'PJ', 'TERCEIRO', 'SOCIO', 'ESTAGIO'] as const

export type PessoaEdicao = {
  id?: string
  nome: string
  email: string | null
  fone: string | null
  cargo: string | null
  setor: string | null
  vinculo: string
  ativo: boolean
}

export type PapelDaPessoa = {
  id: string
  pessoa_id: string
  empresa_id: string
  papel: string
}

/**
 * Cria ou atualiza uma pessoa.
 *
 * Pessoa nao e usuario: quem aparece na equipe pode nunca fazer login. E o que
 * permite alocar e apontar hora de terceiro sem criar conta para ele.
 */
export async function salvarPessoa(p: PessoaEdicao): Promise<string> {
  const { data, error } = await supabase.from('pessoa').upsert(p).select('id').single()
  erroDeEscrita('Nao foi possivel salvar a pessoa', error)
  return (data as { id: string }).id
}

/**
 * O custo-hora da equipe, de `pessoa_custo`.
 *
 * Mora fora de `pessoa` desde a migracao 20260830120000: a lista de pessoas e
 * visivel para a equipe interna e o custo-hora nao e. Quem nao e proprietario
 * recebe um mapa VAZIO — nao um erro, porque a RLS filtra linha, nao recusa a
 * pergunta. Linha ausente vale zero.
 */
export async function custosHora(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('pessoa_custo').select('pessoa_id, custo_hora')
  erro('Nao foi possivel carregar o custo-hora', error)
  return new Map((data ?? []).map((l) => [l.pessoa_id as string, Number(l.custo_hora)]))
}

/** Zero apaga a linha: a tabela e esparsa, e ausencia ja significa zero. */
export async function salvarCustoHora(pessoaId: string, valor: number): Promise<void> {
  if (valor <= 0) {
    const { error } = await supabase.from('pessoa_custo').delete().eq('pessoa_id', pessoaId)
    erroDeEscrita('Nao foi possivel limpar o custo-hora', error)
    return
  }
  const { error } = await supabase
    .from('pessoa_custo')
    .upsert({ pessoa_id: pessoaId, custo_hora: valor, atualizado_em: new Date().toISOString() })
  erroDeEscrita('Nao foi possivel salvar o custo-hora', error)
}

export async function papeisDaEquipe(): Promise<PapelDaPessoa[]> {
  const { data, error } = await supabase
    .from('pessoa_papel')
    .select('id, pessoa_id, empresa_id, papel')
  erro('Nao foi possivel carregar os papeis', error)
  return (data ?? []) as PapelDaPessoa[]
}

export async function darPapel(pessoaId: string, empresaId: string, papel: string): Promise<void> {
  const { error } = await supabase
    .from('pessoa_papel')
    .insert({ pessoa_id: pessoaId, empresa_id: empresaId, papel })
  erroDeEscrita('Nao foi possivel dar o papel', error)
}

export async function tirarPapel(id: string): Promise<void> {
  const { error } = await supabase.from('pessoa_papel').delete().eq('id', id)
  erroDeEscrita('Nao foi possivel tirar o papel', error)
}

/**
 * Liga o login desta sessao a pessoa cadastrada com o mesmo e-mail.
 *
 * Chamada a cada entrada, e inofensiva quando ja esta ligado. Sem ela, quem o
 * proprietario cadastra na Equipe nunca entra: o cadastro existe, o login
 * existe, e nada os apresenta um ao outro.
 */
export async function vincularMeuAcesso(): Promise<string | null> {
  const { data, error } = await supabase.rpc('vincular_meu_acesso')
  // Falha aqui nao pode derrubar a entrada: quem ja esta vinculado entra do
  // mesmo jeito, e quem nao esta ve o aviso de sempre.
  if (error) return null
  return (data as string | null) ?? null
}

/** Qual fila recebe chamado, segundo `configuracao.chamado.tipo_projeto`. */
export async function tipoDeChamado(): Promise<{ id: string; nome: string } | null> {
  const { data, error } = await supabase
    .from('configuracao')
    .select('valor')
    .eq('chave', 'chamado.tipo_projeto')
    .maybeSingle()
  erro('Nao foi possivel descobrir a fila de chamados', error)
  const id = (data as { valor: { tipo_projeto_id?: string } } | null)?.valor?.tipo_projeto_id
  if (!id) return null
  const t = await tipoDeProjeto(id)
  return t ? { id: t.id, nome: t.nome } : null
}

/**
 * Abre um chamado.
 *
 * Vai por RPC porque a politica de INSERT de `projeto` exige GERENTE_PROJETOS
 * — e quem precisa de manutencao e justamente quem nao e gerente. A funcao no
 * banco cria o projeto no tipo configurado e na fase inicial dele; a tela nao
 * escolhe nem uma coisa nem outra.
 */
export async function abrirChamado(c: {
  titulo: string
  descricao: string | null
  setor: string | null
  empresa_id: string | null
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('abrir_chamado', {
    p_titulo: c.titulo,
    p_descricao: c.descricao,
    p_setor: c.setor,
    p_empresa: c.empresa_id,
  })
  erroDeEscrita('Nao foi possivel abrir o chamado', error)
  return (data as string | null) ?? null
}

/**
 * As empresas que o formulario publico oferece.
 *
 * Vem por funcao, nao pela tabela: o anonimo recebe id e nome das ativas, e o
 * resto do cadastro — CNPJ, cidade, o que for — continua do lado de dentro.
 */
export async function empresasParaChamado(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.rpc('empresas_para_chamado')
  erro('Nao foi possivel carregar as empresas', error)
  return (data ?? []) as { id: string; nome: string }[]
}

/**
 * Abre chamado sem login, e devolve o codigo.
 *
 * A unica escrita do sistema que acontece sem sessao. Tudo que ela pode fazer
 * esta na funcao do banco: criar projeto na fila configurada, na fase inicial,
 * e guardar quem pediu. Limite de 3 por e-mail por hora e 30 no total.
 */
export async function abrirChamadoPublico(c: {
  nome: string
  email: string
  empresa_id: string
  titulo: string
  descricao: string | null
  setor: string | null
  fone: string | null
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('abrir_chamado_publico', {
    p_nome: c.nome,
    p_email: c.email,
    p_empresa: c.empresa_id,
    p_titulo: c.titulo,
    p_descricao: c.descricao,
    p_setor: c.setor,
    p_fone: c.fone,
  })
  erroDeEscrita('Nao foi possivel abrir o chamado', error)
  return (data as string | null) ?? null
}

/** Quem sou eu, do lado do GestPlan (não do lado do Auth). */
export async function eu(): Promise<Pessoa | null> {
  const { data: sessao } = await supabase.auth.getUser()
  if (!sessao.user) return null
  const { data, error } = await supabase
    .from('pessoa')
    .select('id, nome, email, fone, cargo, setor, vinculo, proprietario, ativo, auth_user_id')
    .eq('auth_user_id', sessao.user.id)
    .maybeSingle()
  erro('Não foi possível identificar o usuário', error)
  return (data as Pessoa) ?? null
}

// -----------------------------------------------------------------------------
// Alocação — quem está em que projeto, e com quanto do seu tempo
// -----------------------------------------------------------------------------
//
// A tabela `alocacao` existia desde a primeira migração e nenhuma tela escrevia
// nela. Era por isso, e só por isso, que o gráfico de capacidade do painel
// vinha vazio: faltava dado, não código.
//
// CUSTO_HORA FICA DE FORA, DE PROPÓSITO. A coluna existe em `alocacao` e em
// `pessoa`, mas a política dessas tabelas é `pode_ver_interno` — quem alcança o
// projeto lê o custo-hora de quem está nele. Enquanto isso não passar por
// `pode_ver_valores`, esta tela não grava nem mostra o campo, e ele fica em
// zero. Dinheiro tem porta própria; esta ainda não é.

export type Alocacao = {
  id: string
  projeto_id: string
  pessoa_id: string
  pessoa_nome: string
  papel: string | null
  percentual_dedicacao: number
  data_inicio: string | null
  data_fim: string | null
  ativo: boolean
  /** Só vem preenchido em `minhasAlocacoes`, que atravessa projetos. */
  projeto_codigo?: string
  projeto_nome?: string
}

const CAMPOS_ALOCACAO =
  'id, projeto_id, pessoa_id, papel, percentual_dedicacao, data_inicio, data_fim, ativo'

/** Achata o `pessoa(nome)` que o PostgREST devolve aninhado. */
function comNome(linha: Record<string, unknown>): Alocacao {
  const pessoa = linha.pessoa as { nome: string } | null
  const { pessoa: _, ...resto } = linha
  return { ...(resto as Omit<Alocacao, 'pessoa_nome'>), pessoa_nome: pessoa?.nome ?? '—' }
}

export async function alocacoesDoProjeto(projetoId: string): Promise<Alocacao[]> {
  const { data, error } = await supabase
    .from('alocacao')
    .select(`${CAMPOS_ALOCACAO}, pessoa(nome)`)
    .eq('projeto_id', projetoId)
    .order('ativo', { ascending: false })
  erro('Não foi possível carregar a equipe do projeto', error)
  return (data ?? []).map((l) => comNome(l as unknown as Record<string, unknown>))
}

/** As alocações de uma pessoa, atravessando os projetos que ela alcança. */
export async function minhasAlocacoes(pessoaId: string): Promise<Alocacao[]> {
  const { data, error } = await supabase
    .from('alocacao')
    .select(`${CAMPOS_ALOCACAO}, pessoa(nome), projeto!inner(codigo, nome, arquivado_em)`)
    .eq('pessoa_id', pessoaId)
    .eq('ativo', true)
    .is('projeto.arquivado_em', null)
  erro('Não foi possível carregar as suas alocações', error)

  return (data ?? []).map((l) => {
    const linha = l as unknown as Record<string, unknown>
    const p = linha.projeto as { codigo: string; nome: string }
    const { projeto: _, ...resto } = linha
    return { ...comNome(resto), projeto_codigo: p.codigo, projeto_nome: p.nome }
  })
}

export type AlocacaoEdicao = {
  projeto_id: string
  pessoa_id: string
  papel: string | null
  percentual_dedicacao: number
  data_inicio: string | null
  data_fim: string | null
}

export async function alocar(a: AlocacaoEdicao): Promise<string> {
  const { data, error } = await supabase.from('alocacao').insert(a).select('id').single()
  erroDeEscrita('Não foi possível alocar', error)
  return (data as { id: string }).id
}

/** Devolve quantas linhas mudaram: zero é a RLS recusando em silêncio. */
export async function atualizarAlocacao(
  id: string,
  dados: Partial<AlocacaoEdicao> & { ativo?: boolean },
): Promise<number> {
  const { data, error } = await supabase.from('alocacao').update(dados).eq('id', id).select('id')
  erroDeEscrita('Não foi possível salvar a alocação', error)
  return (data ?? []).length
}

export async function desalocar(id: string): Promise<number> {
  const { data, error } = await supabase.from('alocacao').delete().eq('id', id).select('id')
  erroDeEscrita('Não foi possível tirar a pessoa do projeto', error)
  return (data ?? []).length
}

// -----------------------------------------------------------------------------
// Meu trabalho — as tarefas de uma pessoa, em todos os projetos
// -----------------------------------------------------------------------------
//
// Não usa `vw_agenda`, e a razão é medida: aquela view exige
// `data_inicio_prev is not null`, porque nasceu para alimentar o calendário e o
// iCal da Fase 2. A maior parte das tarefas importadas do desktop não tem data
// — pela agenda, a tela abriria quase vazia e pareceria quebrada. Aqui a
// pergunta é outra: o que é meu, com data ou sem.

export type MinhaTarefa = Tarefa & {
  projeto_codigo: string
  projeto_nome: string
  projeto_cor: string
}

export async function minhasTarefas(pessoaId: string): Promise<MinhaTarefa[]> {
  const { data, error } = await supabase
    .from('tarefa')
    .select(
      'id, projeto_id, etapa_id, pai_id, codigo, nome, responsavel_id, status, marco,' +
        ' data_inicio_prev, data_fim_prev, data_inicio_real, data_fim_real,' +
        ' percentual_concluido, ordem,' +
        ' projeto!inner(codigo, nome, arquivado_em, tipo_projeto!inner(cor))',
    )
    .eq('responsavel_id', pessoaId)
    .neq('status', 'CANCELADA')
    .is('projeto.arquivado_em', null)
  erro('Não foi possível carregar as suas tarefas', error)

  return (data ?? []).map((l) => {
    const linha = l as unknown as Record<string, unknown>
    const p = linha.projeto as { codigo: string; nome: string; tipo_projeto: { cor: string } }
    const { projeto: _, ...tarefa } = linha
    return {
      ...(tarefa as Tarefa),
      projeto_codigo: p.codigo,
      projeto_nome: p.nome,
      projeto_cor: p.tipo_projeto.cor,
    }
  })
}

// -----------------------------------------------------------------------------
// Notificacao — o sistema procurando a pessoa
// -----------------------------------------------------------------------------
//
// A tela SO LE e marca lida. Quem escreve sao os gatilhos da migracao
// 20260830140000, que rodam como dono da funcao: `notificacao` nao tem policy
// de INSERT, e e assim que tem de ser. Se um dia bater a vontade de "abrir uma
// policy so para o front conseguir escrever", a resposta e nao — seria abrir a
// porta para forjar aviso em nome de outra pessoa.
//
// Nao ha funcao para ler a caixa alheia porque nao existe caixa alheia: a
// politica e `pessoa_id = app.pessoa_atual()`, sem excecao nem para o dono.

export type Notificacao = {
  id: string
  tipo: string
  titulo: string
  corpo: string | null
  projeto_id: string | null
  tarefa_id: string | null
  lida_em: string | null
  criado_em: string
}

const CAMPOS_AVISO = 'id, tipo, titulo, corpo, projeto_id, tarefa_id, lida_em, criado_em'

export async function meusAvisos(limite = 100): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from('notificacao')
    .select(CAMPOS_AVISO)
    .order('criado_em', { ascending: false })
    .limit(limite)
  erro('Nao foi possivel carregar os avisos', error)
  return (data ?? []) as Notificacao[]
}

/** So o numero, para o contador do menu — nao traz as linhas. */
export async function contarAvisosNaoLidos(): Promise<number> {
  const { count, error } = await supabase
    .from('notificacao')
    .select('id', { count: 'exact', head: true })
    .is('lida_em', null)
  erro('Nao foi possivel contar os avisos', error)
  return count ?? 0
}

export async function marcarAvisoLido(id: string): Promise<void> {
  const { error } = await supabase
    .from('notificacao')
    .update({ lida_em: new Date().toISOString() })
    .eq('id', id)
  erroDeEscrita('Nao foi possivel marcar o aviso como lido', error)
}

export async function marcarTodosLidos(): Promise<void> {
  const { error } = await supabase
    .from('notificacao')
    .update({ lida_em: new Date().toISOString() })
    .is('lida_em', null)
  erroDeEscrita('Nao foi possivel marcar os avisos como lidos', error)
}

/** Limpa o que ja foi lido. O nao lido fica: ninguem apaga o que nao viu. */
export async function limparAvisosLidos(): Promise<number> {
  const { data, error } = await supabase
    .from('notificacao')
    .delete()
    .not('lida_em', 'is', null)
    .select('id')
  erroDeEscrita('Nao foi possivel limpar os avisos', error)
  return (data ?? []).length
}

/**
 * As pessoas que foram POSTAS num projeto: gerente, solicitante e alocados.
 *
 * Espelha `app.é_parte()`, e existe porque a tela precisa oferecer as MESMAS
 * pessoas que o banco aceita. Desde a migracao 20260830160000, marcar como
 * responsavel quem nao esta no projeto e recusado por trigger, e mencionar
 * essa pessoa mandaria um aviso apontando para uma tela que a RLS nega.
 *
 * Nao e a regra reescrita em TypeScript: e a lista de escolha. Quem decide
 * continua sendo o banco — se a tela errar, a escrita e recusada.
 */
export async function pessoasDoProjeto(projetoId: string): Promise<Pessoa[]> {
  const [{ data: p, error: e1 }, alocacoes] = await Promise.all([
    supabase.from('projeto').select('gerente_id, solicitante_id').eq('id', projetoId).maybeSingle(),
    alocacoesDoProjeto(projetoId),
  ])
  erro('Nao foi possivel carregar a equipe do projeto', e1)

  const dono = p as { gerente_id: string | null; solicitante_id: string | null } | null
  const ids = new Set<string>()
  if (dono?.gerente_id) ids.add(dono.gerente_id)
  if (dono?.solicitante_id) ids.add(dono.solicitante_id)
  for (const a of alocacoes) if (a.ativo) ids.add(a.pessoa_id)
  if (ids.size === 0) return []

  const { data, error } = await supabase
    .from('pessoa')
    .select('id, nome, email, fone, cargo, setor, vinculo, proprietario, ativo, auth_user_id')
    .in('id', [...ids])
    .order('nome')
  erro('Nao foi possivel carregar a equipe do projeto', error)
  return (data ?? []) as Pessoa[]
}

// -----------------------------------------------------------------------------
// Afazer — a lista pessoal
// -----------------------------------------------------------------------------
//
// NAO e tarefa de projeto: nao entra em cronograma nem em avanco. E privada de
// quem escreveu, inclusive do proprietario — a politica e
// `pessoa_id = app.pessoa_atual()`, sem excecao, como a de `notificacao`.
//
// Por isso nao existe funcao para ler a lista de outra pessoa. Nao e omissao:
// nao ha o que ler.

export const PRIORIDADES_AFAZER = ['ALTA', 'NORMAL', 'BAIXA'] as const

export type Afazer = {
  id: string
  titulo: string
  detalhe: string | null
  projeto_id: string | null
  empresa_id: string | null
  secao_id: string | null
  prazo: string | null
  prioridade: string
  feito_em: string | null
  ordem: number
  criado_em: string
  /** Preenchido pela consulta, do embed — a tabela nao guarda. */
  projeto_codigo?: string | null
}

const CAMPOS_AFAZER =
  'id, titulo, detalhe, projeto_id, empresa_id, secao_id, prazo, prioridade,' +
  ' feito_em, ordem, criado_em'

export async function meusAfazeres(): Promise<Afazer[]> {
  const { data, error } = await supabase
    .from('afazer')
    .select(`${CAMPOS_AFAZER}, projeto(codigo)`)
    .order('ordem')
    .order('criado_em')
  erro('Nao foi possivel carregar os seus afazeres', error)

  // A EMPRESA NAO VEM POR EMBED, so o `empresa_id`. A tela ja carrega a lista
  // de empresas para o seletor, entao o nome sai de la — uma juncao a menos, e
  // uma dependencia a menos do cache de schema do PostgREST, que precisa
  // conhecer a chave estrangeira para aceitar `empresa(nome)`.
  return (data ?? []).map((l) => {
    const linha = l as unknown as Record<string, unknown>
    const p = linha.projeto as { codigo: string } | null
    const { projeto: _p, ...resto } = linha
    return { ...(resto as Afazer), projeto_codigo: p?.codigo ?? null }
  })
}

export type AfazerEdicao = {
  titulo: string
  detalhe?: string | null
  projeto_id?: string | null
  empresa_id?: string | null
  secao_id?: string | null
  prazo?: string | null
  prioridade?: string
  ordem?: number
}

/**
 * Cria na PROPRIA lista.
 *
 * `pessoa_id` nao e parametro de proposito: quem decide de quem e o item e o
 * banco, pelo `with check` da politica. Se a tela pudesse escolher, um dia
 * escolheria errado.
 */
export async function criarAfazer(a: AfazerEdicao, pessoaId: string): Promise<string> {
  const { data, error } = await supabase
    .from('afazer')
    .insert({ ...a, pessoa_id: pessoaId })
    .select('id')
    .single()
  erroDeEscrita('Nao foi possivel criar o afazer', error)
  return (data as { id: string }).id
}

export async function atualizarAfazer(
  id: string,
  dados: Partial<AfazerEdicao> & { feito_em?: string | null },
): Promise<number> {
  const { data, error } = await supabase.from('afazer').update(dados).eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel salvar o afazer', error)
  return (data ?? []).length
}

export async function excluirAfazer(id: string): Promise<number> {
  const { data, error } = await supabase.from('afazer').delete().eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel apagar o afazer', error)
  return (data ?? []).length
}

/** So o que a escolha de projeto precisa: sem valor, sem pontuacao, sem fase. */
export async function projetosParaEscolha(): Promise<
  { id: string; codigo: string; nome: string }[]
> {
  const { data, error } = await supabase
    .from('vw_projeto')
    .select('id, codigo, nome')
    .eq('ativo', true)
    .order('codigo', { ascending: false })
  erro('Nao foi possivel carregar os projetos', error)
  return (data ?? []) as { id: string; codigo: string; nome: string }[]
}

// -----------------------------------------------------------------------------
// Secoes do quadro de afazeres
// -----------------------------------------------------------------------------
//
// As colunas de cada lista. Existem MESMO VAZIAS — e o que separa um quadro de
// um agrupamento por texto: "Qualidade 0" e informacao, diz que ninguem anotou
// nada ali ainda.
//
// Sao de cada pessoa e de cada lista: a minha Cimentpav nao precisa ter as
// mesmas divisoes da sua. Privadas como o resto da lista.

export type AfazerSecao = {
  id: string
  empresa_id: string | null
  nome: string
  ordem: number
}

/** As colunas de uma lista. `empresaId` nulo e a lista "Pessoal". */
export async function secoesDaLista(empresaId: string | null): Promise<AfazerSecao[]> {
  let q = supabase.from('afazer_secao').select('id, empresa_id, nome, ordem').order('ordem')
  q = empresaId === null ? q.is('empresa_id', null) : q.eq('empresa_id', empresaId)
  const { data, error } = await q
  erro('Nao foi possivel carregar as secoes', error)
  return (data ?? []) as AfazerSecao[]
}

export async function criarSecao(
  pessoaId: string, empresaId: string | null, nome: string, ordem: number,
): Promise<string> {
  const { data, error } = await supabase
    .from('afazer_secao')
    .insert({ pessoa_id: pessoaId, empresa_id: empresaId, nome: nome.trim(), ordem })
    .select('id')
    .single()
  erroDeEscrita('Nao foi possivel criar a secao', error)
  return (data as { id: string }).id
}

export async function renomearSecao(id: string, nome: string): Promise<number> {
  const { data, error } = await supabase
    .from('afazer_secao').update({ nome: nome.trim() }).eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel renomear a secao', error)
  return (data ?? []).length
}

export async function reordenarSecoes(linhas: { id: string; ordem: number }[]): Promise<void> {
  for (const l of linhas) {
    const { error } = await supabase
      .from('afazer_secao').update({ ordem: l.ordem }).eq('id', l.id)
    erroDeEscrita('Nao foi possivel reordenar as secoes', error)
  }
}

/**
 * Apaga a coluna. O que estava dentro NAO some: `secao_id` e `on delete set
 * null`, entao os itens voltam para a faixa sem coluna. Some a gaveta, nao o
 * que estava guardado.
 */
export async function excluirSecao(id: string): Promise<number> {
  const { data, error } = await supabase
    .from('afazer_secao').delete().eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel apagar a secao', error)
  return (data ?? []).length
}

// -----------------------------------------------------------------------------
// Historico do projeto: ocorrencia e decisao
// -----------------------------------------------------------------------------
//
// Sao DUAS COISAS SEPARADAS porque respondem perguntas diferentes.
//
// OCORRENCIA: o que aconteceu e o que se faz a respeito. Tem gravidade,
// probabilidade e SITUACAO — nasce aberta e precisa ser fechada. Serve para
// cobrar.
//
// DECISAO: o que ficou combinado, e por que. Nao tem situacao: decisao nao
// fica pendente, ela e tomada. O que ela tem e a ocorrencia nao e o que foi
// DESCARTADO — e e isso que ninguem lembra seis meses depois.

export const TIPOS_OCORRENCIA = ['NOTA', 'RISCO', 'PROBLEMA', 'REUNIAO', 'PARALISACAO'] as const
export const SITUACOES_OCORRENCIA = ['ABERTA', 'EM_TRATATIVA', 'RESOLVIDA', 'ACEITA'] as const
export const GRAUS = ['BAIXO', 'MEDIO', 'ALTO'] as const
export const PROBABILIDADES = ['BAIXA', 'MEDIA', 'ALTA'] as const

export type Ocorrencia = {
  id: string
  projeto_id: string
  data: string
  tipo: string
  titulo: string
  descricao: string | null
  impacto: string | null
  probabilidade: string | null
  responsavel_id: string | null
  status: string
  resolvido_em: string | null
  criado_em: string
}

const CAMPOS_OCORRENCIA =
  'id, projeto_id, data, tipo, titulo, descricao, impacto, probabilidade,' +
  ' responsavel_id, status, resolvido_em, criado_em'

export async function ocorrenciasDoProjeto(projetoId: string): Promise<Ocorrencia[]> {
  const { data, error } = await supabase
    .from('ocorrencia')
    .select(CAMPOS_OCORRENCIA)
    .eq('projeto_id', projetoId)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })
  erro('Nao foi possivel carregar as ocorrencias', error)
  return (data ?? []) as unknown as Ocorrencia[]
}

export type OcorrenciaEdicao = {
  projeto_id?: string
  data?: string
  tipo?: string
  titulo?: string
  descricao?: string | null
  impacto?: string | null
  probabilidade?: string | null
  responsavel_id?: string | null
  status?: string
  resolvido_em?: string | null
}

export async function criarOcorrencia(o: OcorrenciaEdicao): Promise<string> {
  const { data, error } = await supabase.from('ocorrencia').insert(o).select('id').single()
  erroDeEscrita('Nao foi possivel registrar a ocorrencia', error)
  return (data as { id: string }).id
}

export async function atualizarOcorrencia(
  id: string, dados: OcorrenciaEdicao,
): Promise<number> {
  const { data, error } = await supabase
    .from('ocorrencia').update(dados).eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel salvar a ocorrencia', error)
  return (data ?? []).length
}

export async function excluirOcorrencia(id: string): Promise<number> {
  const { data, error } = await supabase
    .from('ocorrencia').delete().eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel apagar a ocorrencia', error)
  return (data ?? []).length
}

// --- decisao ---------------------------------------------------------------

export type Decisao = {
  id: string
  projeto_id: string
  decidido_em: string
  titulo: string
  contexto: string | null
  decisao: string
  alternativas: string | null
  decidido_por: string | null
  quem_avulso: string | null
  criado_em: string
}

const CAMPOS_DECISAO =
  'id, projeto_id, decidido_em, titulo, contexto, decisao, alternativas,' +
  ' decidido_por, quem_avulso, criado_em'

export async function decisoesDoProjeto(projetoId: string): Promise<Decisao[]> {
  const { data, error } = await supabase
    .from('decisao')
    .select(CAMPOS_DECISAO)
    .eq('projeto_id', projetoId)
    .order('decidido_em', { ascending: false })
    .order('criado_em', { ascending: false })
  erro('Nao foi possivel carregar as decisoes', error)
  return (data ?? []) as unknown as Decisao[]
}

export type DecisaoEdicao = {
  projeto_id?: string
  decidido_em?: string
  titulo?: string
  contexto?: string | null
  decisao?: string
  alternativas?: string | null
  decidido_por?: string | null
  quem_avulso?: string | null
}

export async function criarDecisao(d: DecisaoEdicao): Promise<string> {
  const { data, error } = await supabase.from('decisao').insert(d).select('id').single()
  erroDeEscrita('Nao foi possivel registrar a decisao', error)
  return (data as { id: string }).id
}

export async function atualizarDecisao(id: string, dados: DecisaoEdicao): Promise<number> {
  const { data, error } = await supabase
    .from('decisao').update(dados).eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel salvar a decisao', error)
  return (data ?? []).length
}

export async function excluirDecisao(id: string): Promise<number> {
  const { data, error } = await supabase.from('decisao').delete().eq('id', id).select('id')
  erroDeEscrita('Nao foi possivel apagar a decisao', error)
  return (data ?? []).length
}

// -----------------------------------------------------------------------------
// A trilha de fases
// -----------------------------------------------------------------------------
//
// `projeto_fase_hist` era escrita desde a primeira migracao e nunca foi lida
// por tela nenhuma. A view acrescenta o que a tabela nao tem: quanto tempo o
// projeto ficou em cada fase — a tabela guarda instantes, e a pergunta que se
// faz e duracao.

export type PassoDeFase = {
  id: string
  em: string
  de_fase: string | null
  para_fase: string
  para_cor: string
  para_categoria: string
  motivo: string | null
  observacao: string | null
  pessoa_nome: string | null
  dias_na_anterior: number | null
}

export async function trilhaDeFases(projetoId: string): Promise<PassoDeFase[]> {
  const { data, error } = await supabase
    .from('vw_fase_hist')
    .select('id, em, de_fase, para_fase, para_cor, para_categoria, motivo, observacao, pessoa_nome, dias_na_anterior')
    .eq('projeto_id', projetoId)
    .order('em')
  erro('Nao foi possivel carregar o historico de fases', error)
  return (data ?? []) as unknown as PassoDeFase[]
}
