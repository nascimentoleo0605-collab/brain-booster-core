# Resumos por matéria e assunto

## Objetivo
Criar uma nova aba **Resumos** para qualquer usuário autenticado escolher uma matéria e um assunto já cadastrados e solicitar um resumo didático gerado por IA.

## Experiência
- Adicionar **Resumos** à navegação principal.
- Carregar matérias e assuntos existentes no banco de questões, evitando opções vazias ou duplicadas.
- Exigir a escolha da matéria e do assunto antes da geração.
- Exibir o resumo na própria página, com estrutura clara para estudo e estados de carregamento e erro.
- Manter o resumo atual ao voltar para a página durante a mesma sessão de navegação.

## Segurança e IA
- Fazer a solicitação somente no servidor, mantendo instruções e credenciais privadas.
- Exigir uma conta autenticada; nenhum privilégio de administrador será necessário.
- Usar o modelo padrão do Lovable AI para produzir conteúdo em português, limitado ao tema selecionado.
- Mostrar mensagens seguras e específicas quando houver indisponibilidade, limite ou falta de créditos.

## Validação
- Testar seleção encadeada de matéria e assunto.
- Gerar um resumo real e confirmar sua exibição.
- Verificar navegação, retorno à página anterior, tela móvel e ausência de erros.
