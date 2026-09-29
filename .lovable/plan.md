# Renovação do painel, estudo e acesso

## O que será construído
- Renovar o painel principal com indicadores mais claros, progresso recente, aproveitamento por matéria e atalhos úteis, mantendo os gráficos existentes.
- Refinar a página Estudar com uma faixa de filtros mais interativa, progresso visível, transições curtas e retorno de acerto/erro mais destacado.
- Quando houver erro e a questão não tiver explicação cadastrada, gerar sob demanda uma explicação curta por IA sobre por que o gabarito é correto.
- Atualizar o acesso no estilo tático grafite e ciano escolhido e adicionar um atalho para WhatsApp no número informado.

## Direção visual
- Grafite profundo, superfícies em ardósia, ciano como ação principal e verde para acertos.
- Sora nos títulos e Manrope nos textos.
- Densidade compacta, bordas precisas, indicadores operacionais e animações rápidas com suporte a redução de movimento.

## Detalhes técnicos
- Reutilizar os dados pessoais de tentativas já protegidos por conta, sem alterar permissões ou cadastro.
- Criar uma função autenticada para a explicação curta, enviando à IA apenas enunciado, alternativas e gabarito da questão acessível ao usuário.
- Manter explicações cadastradas como primeira opção; a IA será acionada somente quando necessário após uma resposta errada.
- O WhatsApp abrirá uma conversa externa com `wa.me/55984679565`.
- Atualizar os metadados das páginas alteradas para o domínio MEUCBFPM.

## Validação
- Conferir acesso e link do WhatsApp.
- Testar painel e estudo em desktop e celular.
- Responder uma questão incorretamente e confirmar a explicação curta gerada.
- Confirmar ausência de erros de execução e compilação.
