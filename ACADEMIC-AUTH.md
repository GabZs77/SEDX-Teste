# Autenticação das abas acadêmicas

O Worker `sdf` mantém os tokens fora do navegador e usa o fluxo oficial da Sala do Futuro:

1. `LoginCompletoToken` autentica o RA e a senha no backend.
2. `POST https://edusp-api.ip.tv/registration/edusp/token` troca o token SED por um token EduSP (`token2`), usando os headers `x-api-platform: webclient` e `x-api-realm: edusp`.
3. O Worker preserva internamente os cookies de sessão retornados pelo login, incluindo `sf_sid`, e chama `POST https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi/credenciais/api/ValidarToken` com `Authorization: Bearer <token>` e `x-product-name: SalaDoFuturo`.
4. Na retomada, o Worker usa o token EduSP já emitido pelo `registration/edusp/token`; isso evita exigir novamente o cookie `sf_sid`, que não é exposto ao navegador. As consultas acadêmicas usam esse token de sessão para acessar as APIs.

Para as APIs de frequência, o Worker salva o cookie `sf_sid` retornado no login em um namespace KV privado do Cloudflare, usando uma chave derivada por hash do token SED e expiração de 24 horas. O valor nunca é retornado ao frontend, ao GitHub ou à interface do aluno.

O frontend envia apenas os tokens de sessão já emitidos ao Worker por headers de sessão. Nenhuma senha, chave de assinatura ou token de exemplo deve ser gravado neste repositório.
