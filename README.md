# marta_belas_unhas

## Marta Dona Sousa | Nail Designer

Aplicacao para apresentar os servicos de Marta, receber pedidos de agendamento e organizar a aprovacao, o atendimento e as avaliacoes.

## Estrutura

```text
frontend/                 Site React + TypeScript
backend/public/            Entrada HTTP da API PHP
backend/src/                Autenticacao, banco e regras da agenda
backend/database/           Schema MySQL/MariaDB
```

## Requisitos

- PHP 8.2+ com extensoes `pdo_mysql`, `mbstring` e `openssl`
- Composer 2+
- Node.js 20+ e npm
- MySQL 8+ ou MariaDB 10.6+

## Configuracao local

1. Aplique `backend/database/schema.sql` no MySQL: `mysql -u root -p < backend/database/schema.sql`.
2. Copie `backend/.env.example` para `backend/.env` e informe credenciais e um segredo aleatorio para `JWT_SECRET`.
3. Dentro de `backend/`, rode `composer install`.
4. Copie `frontend/.env.example` para `frontend/.env` e ajuste `VITE_API_URL` se necessario. Dentro de `frontend/`, rode `npm install`.
5. Inicie a API dentro de `backend/` com `php -S 127.0.0.1:8080 -t public public/index.php`.
6. Inicie o site dentro de `frontend/` com `npm run dev` e acesse o endereco mostrado pelo Vite (normalmente `http://localhost:5173`).

O primeiro cadastro recebe papel de cliente. Depois de criar a conta da profissional, promova apenas essa conta com acesso direto ao banco: `UPDATE users SET role = 'manicure' WHERE email = 'EMAIL_CONFIRMADO';`. O cadastro publico nunca cria contas de manicure.

## Exportar publicacoes do Instagram

O projeto nao automatiza login de navegador. Para exportar publicacoes, use a API oficial da Meta e uma conta profissional que Marta administre ou tenha autorizado, com as permissoes de leitura exigidas pela plataforma.

1. Configure um app Meta e obtenha um token de acesso com permissao `instagram_basic` e `pages_show_list`, autorizado pela pessoa que administra a Pagina ligada ao Instagram da Marta.
2. Copie `scripts/instagram.env.example` para `.env` e preencha `INSTAGRAM_ACCESS_TOKEN`. `INSTAGRAM_USERNAME` e opcional para escolher @martah.dona quando o token puder acessar varias contas. Nunca envie o token ao Git ou a conversas.
3. Com Node.js 20.6 ou superior, rode na raiz: `node --env-file=.env scripts/export-instagram-media.mjs`.
4. O arquivo `data/marta-instagram-posts.json` conterá as URLs diretas disponíveis via API, os links permanentes, legendas, tipo e data; carrosséis incluem seus itens. Para escolher outro caminho: `node --env-file=.env scripts/export-instagram-media.mjs caminho/saida.json`.

O script descobre o ID do perfil automaticamente pelas Páginas acessíveis ao token, então não é necessário procurar o ID da Página nem o ID do Instagram manualmente. As URLs de mídia podem expirar ou mudar segundo as regras da Meta; o `permalink` é o link permanente da publicação. O script grava a saída local com permissões restritas e `data/` está no `.gitignore` para não publicar links por acidente.

## Fluxos

- Cliente cria conta, escolhe servico, solicita dia/horario e descreve o que deseja.
- Manicure ve pedidos e contato da cliente, pode aprovar, recusar ou sugerir outro horario.
- Cliente pode aceitar a contraproposta, e a API verifica conflito de horario antes de confirmar.
- Depois de marcado como concluido pela manicure, o atendimento pode receber uma avaliacao unica de 1 a 5 estrelas.
- A manicure publica trabalhos com links HTTPS de fotos/videos autorizados; clientes autenticadas podem curtir e descurtir cada trabalho.
- Lembretes do dia sao gravados no MySQL por tarefa diaria; ao entrar, o site exibe o aviso e pode usar notificacoes do navegador mediante permissao.

Para habilitar os lembretes, configure uma tarefa no servidor para executar `php backend/bin/create-reminders.php` diariamente. Notificacoes push com o navegador fechado exigem service worker e credenciais de um provedor push, que ainda nao foram configurados.

## Seguranca e conteudo

Tokens JWT expiram em 8 horas; senhas usam `password_hash`; consultas utilizam PDO com prepared statements; telefone e nome de clientes so sao retornados para o papel `manicure`. Em producao, use HTTPS, `APP_ENV=production`, segredo JWT forte, CORS restrito ao dominio oficial, backup do MySQL e politica de privacidade/consentimento LGPD.

O perfil @martah.dona nao exibiu publicacoes sem login. A imagem do destaque e ilustrativa, e os quadros do portifolio sao placeholders. Substitua-os apenas por fotos/videos da profissional enviados ou autorizados por ela. Localizacao, valores e politicas do salao tambem devem ser confirmados antes da publicacao.

As publicacoes do portifolio sao cadastradas no painel da manicure com URL HTTPS. Hospede as midias em um servico autorizado (ou adapte o upload para o armazenamento escolhido); o projeto nao baixa nem copia automaticamente conteudo do Instagram.
