# 📱 Guia de Compilação do APK Nativo Android com GitHub Actions (GSI PRO)

Este projeto foi configurado com **Capacitor** e uma **Workflow automatizada do GitHub Actions** (`.github/workflows/build-apk.yml`) para compilar o APK nativo Android na nuvem sem precisar instalar o Android Studio no seu computador.

---

## 🚀 Como Funciona

Toda vez que você enviar o código para o GitHub (ou clicar no botão manual), uma máquina virtual Ubuntu no GitHub irá:
1. Instalar as dependências do Node.js.
2. Fazer o build otimizado da interface web (`npm run build`).
3. Sincronizar o projeto nativo Android (`npx cap sync android`).
4. Configurar Java 21 e o Android SDK (API 35).
5. Compilar o APK de forma 100% nativa via Gradle (`./gradlew assembleDebug`).
6. Disponibilizar o arquivo **`.apk` pronto para download direto** na aba **Actions**.

---

## 📥 Passo a Passo para Compilar e Baixar o APK

### 1. Enviar o Código para o seu Repositório GitHub
Caso você esteja clonando ou subindo este repositório para o seu GitHub:
```bash
git add .
git commit -m "feat: configurado app nativo Android e GitHub Actions para APK"
git push origin main
```

---

### 2. Disparar a Compilação Manualmente (Opcional)
Se preferir compilar na hora sem precisar fazer commit:
1. Abra o seu repositório no [GitHub](https://github.com).
2. Clique na aba **Actions** (no menu superior do repositório).
3. Na lista à esquerda, clique em **Build Android APK (GSI PRO)**.
4. Clique no botão **Run workflow** à direita.
5. Selecione a branch `main` e o tipo `debug` (ou `release`).
6. Clique no botão verde **Run workflow**.

---

### 3. Como Baixar o APK Gerado
1. Quando a compilação terminar (leva cerca de 2 a 3 minutos e fica com um ícone verde ✅), clique no nome da execução (ex: *Build Android APK (GSI PRO)*).
2. Desça a página até a seção **Artifacts** (no rodapé da página).
3. Você verá o item **`GSI-PRO-Android-APK`**.
4. Clique nele para baixar o arquivo `.zip` com o APK.
5. Extraia o arquivo `.zip` no seu computador ou envie diretamente para o seu celular Android via WhatsApp, Telegram, Google Drive ou cabo USB.

---

### 4. Como Instalar no Celular Android
1. No seu celular Android, abra o arquivo `GSI_PRO_app-debug.apk`.
2. Se o Android exibir a mensagem *"Para sua segurança, seu smartphone não tem permissão para instalar apps desconhecidos desta fonte"*, clique em **Configurações** e marque a opção **Permitir desta fonte**.
3. Toque em **Instalar**.
4. Abra o **GSI PRO** e conceda as permissões de Câmera, Microfone e Localização quando solicitado.

---

## 🛠️ Recursos Nativos Habilitados no App
- **Localização GPS**: Para registro de ponto eletrônico com geolocalização exata.
- **Câmera e Galeria**: Para foto do ponto, envio de fotos no chat e mídias de visualização única.
- **Microfone e Áudio**: Para gravação de áudios no chat e chamadas WebRTC (voz e vídeo).
- **Botão Voltar Nativo do Android**: Fecha janelas/modais abertos antes de sair do app.
- **Barra de Status Personalizada**: Integrada com a cor tema `#0a0e17`.

---

## 💻 Comandos Úteis Locais (Se tiver Android Studio instalado)

Caso queira testar localmente em seu computador:
- **Sincronizar alterações da interface com o Android**:
  ```bash
  npm run cap:build
  ```
- **Abrir o projeto no Android Studio**:
  ```bash
  npm run cap:open
  ```
- **Sincronizar plugins do Capacitor**:
  ```bash
  npm run cap:sync
  ```
