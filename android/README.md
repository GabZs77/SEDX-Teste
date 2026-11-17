# SEDX para Android

Este módulo contém o aplicativo Android nativo do SEDX. A interface é criada dentro do APK com views Android; ele não carrega `sed-gg.vercel.app` como WebView.

O aplicativo usa diretamente o Worker `sdf.gabrielreplit56.workers.dev` para autenticação, Chat da comunidade, badge de Admin e Central de ajuda. A primeira versão nativa inclui dashboard, login, leitura e envio no Chat, chamados de suporte e perfil local com temas.

## Compilação

A compilação é feita pelo workflow `.github/workflows/android-apk.yml`, em um runner Linux x86_64 do GitHub Actions. O ambiente local desta sessão é ARM64 e não executa os binários oficiais x86_64 do Android Build Tools.

O APK debug é disponibilizado como artefato `sedx-apk` ao final do workflow.
