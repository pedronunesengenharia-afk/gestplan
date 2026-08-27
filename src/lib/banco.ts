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
  exige_setores: string[]
}

function erro(contexto: string, e: { message: string } | null): never | void {
  if (e) throw new Error(`${contexto}: ${e.message}`)
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
    .select('id, tipo_projeto_id, codigo, nome, ordem, categoria, cor, exige_setores')
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

/** Uma linha de vw_pontuacao: o critério, a nota dada e quanto ela pesa. */
export type LinhaPontuacao = {
  projeto_id: string
  criterio: string
  criterio_nome: string
  nota: number
  maximo: number
  peso: number
  pontos: number
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
    .select('id, tipo_projeto_id, grupo, codigo, rotulo, ajuda, tipo_dado, opcoes, exigido_para_sair_de, ordem, ativo')
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
  erro('Não foi possível carregar a pontuação', error)
  return (data ?? []) as LinhaPontuacao[]
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
