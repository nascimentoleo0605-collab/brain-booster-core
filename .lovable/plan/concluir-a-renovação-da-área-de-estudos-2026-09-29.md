# Concluir a renovação da área de estudos

## Resultado
- Corrigir a geração de resumos para que a resposta da IA seja recebida de forma confiável e os erros sejam apresentados com clareza.
- Renovar o painel com indicadores mais informativos, gráficos responsivos, dicas ao passar o cursor e seleção rápida do que analisar.
- Transformar os assuntos em Matérias em ações diretas que abrem Estudar já filtrado pela matéria e pelo assunto escolhidos.
- Finalizar a página Estudar com filtros mais visuais, progresso, retorno animado e explicação curta por IA quando o aluno errar.
- Aplicar transições leves e consistentes às páginas e mudanças de estado, respeitando a preferência do dispositivo por menos movimento.

## Fluxos principais
1. O aluno escolhe período e matéria no painel e vê totais, aproveitamento, evolução e comparações atualizados.
2. Em Matérias, o aluno toca em um assunto e começa uma sequência aleatória restrita àquele assunto.
3. Ao errar, recebe o gabarito e uma explicação breve, usando a explicação cadastrada ou gerada sob demanda.
4. Em Resumos, seleciona matéria e assunto e recebe o texto completo sem o erro atual de saída vazia.

## Detalhes técnicos
- Ampliar a busca tipada de Estudar para aceitar `subject` e `topic`, preservando links diretos e histórico.
- Trocar a leitura frágil do fluxo de texto por geração completa e validar a resposta antes de devolvê-la.
- Manter a credencial de IA e a leitura das questões somente no servidor autenticado.
- Usar os tokens grafite/ciano já escolhidos, componentes existentes e animações CSS reutilizáveis.
- Verificar telas de desktop e celular, geração real de resumo, navegação por assunto e resposta errada com explicação.
