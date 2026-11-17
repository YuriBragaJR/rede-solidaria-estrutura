# Nutre Vidas

**Integrantes**

- 
- 
- 

**Repositório no GitHub:** https://github.com/YuriBragaJR/rede-solidaria-estrutura

**Deploy do aplicativo mobile (web):** https://nutre-app.onrender.com

**Deploy da plataforma web:** https://nutre-painel.onrender.com

**Link do Expo Snack (se utilizado):** 

## Sobre o projeto

O Nutre Vidas é uma plataforma que conecta estabelecimentos com alimentos excedentes em boas condições a ONGs e pessoas voluntárias que podem retirá-los e distribuí-los. A solução busca reduzir o desperdício de alimentos e facilitar a chegada desses recursos a quem precisa.

O ecossistema tem duas interfaces:

- **Aplicativo mobile:** mural de doações, busca por categoria, reserva com código de retirada, informações para chegar ao estabelecimento e acompanhamento da distribuição.
- **Plataforma web:** painel de gestão para consultar e filtrar doações, cadastrar novas publicações, acompanhar atividades e acessar relatórios.

## Como a integração funciona

O aplicativo mobile e a plataforma web compartilham o mesmo projeto Supabase. Assim, uma conta criada em uma interface pode ser usada na outra, e as informações ficam sincronizadas no banco de dados.

- **Supabase Auth** autentica os usuários e mantém os perfis de comerciantes, ONGs e pessoas voluntárias.
- **Supabase Database (PostgreSQL)** guarda perfis, doações, reservas, avaliações e registros de distribuição.
- **Supabase Storage** armazena as imagens das doações e dos registros de distribuição.
- **Funções RPC e políticas RLS** executam operações específicas — como reservar uma doação e validar o código de retirada — e controlam o acesso aos dados.

Quando um comerciante publica uma doação pelo app ou pelo painel web, o registro é salvo no Supabase e pode aparecer no mural mobile. Quando uma pessoa voluntária reserva a doação, o estado da publicação é atualizado e a reserva fica disponível para acompanhamento. A confirmação de retirada e a conclusão da distribuição atualizam o ciclo da doação, mantendo o histórico compartilhado entre as interfaces.

## Tecnologias

- Aplicativo: React Native e Expo.
- Plataforma web: JavaScript, Vite e Tailwind CSS.
- Backend e armazenamento: Supabase.
- Hospedagem: Render.

## Como executar localmente

É necessário ter Node.js e npm instalados, além de acesso ao projeto Supabase configurado para o Nutre.

### Aplicativo mobile

No terminal, a partir da pasta do repositório:

```bash
cd mobile
npm install
npm start
```

O Expo inicia o servidor de desenvolvimento e apresenta as opções para abrir o app em um dispositivo ou emulador. Para executar a versão web do app:

```bash
npm run web
```

### Plataforma web

Em outro terminal:

```bash
cd web
npm install
npm run dev
```

O Vite informa no terminal o endereço local para abrir no navegador. Para gerar e visualizar o build de produção:

```bash
npm run build
npm run preview
```

### Banco de dados Supabase

As migrações necessárias estão em `supabase/migrations`. Execute-as no projeto Supabase em ordem numérica para criar ou atualizar as tabelas, funções, políticas de acesso e bucket de imagens usados pelas interfaces.

## Acessar os deploys

As duas interfaces podem ser acessadas diretamente pelos links, sem baixar o repositório, instalar Node.js ou configurar dependências localmente:

- **Aplicativo mobile (versão web):** https://nutre-app.onrender.com
- **Painel da plataforma web:** https://nutre-painel.onrender.com

O link do aplicativo mobile abre a versão web exportada pelo Expo no navegador, com navegação adaptada para dispositivos móveis. Isso facilita testar o fluxo do app e suas telas sem precisar baixar todo o código-fonte. O link do painel web abre a interface de gestão.

O arquivo `render.yaml` contém a configuração dos dois serviços publicados no Render. O deploy mobile é a versão web do Expo; para distribuir o aplicativo como instalação nativa Android ou iOS, é necessário gerar um build mobile próprio.

