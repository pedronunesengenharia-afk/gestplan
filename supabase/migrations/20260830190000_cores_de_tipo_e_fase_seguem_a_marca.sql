-- =============================================================================
-- GestPlan · as cores de tipo e de fase passam a ser as da marca
--
-- Cor de tipo e de fase é DADO, não código — está em `tipo_projeto.cor` e
-- `tipo_fase.cor`, e a tela só lê. Por isso repintar a identidade não é mexer
-- em CSS: é mexer aqui. O CSS já foi.
--
-- As cores saem da paleta validada em `src/estilos/graficos.css`, que é
-- ancorada na prancheta de marca e passou nos cinco checks de
-- `ferramentas/validar_paleta.py` — inclusive separação sob daltonismo. Não
-- foram escolhidas no olho: um chip de tipo ao lado do outro precisa ser
-- distinguível por quem não separa vermelho de verde.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipo: uma cor por tipo, todas da paleta validada
-- -----------------------------------------------------------------------------
-- Este é o único lugar do sistema onde nomear o tipo é legítimo: é SEED, é
-- configuração, e é exatamente onde a regra de ouro manda a variação viver.
-- Um tipo novo escolhe a cor dele ao ser cadastrado.
update tipo_projeto set cor = '#0056D2' where codigo = 'INVESTIMENTO';  -- azul da marca
update tipo_projeto set cor = '#C2255C' where codigo = 'OBRA';          -- framboesa
update tipo_projeto set cor = '#0097A7' where codigo = 'TI';            -- teal da marca
update tipo_projeto set cor = '#9C36B5' where codigo = 'CONTRATO';      -- roxo
update tipo_projeto set cor = '#2F9E44' where codigo = 'MANUTENCAO';    -- verde

-- -----------------------------------------------------------------------------
-- Fase: por CATEGORIA, que é regra e vale para tipo que ainda nem existe
-- -----------------------------------------------------------------------------
-- Aqui NÃO se nomeia fase nenhuma. A cor sai da categoria, que já é o campo
-- que diz o que a fase significa em qualquer tipo de projeto. Um tipo novo,
-- com fases de nome que ninguém imaginou, nasce com o farol certo — preparação
-- em cinza, execução em azul, encerramento em verde, arquivado apagado.
--
-- É o mesmo motivo de tudo mais neste sistema: quem varia entre tipos é dado,
-- e a variação se descreve por propriedade, não por nome.
update tipo_fase set cor = case categoria
  when 'PREPARACAO'   then '#78909C'   -- ainda não começou a andar
  when 'EXECUCAO'     then '#0056D2'   -- andando: o azul de confiança
  when 'ENCERRAMENTO' then '#2E7D32'   -- entregue
  when 'ARQUIVADO'    then '#90A4AE'   -- saiu de cena
  else cor
end;

-- A fase que cobra parecer é a que trava a saída, e é a única que merece a cor
-- de atenção da prancheta. Continua sem nomear fase: pergunta-se ao dado.
update tipo_fase set cor = '#B26A00'
 where array_length(exige_setores, 1) > 0;

comment on column tipo_fase.cor is
  'Cor do farol. Repintada por CATEGORIA na migração 20260830190000 — fase '
  'nova de tipo novo já nasce com a cor certa. Fase que exige parecer usa o '
  'âmbar de atenção, porque é ela que trava a saída.';
