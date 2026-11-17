# Notas de segurança desta cópia

- A chave de assinatura do LeiaSP que estava fixa em `leiasp-worker.mjs` foi removida e substituída pela leitura do secret `env.SED_API_KEY`.
- Configure esse secret no Cloudflare antes de implantar/atualizar o Worker LeiaSP.
- Como a chave original apareceu em um arquivo-fonte enviado para revisão, recomenda-se solicitar sua rotação/revogação ao responsável pelo serviço, se ela ainda estiver ativa.
- Tokens de sessão SED, senhas e segredos de provedores devem permanecer fora do GitHub e ser configurados como secrets no ambiente de execução.
- A camada `ui-refresh.css` é um redesign visual compatível com a SPA atual. O projeto usa uma aplicação estática compilada; HeroUI/Magic UI/Aceternity UI são bibliotecas voltadas principalmente a React e não podem ser adicionadas como componentes diretamente sem migrar a arquitetura. Esta entrega aplica padrões visuais inspirados nelas sem substituir autenticação, rotas ou APIs.
