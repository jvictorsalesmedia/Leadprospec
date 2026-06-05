# Site Agency 147

Portal online para controlar operacoes de conteudo por cliente: postagens, agenda, roteiros e gravacoes.

## Link publico

Depois que o GitHub Pages terminar o deploy, o site fica em:

`https://jvictorsalesmedia.github.io/siteagency147/`

## O que o app faz

- Login com Supabase Auth.
- Perfil administrador para gerenciar todos os clientes.
- Perfil cliente para ver somente o conteudo vinculado ao email de login dele.
- Painel com indicadores e proximas prioridades.
- Aba de clientes com contato, status, pacote contratado e resumo da operacao.
- Pipeline de posts por etapa.
- Agenda de publicacoes, reunioes, revisoes e gravacoes, com botao para abrir o evento no Google Agenda.
- Biblioteca de roteiros com gancho, blocos e CTA.
- Controle de gravacoes com data, local, equipamentos e tomadas.
- Busca geral por cliente, titulo, canal ou status.
- Filtros por status/tipo.
- Cadastro, edicao e exclusao de itens.
- Exportacao dos dados em JSON para backup.

Os dados ficam salvos no Supabase, com regras de seguranca por cliente.

## Primeiro acesso de administrador

O email `jvsalesmedia@gmail.com` ja esta registrado como administrador neste projeto.

Se voce criar outro administrador:

1. No Supabase, crie o usuario em `Authentication > Users`.
2. No SQL Editor, rode, trocando o email:

```sql
insert into public.app_admins (email)
values ('SEU_EMAIL_DE_LOGIN_AQUI');
```

3. Entre no site com esse email e senha.

Sem esse cadastro na tabela `app_admins`, o usuario entra como cliente.

## Como liberar um cliente

1. Entre no app como administrador.
2. Crie o cliente na aba `Clientes`.
3. Preencha `Email de login do cliente`.
4. Se quiser que o app crie o acesso do cliente, preencha tambem `Senha inicial do cliente`.
5. Cadastre posts, agenda, roteiros e gravacoes vinculando esse cliente.

Quando o cliente entrar, ele vera somente os dados ligados ao proprio email.

## GitHub Pages

O deploy usa GitHub Actions no arquivo `.github/workflows/pages.yml`.

## Google Agenda

A integracao atual cria um link "Google Agenda" nos itens de agenda. Ao clicar, o Google Calendar abre com titulo, data, horario, cliente, local e observacoes ja preenchidos.

Sincronizacao automatica de duas vias exige uma integracao com a API do Google Calendar, OAuth e credenciais do seu projeto Google Cloud.
