# Bellink

Plataforma SaaS de agendamento online para manicures, nail designers, cabeleireiras, esteticistas e pequenos studios. Slogan: "Sua agenda no link da bio."

Cada studio tem um link público (`/s/espaco-da-ana`) onde a cliente agenda sem criar conta. A profissional gerencia agenda, serviços, horários, clientes e assinatura num painel. A cobrança recorrente é feita pelo Asaas.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind) · Supabase (Postgres, Auth, RLS) · Vercel · Asaas.

## Como está organizado

| Caminho | O que é |
| --- | --- |
| `supabase/migrations/` | Schema completo: tabelas, RLS, funções de agendamento e cobrança |
| `supabase/tests/` | Testes SQL (isolamento entre studios, horário duplicado, bloqueios, assinatura) |
| `src/app/s/[slug]` | Página pública de agendamento (mobile first) |
| `src/app/agendamento/[token]` | Link seguro para a cliente consultar/cancelar o agendamento |
| `src/app/painel` | Painel da profissional |
| `src/app/admin` | Painel do administrador da plataforma |
| `src/app/api/webhooks/asaas` | Webhook do Asaas (token + idempotência) |
| `src/app/api/cron/asaas` | Conciliação diária com o Asaas (Vercel Cron) |
| `src/lib/billing.ts` | Regras de status da assinatura |

## Decisões de segurança

- **RLS em todas as tabelas.** Um studio só lê e altera os próprios dados (`is_studio_member`). Escrita exige assinatura com acesso (`studio_has_access`).
- **A cliente final não acessa tabelas.** A página pública usa só funções `security definer` que devolvem o mínimo: `get_public_studio`, `get_available_slots`, `book_appointment`, `get_public_appointment`, `cancel_public_appointment`.
- **Sem horário duplicado.** `book_appointment` valida o horário e grava na mesma transação, com trava por profissional. Além disso, a constraint `appointments_no_overlap` (exclusão GiST) impede sobreposição no banco, mesmo em requisições simultâneas. Teste: 20 reservas simultâneas do mesmo horário resultam em 1 agendamento.
- **Assinatura não é alterável pelo navegador.** `subscriptions` e `payments` são somente leitura para o usuário; só o servidor (chave secreta) escreve, a partir do webhook/conciliação.
- **Chaves secretas só no servidor.** `SUPABASE_SECRET_KEY` e `ASAAS_API_KEY` nunca usam o prefixo `NEXT_PUBLIC_`.
- **Admin da plataforma** é definido na tabela `platform_admins`, vê dados do negócio (studios e assinaturas), não dados das clientes finais, e cada operação fica em `audit_log`.

## Regras comerciais implementadas

- Um plano pago (`plans.code = 'studio'`, R$ 49,90 como valor provisório, editável na tabela) com **14 dias de teste sem cartão**.
- Ao assinar durante o teste, a primeira cobrança vence no fim do teste. A cliente paga por Pix, boleto ou cartão na fatura do Asaas.
- Cobrança criada **não** é pagamento: o acesso só muda com `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`.
- Vencida: tolerância de `BILLING_GRACE_DAYS` (padrão 5 dias). Depois disso, o painel fica somente leitura e o agendamento online pausa.
- Cancelada: acesso até o fim do período já pago.
- Estorno/chargeback: acesso limitado imediatamente.
- Suspensão nunca apaga dados. Agendamentos existentes continuam visíveis no painel.

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (sugestão: um projeto para produção e outro para testes/preview).
2. Aplique as migrações, na ordem do nome do arquivo. Pelo painel: **SQL Editor** → cole o conteúdo de cada arquivo de `supabase/migrations/` → Run. A segunda migração também cria o bucket público `studio-photos` do Storage, usado pelas fotos do studio. Ou pela CLI:
   ```bash
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```
3. **Authentication → URL Configuration**:
   - Site URL: `https://SEU-DOMINIO`
   - Redirect URLs: `https://SEU-DOMINIO/auth/confirm`, `http://localhost:3000/auth/confirm` e `https://*-SEU-TIME.vercel.app/auth/confirm` (previews).
4. **Authentication → Providers → Email**: deixe "Confirm email" ligado (recomendado).
5. **Project Settings → API**: copie a URL, a publishable key e a secret key para as variáveis abaixo.
6. Para se tornar administradora da plataforma, depois de criar sua conta rode no SQL Editor:
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'seu@email.com';
   ```

### 2. Asaas

1. Crie uma conta no [sandbox](https://sandbox.asaas.com) para testes e gere a chave de API em **Integrações → Chave de API**. Em produção, faça o mesmo na conta real.
2. Em **Integrações → Webhooks**, crie um webhook:
   - URL: `https://SEU-DOMINIO/api/webhooks/asaas`
   - Token de autenticação: uma string aleatória de 32+ caracteres (a mesma de `ASAAS_WEBHOOK_TOKEN`). Ex.: `openssl rand -hex 24`
   - Versão da API: v3 · Tipo de envio: sequencial
   - Eventos: todos de **Cobranças** (`PAYMENT_*`) e de **Assinaturas** (`SUBSCRIPTION_*`).

### 3. Vercel

1. Importe o repositório `beleza` em [vercel.com/new](https://vercel.com/new) (framework detectado: Next.js).
2. Cadastre as variáveis de `.env.example` em **Settings → Environment Variables**:
   - **Production**: Supabase de produção, `ASAAS_API_URL=https://api.asaas.com/v3` e chave de produção.
   - **Preview / Development**: Supabase de teste e Asaas sandbox.
   - `CRON_SECRET`: string aleatória. A Vercel usa para chamar `/api/cron/asaas` diariamente (`vercel.json`).
3. Cada PR ganha uma URL de preview; o merge na `main` publica em produção.

### 4. Rodando localmente

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run dev                   # http://localhost:3000
```

Para receber webhooks do Asaas localmente, use um túnel (ex.: `ngrok http 3000`) e aponte o webhook do sandbox para a URL gerada.

## Testes do banco

Os testes SQL rodam num Postgres 15+ comum, simulando o ambiente do Supabase:

```bash
createdb beleza_test
psql -d beleza_test -f supabase/tests/stub_supabase.sql \
                    -f supabase/migrations/20261016000000_schema_inicial.sql \
                    -f supabase/migrations/20261016010000_bellink_fotos_e_servicos.sql \
                    -f supabase/tests/agendamento_test.sql
```

A última linha deve ser `TODOS OS TESTES PASSARAM`.

## Próximos passos sugeridos

- Lembretes por WhatsApp/e-mail (integração separada, com consentimento).
- Equipe com vários profissionais (o modelo já suporta `professionals`; falta a escolha na página pública e serviços por profissional).
- Proteção extra contra abuso na página pública (captcha ou limite por IP).
- Política de retenção e exclusão de dados de clientes (LGPD).
