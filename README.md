# Nutre Vidas

**Integrantes**

- 
- 
- 

**Link do deploy da plataforma web:** 

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
- Hospedagem prevista: Render.

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

## Deploy

O painel web é publicado no Render a partir do diretório `web`. O endereço será inserido aqui após a publicação:

- **Plataforma web:** 

O arquivo `render.yaml` contém a configuração dos serviços web e mobile. O serviço mobile publicado dessa forma corresponde à versão web do Expo; para gerar aplicativos Android ou iOS instaláveis, é necessário configurar um processo de build mobile próprio.

