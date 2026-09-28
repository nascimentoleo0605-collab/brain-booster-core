# Importação de questões por PDF

## Objetivo
Permitir que somente o administrador envie um PDF, extraia questões de múltipla escolha e reconheça as respostas indicadas no próprio arquivo.

## Experiência
- Adicionar **Importar PDF** ao lado da importação CSV na página Questões.
- Ler PDFs com texto selecionável, identificar enunciados, alternativas e gabaritos comuns (`1-A`, `1. A`, `Resposta: A`, `Gabarito: B`).
- Solicitar matéria e assunto para as questões extraídas.
- Exibir uma revisão antes de salvar, destacando questões sem resposta reconhecida.
- Permitir corrigir a alternativa certa, editar matéria/assunto e excluir itens da revisão.
- Importar somente questões completas e confirmadas pelo administrador.
- Informar claramente quando o PDF for apenas imagem e não tiver texto legível.

## Detalhes técnicos
- A leitura acontecerá no navegador, sem armazenar o arquivo PDF.
- Usar uma biblioteca compatível com navegador para extração de texto.
- Manter as permissões atuais do banco: somente admins podem inserir questões.
- Preservar a importação CSV existente e atualizar os metadados da página.

## Validação
- Testar extração com um PDF de exemplo contendo questões e gabarito.
- Confirmar a revisão, a seleção da resposta e o salvamento.
- Verificar a tela em tamanhos desktop e móvel e confirmar ausência de erros.
