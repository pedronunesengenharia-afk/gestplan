export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alocacao: {
        Row: {
          ativo: boolean
          criado_em: string
          custo_hora: number
          data_fim: string | null
          data_inicio: string | null
          id: string
          papel: string | null
          percentual_dedicacao: number
          pessoa_id: string
          projeto_id: string
          tarefa_id: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          custo_hora?: number
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          papel?: string | null
          percentual_dedicacao?: number
          pessoa_id: string
          projeto_id: string
          tarefa_id?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          custo_hora?: number
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          papel?: string | null
          percentual_dedicacao?: number
          pessoa_id?: string
          projeto_id?: string
          tarefa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alocacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacao_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacao_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "alocacao_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      anexo: {
        Row: {
          autor: string | null
          bytes: number | null
          contrato_id: string | null
          criado_em: string
          criado_por: string | null
          data_documento: string | null
          etapa_id: string | null
          id: string
          medicao_id: string | null
          mime: string | null
          observacao: string | null
          ordem: number
          projeto_id: string
          secao: string | null
          storage_path: string
          tarefa_id: string | null
          tipo: string
          titulo: string
          versao: string | null
        }
        Insert: {
          autor?: string | null
          bytes?: number | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_documento?: string | null
          etapa_id?: string | null
          id?: string
          medicao_id?: string | null
          mime?: string | null
          observacao?: string | null
          ordem?: number
          projeto_id: string
          secao?: string | null
          storage_path: string
          tarefa_id?: string | null
          tipo?: string
          titulo: string
          versao?: string | null
        }
        Update: {
          autor?: string | null
          bytes?: number | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_documento?: string | null
          etapa_id?: string | null
          id?: string
          medicao_id?: string | null
          mime?: string | null
          observacao?: string | null
          ordem?: number
          projeto_id?: string
          secao?: string | null
          storage_path?: string
          tarefa_id?: string | null
          tipo?: string
          titulo?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anexo_contrato_fk"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_medicao_fk"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexo_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "anexo_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      apontamento_hora: {
        Row: {
          criado_em: string
          criado_por: string | null
          custo_hora: number
          data: string
          descricao: string | null
          etapa_id: string | null
          horas: number
          id: string
          pessoa_id: string
          projeto_id: string
          tarefa_id: string | null
          valor: number | null
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          custo_hora?: number
          data?: string
          descricao?: string | null
          etapa_id?: string | null
          horas: number
          id?: string
          pessoa_id: string
          projeto_id: string
          tarefa_id?: string | null
          valor?: number | null
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          custo_hora?: number
          data?: string
          descricao?: string | null
          etapa_id?: string | null
          horas?: number
          id?: string
          pessoa_id?: string
          projeto_id?: string
          tarefa_id?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apontamento_hora_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamento_hora_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamento_hora_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamento_hora_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamento_hora_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamento_hora_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamento_hora_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamento_hora_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamento_hora_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "apontamento_hora_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      aprovacao: {
        Row: {
          decisao: string
          em: string
          fase_id: string
          id: string
          nome_avulso: string | null
          parecer: string | null
          pessoa_id: string | null
          postergado_para: string | null
          projeto_id: string
          setor_codigo: string
        }
        Insert: {
          decisao: string
          em?: string
          fase_id: string
          id?: string
          nome_avulso?: string | null
          parecer?: string | null
          pessoa_id?: string | null
          postergado_para?: string | null
          projeto_id: string
          setor_codigo: string
        }
        Update: {
          decisao?: string
          em?: string
          fase_id?: string
          id?: string
          nome_avulso?: string | null
          parecer?: string | null
          pessoa_id?: string | null
          postergado_para?: string | null
          projeto_id?: string
          setor_codigo?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprovacao_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacao_setor_codigo_fkey"
            columns: ["setor_codigo"]
            isOneToOne: false
            referencedRelation: "setor"
            referencedColumns: ["codigo"]
          },
        ]
      }
      calendario: {
        Row: {
          atualizado_em: string
          criado_em: string
          dias_uteis: boolean[]
          empresa_id: string | null
          horas_dia: number
          id: string
          nome: string
          padrao: boolean
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dias_uteis?: boolean[]
          empresa_id?: string | null
          horas_dia?: number
          id?: string
          nome: string
          padrao?: boolean
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dias_uteis?: boolean[]
          empresa_id?: string | null
          horas_dia?: number
          id?: string
          nome?: string
          padrao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calendario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      calendario_excecao: {
        Row: {
          calendario_id: string
          data: string
          descricao: string
          id: string
          tipo: string
        }
        Insert: {
          calendario_id: string
          data: string
          descricao: string
          id?: string
          tipo?: string
        }
        Update: {
          calendario_id?: string
          data?: string
          descricao?: string
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendario_excecao_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "calendario"
            referencedColumns: ["id"]
          },
        ]
      }
      campo_definicao: {
        Row: {
          ajuda: string | null
          ativo: boolean
          codigo: string
          exigido_para_sair_de: string | null
          grupo: string
          id: string
          maximo: number | null
          minimo: number | null
          opcoes: Json
          ordem: number
          papeis_leitura: string[]
          rotulo: string
          tipo_dado: string
          tipo_projeto_id: string
          valor_padrao: Json | null
        }
        Insert: {
          ajuda?: string | null
          ativo?: boolean
          codigo: string
          exigido_para_sair_de?: string | null
          grupo?: string
          id?: string
          maximo?: number | null
          minimo?: number | null
          opcoes?: Json
          ordem?: number
          papeis_leitura?: string[]
          rotulo: string
          tipo_dado: string
          tipo_projeto_id: string
          valor_padrao?: Json | null
        }
        Update: {
          ajuda?: string | null
          ativo?: boolean
          codigo?: string
          exigido_para_sair_de?: string | null
          grupo?: string
          id?: string
          maximo?: number | null
          minimo?: number | null
          opcoes?: Json
          ordem?: number
          papeis_leitura?: string[]
          rotulo?: string
          tipo_dado?: string
          tipo_projeto_id?: string
          valor_padrao?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campo_definicao_exigido_para_sair_de_fkey"
            columns: ["exigido_para_sair_de"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campo_definicao_tipo_projeto_id_fkey"
            columns: ["tipo_projeto_id"]
            isOneToOne: false
            referencedRelation: "tipo_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria_custo: {
        Row: {
          ativo: boolean
          codigo: string
          id: string
          nome: string
          ordem: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id?: string
          nome: string
          ordem?: number
          tipo: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
        }
        Relationships: []
      }
      comentario: {
        Row: {
          criado_em: string
          editado_em: string | null
          etapa_id: string | null
          id: string
          mencionados: string[]
          pessoa_id: string
          projeto_id: string
          responde_id: string | null
          tarefa_id: string | null
          texto: string
        }
        Insert: {
          criado_em?: string
          editado_em?: string | null
          etapa_id?: string | null
          id?: string
          mencionados?: string[]
          pessoa_id: string
          projeto_id: string
          responde_id?: string | null
          tarefa_id?: string | null
          texto: string
        }
        Update: {
          criado_em?: string
          editado_em?: string | null
          etapa_id?: string | null
          id?: string
          mencionados?: string[]
          pessoa_id?: string
          projeto_id?: string
          responde_id?: string | null
          tarefa_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentario_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_responde_id_fkey"
            columns: ["responde_id"]
            isOneToOne: false
            referencedRelation: "comentario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentario_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "comentario_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao: {
        Row: {
          atualizado_em: string
          chave: string
          descricao: string | null
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          descricao?: string | null
          valor: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          descricao?: string | null
          valor?: Json
        }
        Relationships: []
      }
      contrato: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          categoria_id: string | null
          criado_em: string
          criado_por: string | null
          data_assinatura: string | null
          data_fim: string | null
          data_inicio: string | null
          forma_pagamento: string | null
          fornecedor_id: string
          garantia_meses: number | null
          id: string
          numero: string
          objeto: string
          observacao: string | null
          projeto_id: string
          status: string
          valor: number
          valor_aditivos: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_assinatura?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          forma_pagamento?: string | null
          fornecedor_id: string
          garantia_meses?: number | null
          id?: string
          numero: string
          objeto: string
          observacao?: string | null
          projeto_id: string
          status?: string
          valor?: number
          valor_aditivos?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_assinatura?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string
          garantia_meses?: number | null
          id?: string
          numero?: string
          objeto?: string
          observacao?: string | null
          projeto_id?: string
          status?: string
          valor?: number
          valor_aditivos?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_aditivo: {
        Row: {
          contrato_id: string
          criado_em: string
          criado_por: string | null
          data: string
          dias_prazo: number
          id: string
          justificativa: string | null
          numero: string
          tipo: string
          valor: number
        }
        Insert: {
          contrato_id: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          dias_prazo?: number
          id?: string
          justificativa?: string | null
          numero: string
          tipo: string
          valor?: number
        }
        Update: {
          contrato_id?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          dias_prazo?: number
          id?: string
          justificativa?: string | null
          numero?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_aditivo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_aditivo_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      convite: {
        Row: {
          aceito_em: string | null
          criado_em: string
          criado_por: string | null
          email: string
          empresa_id: string
          expira_em: string
          id: string
          papel: string
          pessoa_id: string | null
          token: string
        }
        Insert: {
          aceito_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email: string
          empresa_id: string
          expira_em?: string
          id?: string
          papel: string
          pessoa_id?: string | null
          token?: string
        }
        Update: {
          aceito_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string
          empresa_id?: string
          expira_em?: string
          id?: string
          papel?: string
          pessoa_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "convite_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convite_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convite_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      custo: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          categoria_id: string
          competencia: string | null
          contrato_id: string | null
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string
          documento: string | null
          etapa_id: string | null
          fornecedor_id: string | null
          id: string
          observacao: string | null
          origem: string
          pago_em: string | null
          parcela_id: string | null
          preco_unitario: number
          projeto_id: string
          quantidade: number
          status_pagamento: string
          unidade: string | null
          valor: number
          vencimento: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id: string
          competencia?: string | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao: string
          documento?: string | null
          etapa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          pago_em?: string | null
          parcela_id?: string | null
          preco_unitario?: number
          projeto_id: string
          quantidade?: number
          status_pagamento?: string
          unidade?: string | null
          valor: number
          vencimento?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id?: string
          competencia?: string | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string
          documento?: string | null
          etapa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string
          pago_em?: string | null
          parcela_id?: string | null
          preco_unitario?: number
          projeto_id?: string
          quantidade?: number
          status_pagamento?: string
          unidade?: string | null
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custo_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcela"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          cidade: string | null
          cnpj: string | null
          criado_em: string
          criado_por: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          observacao: string | null
          papel_id: string | null
          prefixo: string
          razao_social: string | null
          uf: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cidade?: string | null
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          observacao?: string | null
          papel_id?: string | null
          prefixo: string
          razao_social?: string | null
          uf?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cidade?: string | null
          cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          observacao?: string | null
          papel_id?: string | null
          prefixo?: string
          razao_social?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_atualizado_por_fk"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_criado_por_fk"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_papel_id_fkey"
            columns: ["papel_id"]
            isOneToOne: false
            referencedRelation: "empresa_papel"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_papel: {
        Row: {
          ativo: boolean
          codigo: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      etapa: {
        Row: {
          a_confirmar: boolean
          atualizado_em: string
          atualizado_por: string | null
          categoria_id: string | null
          codigo: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          folha: boolean
          fornecedor_id: string | null
          id: string
          nivel: number
          nome: string
          ordem: number
          pai_id: string | null
          percentual_concluido: number
          peso_percentual: number
          preco_unitario: number
          projeto_id: string
          quantidade: number
          unidade: string | null
          valor: number | null
        }
        Insert: {
          a_confirmar?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id?: string | null
          codigo: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          folha?: boolean
          fornecedor_id?: string | null
          id?: string
          nivel?: number
          nome: string
          ordem?: number
          pai_id?: string | null
          percentual_concluido?: number
          peso_percentual?: number
          preco_unitario?: number
          projeto_id: string
          quantidade?: number
          unidade?: string | null
          valor?: number | null
        }
        Update: {
          a_confirmar?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria_id?: string | null
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          folha?: boolean
          fornecedor_id?: string | null
          id?: string
          nivel?: number
          nome?: string
          ordem?: number
          pai_id?: string | null
          percentual_concluido?: number
          peso_percentual?: number
          preco_unitario?: number
          projeto_id?: string
          quantidade?: number
          unidade?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "etapa_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_categoria_fk"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_fornecedor_fk"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      evento: {
        Row: {
          acao: string
          antes: Json | null
          campos: string[] | null
          depois: Json | null
          em: string
          id: number
          pessoa_id: string | null
          registro_id: string
          tabela: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          campos?: string[] | null
          depois?: Json | null
          em?: string
          id?: never
          pessoa_id?: string | null
          registro_id: string
          tabela: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          campos?: string[] | null
          depois?: Json | null
          em?: string
          id?: never
          pessoa_id?: string | null
          registro_id?: string
          tabela?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_pessoa_fk"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedor: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          cidade: string | null
          cnpj_cpf: string | null
          contato_email: string | null
          contato_fone: string | null
          contato_nome: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          observacao: string | null
          razao_social: string | null
          tipo: string | null
          uf: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          contato_email?: string | null
          contato_fone?: string | null
          contato_nome?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          observacao?: string | null
          razao_social?: string | null
          tipo?: string | null
          uf?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          contato_email?: string | null
          contato_fone?: string | null
          contato_nome?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          razao_social?: string | null
          tipo?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedor_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      ideia: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          autor_id: string | null
          autor_nome: string | null
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string | null
          empresa_id: string | null
          id: string
          local: string | null
          motivo: string | null
          projeto_id: string | null
          situacao: string
          tipo_projeto_id: string | null
          titulo: string
          valor_estimado: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          local?: string | null
          motivo?: string | null
          projeto_id?: string | null
          situacao?: string
          tipo_projeto_id?: string | null
          titulo: string
          valor_estimado?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          autor_id?: string | null
          autor_nome?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          local?: string | null
          motivo?: string | null
          projeto_id?: string | null
          situacao?: string
          tipo_projeto_id?: string | null
          titulo?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ideia_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideia_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideia_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideia_tipo_projeto_id_fkey"
            columns: ["tipo_projeto_id"]
            isOneToOne: false
            referencedRelation: "tipo_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      linha_base: {
        Row: {
          criado_em: string
          criado_por: string | null
          data_aprovacao: string
          descricao: string | null
          id: string
          projeto_id: string
          versao: number
          vigente: boolean
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          data_aprovacao?: string
          descricao?: string | null
          id?: string
          projeto_id: string
          versao: number
          vigente?: boolean
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          data_aprovacao?: string
          descricao?: string | null
          id?: string
          projeto_id?: string
          versao?: number
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "linha_base_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linha_base_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linha_base_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linha_base_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linha_base_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      linha_base_item: {
        Row: {
          competencia: string | null
          data_fim: string | null
          data_inicio: string | null
          etapa_id: string | null
          id: string
          linha_base_id: string
          percentual_previsto: number
          tarefa_id: string | null
          valor_previsto: number
        }
        Insert: {
          competencia?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          etapa_id?: string | null
          id?: string
          linha_base_id: string
          percentual_previsto?: number
          tarefa_id?: string | null
          valor_previsto?: number
        }
        Update: {
          competencia?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          etapa_id?: string | null
          id?: string
          linha_base_id?: string
          percentual_previsto?: number
          tarefa_id?: string | null
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "linha_base_item_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linha_base_item_linha_base_id_fkey"
            columns: ["linha_base_id"]
            isOneToOne: false
            referencedRelation: "linha_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linha_base_item_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linha_base_item_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "linha_base_item_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      medicao: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          competencia: string
          contrato_id: string | null
          criado_em: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          data_medicao: string
          id: string
          numero: number
          observacao: string | null
          projeto_id: string
          status: string
          valor_bruto: number
          valor_liquido: number | null
          valor_retencao: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          competencia: string
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_medicao?: string
          id?: string
          numero: number
          observacao?: string | null
          projeto_id: string
          status?: string
          valor_bruto?: number
          valor_liquido?: number | null
          valor_retencao?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          competencia?: string
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_medicao?: string
          id?: string
          numero?: number
          observacao?: string | null
          projeto_id?: string
          status?: string
          valor_bruto?: number
          valor_liquido?: number | null
          valor_retencao?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicao_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      medicao_item: {
        Row: {
          etapa_id: string
          id: string
          medicao_id: string
          observacao: string | null
          percentual: number
          quantidade: number
          valor: number
        }
        Insert: {
          etapa_id: string
          id?: string
          medicao_id: string
          observacao?: string | null
          percentual?: number
          quantidade?: number
          valor?: number
        }
        Update: {
          etapa_id?: string
          id?: string
          medicao_id?: string
          observacao?: string | null
          percentual?: number
          quantidade?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicao_item_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_item_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicao"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao: {
        Row: {
          corpo: string | null
          criado_em: string
          id: string
          lida_em: string | null
          link: string | null
          pessoa_id: string
          projeto_id: string | null
          tarefa_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          corpo?: string | null
          criado_em?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          pessoa_id: string
          projeto_id?: string | null
          tarefa_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          corpo?: string | null
          criado_em?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          pessoa_id?: string
          projeto_id?: string | null
          tarefa_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "notificacao_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencia: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string | null
          id: string
          impacto: string | null
          probabilidade: string | null
          projeto_id: string
          resolvido_em: string | null
          responsavel_id: string | null
          status: string
          tarefa_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          impacto?: string | null
          probabilidade?: string | null
          projeto_id: string
          resolvido_em?: string | null
          responsavel_id?: string | null
          status?: string
          tarefa_id?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          id?: string
          impacto?: string | null
          probabilidade?: string | null
          projeto_id?: string
          resolvido_em?: string | null
          responsavel_id?: string | null
          status?: string
          tarefa_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencia_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencia_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "ocorrencia_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      parcela: {
        Row: {
          competencia: string | null
          contrato_id: string | null
          criado_em: string
          criado_por: string | null
          descricao: string | null
          descricao_evento: string | null
          etapa_id: string | null
          evento: string | null
          id: string
          numero: number
          pago_em: string | null
          percentual: number | null
          prazo_dias: number | null
          projeto_id: string
          valor: number | null
          valor_pago: number | null
          vencimento: string | null
        }
        Insert: {
          competencia?: string | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          descricao_evento?: string | null
          etapa_id?: string | null
          evento?: string | null
          id?: string
          numero: number
          pago_em?: string | null
          percentual?: number | null
          prazo_dias?: number | null
          projeto_id: string
          valor?: number | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Update: {
          competencia?: string | null
          contrato_id?: string | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          descricao_evento?: string | null
          etapa_id?: string | null
          evento?: string | null
          id?: string
          numero?: number
          pago_em?: string | null
          percentual?: number | null
          prazo_dias?: number | null
          projeto_id?: string
          valor?: number | null
          valor_pago?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcela_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          auth_user_id: string | null
          avatar_url: string | null
          cargo: string | null
          criado_em: string
          criado_por: string | null
          custo_hora: number
          email: string | null
          fone: string | null
          fornecedor_id: string | null
          id: string
          nome: string
          proprietario: boolean
          setor: string | null
          vinculo: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          cargo?: string | null
          criado_em?: string
          criado_por?: string | null
          custo_hora?: number
          email?: string | null
          fone?: string | null
          fornecedor_id?: string | null
          id?: string
          nome: string
          proprietario?: boolean
          setor?: string | null
          vinculo?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          cargo?: string | null
          criado_em?: string
          criado_por?: string | null
          custo_hora?: number
          email?: string | null
          fone?: string | null
          fornecedor_id?: string | null
          id?: string
          nome?: string
          proprietario?: boolean
          setor?: string | null
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_atualizado_por_fk"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_criado_por_fk"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_fornecedor_fk"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedor"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_papel: {
        Row: {
          criado_em: string
          criado_por: string | null
          empresa_id: string
          id: string
          papel: string
          pessoa_id: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          empresa_id: string
          id?: string
          papel: string
          pessoa_id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          empresa_id?: string
          id?: string
          papel?: string
          pessoa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_papel_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_papel_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_papel_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      pontuacao_criterio: {
        Row: {
          ativo: boolean
          codigo: string
          descricao: string | null
          id: string
          maximo: number
          minimo: number
          nome: string
          ordem: number
          peso: number
          tipo_projeto_id: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          descricao?: string | null
          id?: string
          maximo?: number
          minimo?: number
          nome: string
          ordem?: number
          peso?: number
          tipo_projeto_id?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          descricao?: string | null
          id?: string
          maximo?: number
          minimo?: number
          nome?: string
          ordem?: number
          peso?: number
          tipo_projeto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_criterio_tipo_projeto_id_fkey"
            columns: ["tipo_projeto_id"]
            isOneToOne: false
            referencedRelation: "tipo_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto: {
        Row: {
          ano: number
          arquivado_em: string | null
          atualizado_em: string
          atualizado_por: string | null
          beneficios: string | null
          campos: Json
          cidade: string | null
          codigo: string
          criado_em: string
          criado_por: string | null
          data_fase: string
          data_fim_prev: string | null
          data_fim_real: string | null
          data_inicio_prev: string | null
          data_inicio_real: string | null
          data_solicitacao: string | null
          descricao: string | null
          empresa_id: string
          fase_id: string
          frente: string | null
          gerente_id: string | null
          id: string
          local: string | null
          motivo_arquivo: string | null
          nome: string
          numero: number
          objetivo: string | null
          observacao: string | null
          origem_legado: string | null
          pontuacao_total: number
          prioridade: string
          problema: string | null
          projeto_pai_id: string | null
          retorno_em: string | null
          saude: string | null
          seguranca: boolean
          setor: string | null
          solicitante_id: string | null
          tipo_projeto_id: string
          uf: string | null
        }
        Insert: {
          ano: number
          arquivado_em?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          beneficios?: string | null
          campos?: Json
          cidade?: string | null
          codigo: string
          criado_em?: string
          criado_por?: string | null
          data_fase?: string
          data_fim_prev?: string | null
          data_fim_real?: string | null
          data_inicio_prev?: string | null
          data_inicio_real?: string | null
          data_solicitacao?: string | null
          descricao?: string | null
          empresa_id: string
          fase_id: string
          frente?: string | null
          gerente_id?: string | null
          id?: string
          local?: string | null
          motivo_arquivo?: string | null
          nome: string
          numero: number
          objetivo?: string | null
          observacao?: string | null
          origem_legado?: string | null
          pontuacao_total?: number
          prioridade?: string
          problema?: string | null
          projeto_pai_id?: string | null
          retorno_em?: string | null
          saude?: string | null
          seguranca?: boolean
          setor?: string | null
          solicitante_id?: string | null
          tipo_projeto_id: string
          uf?: string | null
        }
        Update: {
          ano?: number
          arquivado_em?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          beneficios?: string | null
          campos?: Json
          cidade?: string | null
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          data_fase?: string
          data_fim_prev?: string | null
          data_fim_real?: string | null
          data_inicio_prev?: string | null
          data_inicio_real?: string | null
          data_solicitacao?: string | null
          descricao?: string | null
          empresa_id?: string
          fase_id?: string
          frente?: string | null
          gerente_id?: string | null
          id?: string
          local?: string | null
          motivo_arquivo?: string | null
          nome?: string
          numero?: number
          objetivo?: string | null
          observacao?: string | null
          origem_legado?: string | null
          pontuacao_total?: number
          prioridade?: string
          problema?: string | null
          projeto_pai_id?: string | null
          retorno_em?: string | null
          saude?: string | null
          seguranca?: boolean
          setor?: string | null
          solicitante_id?: string | null
          tipo_projeto_id?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tipo_projeto_id_fkey"
            columns: ["tipo_projeto_id"]
            isOneToOne: false
            referencedRelation: "tipo_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_contador: {
        Row: {
          ano: number
          empresa_id: string
          ultimo: number
        }
        Insert: {
          ano: number
          empresa_id: string
          ultimo?: number
        }
        Update: {
          ano?: number
          empresa_id?: string
          ultimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_contador_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_empresa: {
        Row: {
          criado_em: string
          empresa_id: string
          id: string
          observacao: string | null
          percentual: number
          projeto_id: string
        }
        Insert: {
          criado_em?: string
          empresa_id: string
          id?: string
          observacao?: string | null
          percentual: number
          projeto_id: string
        }
        Update: {
          criado_em?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          percentual?: number
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_empresa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_empresa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_empresa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_empresa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_fase_hist: {
        Row: {
          de_fase_id: string | null
          em: string
          id: string
          motivo: string | null
          observacao: string | null
          para_fase_id: string
          pessoa_id: string | null
          projeto_id: string
        }
        Insert: {
          de_fase_id?: string | null
          em?: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          para_fase_id: string
          pessoa_id?: string | null
          projeto_id: string
        }
        Update: {
          de_fase_id?: string | null
          em?: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          para_fase_id?: string
          pessoa_id?: string | null
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_fase_hist_de_fase_id_fkey"
            columns: ["de_fase_id"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_hist_para_fase_id_fkey"
            columns: ["para_fase_id"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_hist_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_hist_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_hist_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_hist_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_hist_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_pontuacao: {
        Row: {
          criterio_id: string
          em: string
          id: string
          justificativa: string | null
          nota: number
          pessoa_id: string | null
          projeto_id: string
        }
        Insert: {
          criterio_id: string
          em?: string
          id?: string
          justificativa?: string | null
          nota: number
          pessoa_id?: string | null
          projeto_id: string
        }
        Update: {
          criterio_id?: string
          em?: string
          id?: string
          justificativa?: string | null
          nota?: number
          pessoa_id?: string | null
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_pontuacao_criterio_id_fkey"
            columns: ["criterio_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_criterio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_valor: {
        Row: {
          atualizado_em: string
          projeto_id: string
          valor_aprovado: number
          valor_entrada: number | null
          valor_estimado: number
          valor_orcado: number
          valor_pago: number
          valor_realizado: number
          valor_revisoes: number
        }
        Insert: {
          atualizado_em?: string
          projeto_id: string
          valor_aprovado?: number
          valor_entrada?: number | null
          valor_estimado?: number
          valor_orcado?: number
          valor_pago?: number
          valor_realizado?: number
          valor_revisoes?: number
        }
        Update: {
          atualizado_em?: string
          projeto_id?: string
          valor_aprovado?: number
          valor_entrada?: number | null
          valor_estimado?: number
          valor_orcado?: number
          valor_pago?: number
          valor_realizado?: number
          valor_revisoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_valor_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_valor_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_valor_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_valor_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      setor: {
        Row: {
          ativo: boolean
          codigo: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      tarefa: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          caminho_critico: boolean
          codigo: string | null
          criado_em: string
          criado_por: string | null
          data_fim_prev: string | null
          data_fim_real: string | null
          data_inicio_prev: string | null
          data_inicio_real: string | null
          descricao: string | null
          duracao_dias: number | null
          etapa_id: string | null
          folga_total_dias: number | null
          id: string
          marco: boolean
          nome: string
          observacao: string | null
          ordem: number
          pai_id: string | null
          percentual_concluido: number
          projeto_id: string
          responsavel_id: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          caminho_critico?: boolean
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim_prev?: string | null
          data_fim_real?: string | null
          data_inicio_prev?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          duracao_dias?: number | null
          etapa_id?: string | null
          folga_total_dias?: number | null
          id?: string
          marco?: boolean
          nome: string
          observacao?: string | null
          ordem?: number
          pai_id?: string | null
          percentual_concluido?: number
          projeto_id: string
          responsavel_id?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          caminho_critico?: boolean
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim_prev?: string | null
          data_fim_real?: string | null
          data_inicio_prev?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          duracao_dias?: number | null
          etapa_id?: string | null
          folga_total_dias?: number | null
          id?: string
          marco?: boolean
          nome?: string
          observacao?: string | null
          ordem?: number
          pai_id?: string | null
          percentual_concluido?: number
          projeto_id?: string
          responsavel_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "tarefa_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_checklist: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          id: string
          ordem: number
          tarefa_id: string
          texto: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          id?: string
          ordem?: number
          tarefa_id: string
          texto: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          id?: string
          ordem?: number
          tarefa_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_checklist_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_checklist_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_checklist_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "tarefa_checklist_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_dependencia: {
        Row: {
          criado_em: string
          folga_dias: number
          id: string
          predecessora_id: string
          tarefa_id: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          folga_dias?: number
          id?: string
          predecessora_id: string
          tarefa_id: string
          tipo?: string
        }
        Update: {
          criado_em?: string
          folga_dias?: number
          id?: string
          predecessora_id?: string
          tarefa_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_dependencia_predecessora_id_fkey"
            columns: ["predecessora_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_dependencia_predecessora_id_fkey"
            columns: ["predecessora_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "tarefa_dependencia_predecessora_id_fkey"
            columns: ["predecessora_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_dependencia_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_dependencia_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_agenda"
            referencedColumns: ["tarefa_id"]
          },
          {
            foreignKeyName: "tarefa_dependencia_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "vw_tarefa_atrasada"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_fase: {
        Row: {
          categoria: string
          codigo: string
          conclusiva: boolean
          cor: string
          exige_cronograma: boolean
          exige_orcamento: boolean
          exige_setores: string[]
          id: string
          inicial: boolean
          nome: string
          ordem: number
          tipo_projeto_id: string
        }
        Insert: {
          categoria: string
          codigo: string
          conclusiva?: boolean
          cor?: string
          exige_cronograma?: boolean
          exige_orcamento?: boolean
          exige_setores?: string[]
          id?: string
          inicial?: boolean
          nome: string
          ordem: number
          tipo_projeto_id: string
        }
        Update: {
          categoria?: string
          codigo?: string
          conclusiva?: boolean
          cor?: string
          exige_cronograma?: boolean
          exige_orcamento?: boolean
          exige_setores?: string[]
          id?: string
          inicial?: boolean
          nome?: string
          ordem?: number
          tipo_projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipo_fase_tipo_projeto_id_fkey"
            columns: ["tipo_projeto_id"]
            isOneToOne: false
            referencedRelation: "tipo_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_projeto: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo: string
          cor: string
          criado_em: string
          descricao: string | null
          extras: Json
          icone: string | null
          id: string
          mede_avanco_por: string
          nome: string
          ordem: number
          usa_cronograma: boolean
          usa_etapas: boolean
          usa_medicao: boolean
          usa_orcamento: boolean
          usa_pontuacao: boolean
          usa_recorrencia: boolean
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo: string
          cor?: string
          criado_em?: string
          descricao?: string | null
          extras?: Json
          icone?: string | null
          id?: string
          mede_avanco_por?: string
          nome: string
          ordem?: number
          usa_cronograma?: boolean
          usa_etapas?: boolean
          usa_medicao?: boolean
          usa_orcamento?: boolean
          usa_pontuacao?: boolean
          usa_recorrencia?: boolean
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo?: string
          cor?: string
          criado_em?: string
          descricao?: string | null
          extras?: Json
          icone?: string | null
          id?: string
          mede_avanco_por?: string
          nome?: string
          ordem?: number
          usa_cronograma?: boolean
          usa_etapas?: boolean
          usa_medicao?: boolean
          usa_orcamento?: boolean
          usa_pontuacao?: boolean
          usa_recorrencia?: boolean
        }
        Relationships: []
      }
      tipo_transicao: {
        Row: {
          de_fase_id: string
          exige_motivo: boolean
          id: string
          ordem: number
          papeis: string[]
          para_fase_id: string
          rotulo: string
        }
        Insert: {
          de_fase_id: string
          exige_motivo?: boolean
          id?: string
          ordem?: number
          papeis?: string[]
          para_fase_id: string
          rotulo: string
        }
        Update: {
          de_fase_id?: string
          exige_motivo?: boolean
          id?: string
          ordem?: number
          papeis?: string[]
          para_fase_id?: string
          rotulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipo_transicao_de_fase_id_fkey"
            columns: ["de_fase_id"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tipo_transicao_para_fase_id_fkey"
            columns: ["para_fase_id"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_agenda: {
        Row: {
          cor: string | null
          fim: string | null
          inicio: string | null
          marco: boolean | null
          projeto_codigo: string | null
          projeto_id: string | null
          responsavel_id: string | null
          status: string | null
          tarefa_id: string | null
          titulo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_avanco: {
        Row: {
          avanco_fisico: number | null
          etapas: number | null
          etapas_concluidas: number | null
          peso_total: number | null
          projeto_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etapa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_capacidade: {
        Row: {
          dedicacao_total: number | null
          pessoa_id: string | null
          pessoa_nome: string | null
          projetos: number | null
          sobrealocada: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "alocacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_curva_s: {
        Row: {
          base_acumulada: number | null
          base_mes: number | null
          competencia: string | null
          previsto_acumulado: number | null
          previsto_mes: number | null
          projeto_id: string | null
          realizado_acumulado: number | null
          realizado_mes: number | null
        }
        Relationships: []
      }
      vw_fluxo_mensal: {
        Row: {
          a_pagar: number | null
          competencia: string | null
          pago: number | null
          parcelas: number | null
          projeto_id: string | null
          vencido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_pontuacao: {
        Row: {
          ativo: boolean | null
          criterio: string | null
          criterio_descricao: string | null
          criterio_nome: string | null
          em: string | null
          justificativa: string | null
          maximo: number | null
          minimo: number | null
          nota: number | null
          ordem: number | null
          peso: number | null
          pessoa_id: string | null
          pontos: number | null
          pontos_maximos: number | null
          pontos_se_ligado: number | null
          projeto_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_pontuacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_pontuacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_projeto: {
        Row: {
          arquivado_em: string | null
          ativo: boolean | null
          campos: Json | null
          codigo: string | null
          consumo_percentual: number | null
          criado_em: string | null
          data_fim_prev: string | null
          data_fim_real: string | null
          data_inicio_prev: string | null
          data_inicio_real: string | null
          dias_para_retorno: number | null
          empresa_id: string | null
          empresa_nome: string | null
          empresa_prefixo: string | null
          fase_categoria: string | null
          fase_codigo: string | null
          fase_id: string | null
          fase_nome: string | null
          fase_ordem: number | null
          frente: string | null
          gerente_id: string | null
          gerente_nome: string | null
          id: string | null
          motivo_arquivo: string | null
          nome: string | null
          pontuacao_total: number | null
          prioridade: string | null
          projeto_pai_id: string | null
          retorno_em: string | null
          saude: string | null
          seguranca: boolean | null
          tipo_codigo: string | null
          tipo_cor: string | null
          tipo_nome: string | null
          tipo_projeto_id: string | null
          valor_aprovado: number | null
          valor_entrada: number | null
          valor_estimado: number | null
          valor_orcado: number | null
          valor_pago: number | null
          valor_realizado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tipo_projeto_id_fkey"
            columns: ["tipo_projeto_id"]
            isOneToOne: false
            referencedRelation: "tipo_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_projeto_edicao: {
        Row: {
          ano: number | null
          arquivado_em: string | null
          atualizado_em: string | null
          beneficios: string | null
          campos: Json | null
          cidade: string | null
          codigo: string | null
          criado_em: string | null
          data_fase: string | null
          data_fim_prev: string | null
          data_fim_real: string | null
          data_inicio_prev: string | null
          data_inicio_real: string | null
          data_solicitacao: string | null
          descricao: string | null
          empresa_id: string | null
          fase_id: string | null
          frente: string | null
          gerente_id: string | null
          id: string | null
          local: string | null
          motivo_arquivo: string | null
          nome: string | null
          numero: number | null
          objetivo: string | null
          observacao: string | null
          origem_legado: string | null
          pontuacao_total: number | null
          prioridade: string | null
          problema: string | null
          projeto_pai_id: string | null
          retorno_em: string | null
          saude: string | null
          seguranca: boolean | null
          setor: string | null
          solicitante_id: string | null
          tipo_projeto_id: string | null
          uf: string | null
        }
        Insert: {
          ano?: number | null
          arquivado_em?: string | null
          atualizado_em?: string | null
          beneficios?: string | null
          campos?: never
          cidade?: string | null
          codigo?: string | null
          criado_em?: string | null
          data_fase?: string | null
          data_fim_prev?: string | null
          data_fim_real?: string | null
          data_inicio_prev?: string | null
          data_inicio_real?: string | null
          data_solicitacao?: string | null
          descricao?: string | null
          empresa_id?: string | null
          fase_id?: string | null
          frente?: string | null
          gerente_id?: string | null
          id?: string | null
          local?: string | null
          motivo_arquivo?: string | null
          nome?: string | null
          numero?: number | null
          objetivo?: string | null
          observacao?: string | null
          origem_legado?: string | null
          pontuacao_total?: number | null
          prioridade?: string | null
          problema?: string | null
          projeto_pai_id?: string | null
          retorno_em?: string | null
          saude?: string | null
          seguranca?: boolean | null
          setor?: string | null
          solicitante_id?: string | null
          tipo_projeto_id?: string | null
          uf?: string | null
        }
        Update: {
          ano?: number | null
          arquivado_em?: string | null
          atualizado_em?: string | null
          beneficios?: string | null
          campos?: never
          cidade?: string | null
          codigo?: string | null
          criado_em?: string | null
          data_fase?: string | null
          data_fim_prev?: string | null
          data_fim_real?: string | null
          data_inicio_prev?: string | null
          data_inicio_real?: string | null
          data_solicitacao?: string | null
          descricao?: string | null
          empresa_id?: string | null
          fase_id?: string | null
          frente?: string | null
          gerente_id?: string | null
          id?: string | null
          local?: string | null
          motivo_arquivo?: string | null
          nome?: string | null
          numero?: number | null
          objetivo?: string | null
          observacao?: string | null
          origem_legado?: string | null
          pontuacao_total?: number | null
          prioridade?: string | null
          problema?: string | null
          projeto_pai_id?: string | null
          retorno_em?: string | null
          saude?: string | null
          seguranca?: boolean | null
          setor?: string | null
          solicitante_id?: string | null
          tipo_projeto_id?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "tipo_fase"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_projeto_pai_id_fkey"
            columns: ["projeto_pai_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tipo_projeto_id_fkey"
            columns: ["tipo_projeto_id"]
            isOneToOne: false
            referencedRelation: "tipo_projeto"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_retomada: {
        Row: {
          codigo: string | null
          dias: number | null
          empresa_nome: string | null
          id: string | null
          nome: string | null
          retorno_em: string | null
        }
        Relationships: []
      }
      vw_tarefa_atrasada: {
        Row: {
          caminho_critico: boolean | null
          data_fim_prev: string | null
          dias_atraso: number | null
          id: string | null
          marco: boolean | null
          nome: string | null
          percentual_concluido: number | null
          projeto_codigo: string | null
          projeto_id: string | null
          projeto_nome: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_projeto_edicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "vw_retomada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      definir_rateio: {
        Args: { p_linhas: Json; p_projeto: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
