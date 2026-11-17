# SEDX Aluno — aplicativo nativo

Aplicativo Android nativo criado com Expo/React Native. O app não usa WebView: as telas são renderizadas com componentes nativos (`View`, `Text`, `ScrollView`, `TextInput` e `TouchableOpacity`).

## Telas nativas incluídas

- Login nativo com sessão persistida no dispositivo.
- Início com visão geral, próximo passo, presença e atalhos.
- Redação com editor nativo, contador e geração assistida por IA.
- Central de ajuda com abertura e listagem de atendimentos.
- Comunidade com Chat nativo e envio de mensagens.
- Perfil com identificação da conta e saída segura.

A identidade visual reutiliza a paleta SEDX, o logo e os princípios visuais do repositório web: fundo escuro, cartões elevados, bordas âmbar, tipografia forte e navegação inferior mobile.

## Desenvolvimento

```bash
cd mobile
npm install
npx tsc --noEmit
npx expo start
```

## APK debug

A pasta `android/` já foi gerada pelo Expo Prebuild. Para compilar localmente, é necessário ter o Android SDK instalado e configurar `ANDROID_HOME` ou `mobile/android/local.properties` com `sdk.dir`.

```bash
cd mobile/android
./gradlew :app:assembleDebug
```

O APK será gerado em `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## API exclusiva do aplicativo

O app não usa WebView e não chama diretamente o Worker público principal. Ele usa o Worker dedicado `sdf-mobile.gabrielreplit56.workers.dev`, publicado a partir de `../mobile-worker.mjs`. Esse Worker aplica uma lista de rotas permitidas e encaminha internamente para o Worker SEDX principal por Service Binding `SEDX_CORE`.

O endereço usado pelo app fica em `api.ts`, e os tokens de sessão são armazenados apenas no armazenamento seguro de preferências do aplicativo para reutilização nas chamadas autenticadas.
