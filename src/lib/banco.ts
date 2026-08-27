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
