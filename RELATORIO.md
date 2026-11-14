# Finanças Pro — Relatório de análise (Rodada 1)

## Como aplicar
Substitua os arquivos do app pelos desta pasta. Seus dados (localStorage) são preservados; contas antigas
migram sozinhas para senha protegida no primeiro login. **Exporte um backup antes de testar.**

## O que foi encontrado e corrigido

### Perda de dados
1. **Modo Visitante apagava seus dados reais**: trocar o tema ou o "olho" gravava a estrutura vazia do visitante por cima do localStorage. Agora o visitante nunca grava.
2. **Salvar com erro fechava o modal e perdia o que você digitou** (lançamento, meta, produto). Agora só fecha se salvar.
3. **Lançamento fixo**: criava só o mês atual (meses em que o app ficou fechado ficavam sem), não dava para excluir (voltava ao abrir) e comparava descrição com `includes` ("Luz" casava com "Luzia"). Reescrito: preenche todos os meses faltantes, respeita exclusões, desmarcar "Fixo" no último lançamento cancela.
4. **Dívida excluída era apagada de vez** (agora vai para a Lixeira). Itens quitados/cartões na lixeira perdiam a descrição original ao restaurar.
5. **Pagamento parcial igual ao valor** deixava dívida com saldo R$ 0,00 para sempre → agora quita.
6. **Importar backup** aceitava qualquer JSON sem validar nem confirmar; notas não entravam no backup; "Zerar Tudo" era 1 clique e usava `localStorage.clear()`. Corrigido (validação, confirmação dupla, notas incluídas, nome do arquivo com data).

### Segurança
7. Senha e resposta secreta ficavam em **texto puro**; agora hash SHA-256 com salt. *(Proteção local do aparelho — o app não tem servidor.)*
8. **"Criar nova conta" sobrescrevia a conta existente** sem pedir nada (qualquer pessoa trocava a senha). Agora é bloqueado.
9. Alterar usuário/senha agora exige a senha atual; mínimo de 4 caracteres.
10. Textos digitados (descrição, nome, categoria) eram injetados no HTML sem escape: um `<` quebrava a tela e abria brecha de script. Escapado.

### Funcionalidades quebradas
11. **Controle de Revenda: a tela existia, mas nenhuma função estava implementada** (os botões não faziam nada). Implementado: cadastrar/editar/excluir, estoque, margem, totais, e botão "Vender 1" que lança a receita no extrato.
12. Interruptor "Repetir todos os meses" na compra do cartão não fazia nada → ocultado até ser implementado de verdade (veja Rodada 2).
13. **Datas em UTC**: após ~21h o app lançava no dia seguinte (e no último dia do mês, no mês seguinte). Corrigido para horário local.
14. Extrato e "Atividade recente" não ordenavam por data (lançamento retroativo aparecia no topo). Corrigido.
15. Dívida sem prazo ou sem WhatsApp podia travar a tela. Corrigido.
16. Filtro de dívidas: dois listeners disparavam juntos e a ordenação se perdia; botões rápidos não marcavam o ativo. Corrigido.
17. Notificações: não avisavam no fim do mês (vence dia 1–3), ignoravam dívidas vencidas, e o alerta de backup era por tamanho. Agora usa a data real do último backup.
18. Calculadora dava "Erro" com zero à esquerda (ex.: 05+3). Barra de limite do cartão com limite 0 dava `Infinity%`.
19. Removido `html2canvas` (carregado e nunca usado); Chart.js fixado em versão estável.

## Problemas conhecidos que ficaram para a Rodada 2 (maior impacto no saldo)
- **Compra parcelada no cartão só lança a 1ª parcela no extrato**; as demais nunca aparecem nos meses seguintes → saldo mensal otimista.
- **Fechamento da fatura é ignorado** (campo existe, mas não define em qual fatura a compra cai).
- **"Limite disponível" considera só o mês atual**, não o saldo total em aberto.
- Excluir cartão deixa os lançamentos dele órfãos no extrato.
- Pagar dívida não gera lançamento no extrato (hoje é opcional/manual).
- "Saldo Geral" mostra só o saldo do mês (não o acumulado).
- Editar um lançamento vindo de cartão/meta pelo extrato pode dessincronizar.
- Dados não são por usuário (uma conta por aparelho). Tudo em localStorage (~5 MB).
- Sem modo offline (CDNs do Bootstrap/Chart.js/FontAwesome) e ícone do PWA em JPG fora das medidas.
- `perfil2.jpg` (2,2 MB) não é usado em lugar nenhum.

## Ideias (ordem sugerida)
1. **Visão anual** (receita × despesa por mês, média, melhor/pior mês, ranking de categorias) — hoje não existe.
2. **Categorias personalizáveis** separadas por tipo (receita/despesa) e **orçamento por categoria** com barra de progresso.
3. **Previsão do mês**: fixos + parcelas futuras + dívidas a vencer = "quanto sobra".
4. Cartão: fatura por fechamento, parcelas futuras, "melhor dia de compra", limite real.
5. Exportar CSV/PDF do extrato; anexar comprovante (foto); busca por período e por valor.
6. Interface: toasts no lugar de `alert()`, agrupar extrato por dia, gráficos de barras/linha, estados vazios ilustrados, teclado numérico com máscara em todos os campos, tema escuro revisado (alguns cartões ficam brancos).
7. PWA completo (offline + ícones PNG) e backup automático em arquivo/nuvem.

## Rodada 2 (implementado)
- Faturas separadas das movimentações (Extrato → filtro), 1 linha "Fatura" por cartão no mês do vencimento, calculada por fechamento, parcelas futuras e compras fixas.
- Compra fixa no cartão (repete todo mês); limite disponível real; badge "Fixo" nos lançamentos fixos.
- Cores por banco (seleção ou detecção pelo nome). Dívidas parceladas (pagar próxima parcela). Exportação .ics para o calendário. Metas fora do extrato.

## Rodada 3
- Novo visual (tema.css), menu lateral sempre visível (fixo no computador), Visão Anual.

## Rodada 4
- Categorias personalizadas, orçamento por categoria, contas fixas, saldo acumulado, quanto gastar por dia, dívidas no extrato (opcional), CSV, avisos na tela.

## Rodada 5
- Previsão de 6 meses, reserva de emergência, simulador de parcelas, uso offline (sw.js) e ícones PNG. Offline exige abrir por http(s) (ex.: hospedado), não por arquivo local.

## Rodada 6
- Comparar meses, ordem para quitar dívidas, PIN de bloqueio.

## Rodada 7
- Novo design estilo neobank (tema2.css), atalhos rápidos, saudação e sequência de dias.

## Rodada 8
- Design refeito com cores e tamanhos originais; compatível com modo escuro.

## Rodada 9
- Nova Início (hero com meses, ganhos/gastos, próximos lançamentos, últimas transações com ícones) e cartões redesenhados.

## Rodada 10
- Início idêntica à referência; cache corrigido (?v=10); opção de cor verde/roxa.

## Rodada 11
- tema.css remontado; topo antigo removido da Início; Meus Cartões só na tela Cartões.

## Rodada 12
- Topo antigo removido da Início (à prova de CSS), menu ⋮ do cartão corrigido, botão X em todas as janelas.

## Rodada 13
- Mesmo design da Início em todas as telas (topo colorido + folha clara); Extrato agrupado por dia.

## Rodada 14
- Emojis trocados por ícones; Dívidas compacta; menu padronizado; calculadora flutuante/acoplável.

## Rodada 15
- Menu inferior com botão Pix, abas de Dívidas coloridas, botão 'gastar por dia'.

## Rodada 16
- Formulários completos (lançamento, cartão, compra, dívida) e módulo Clientes.

## Rodada 17
- Faturas com contas fixas, cartão emprestado por pessoa, FAB, avisos de confirmação, menu reorganizado.

## v18 — Organização e correções

- **Um arquivo só**: `script.js`, `correcoes.js` e `rodada2…14.js` viraram `app.js` (sem funções repetidas/sobrescritas). `tema.css` foi incorporado ao `style.css`.
- **Botões do topo (calculadora, data, modo escuro)**: o círculo decorativo do card roxo cobria os botões. Corrigido; o calendário agora abre um seletor de mês próprio.
- **Saldo do mês negativo**: amarelo-âmbar (`.saldo-negativo`). "Gastos" continua vermelho.
- **Cartão**: sem limite de compras/parcelas; a compra pula para a fatura correta; nova aba "Todas as compras".
- **Compras fixas no cartão**: aparecem na fatura de cada mês e em Contas Fixas.
- **Contas fixas**: menu ⋮ com Editar e Excluir (contas e compras de cartão).
- `perfil2.jpg` não é usado pelo app; foi mantido sem alteração.

## v19
- **Histórico de Fatura**: busca por compra/pessoa e filtro Todas/Pendentes/Pagas. Cada compra mostra Paga (verde) ou Pendente (vermelho). O card da fatura fica **verde** quando paga e **vermelho** quando pendente; botão "Marcar fatura como paga" (e desfazer). Na lista de cartões aparece o selo Paga/Pendente.
- **Cartão emprestado**: cada pessoa em um bloco próprio, com faixa colorida, inicial, total e status.
- **Compras fixas** entram na fatura (Minhas compras) e somam no saldo do mês via linha "Fatura".
- **Extrato**: bloco "Últimas transações" no topo; o filtro padrão agora mostra também as faturas (mesmo total do Início).
- **Parcelas**: cada compra mostra "Última parcela: mês/ano" (mês de vencimento) e "Depois desta, restam N"; "Falta pagar" não conta a parcela do mês se a fatura já está paga.
- **Dívidas fixas**: opção "repete todo mês em datas fixas" (ex.: 15, 20, 25, 30). Cada data vira um botão do mês; tocar marca como pago/recebido (e lança no extrato). Entra em Próximos lançamentos, Previsão, Lembretes e Calendário (.ics).
