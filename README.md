# Leadprospec

Site estático pronto para Vercel.

O front-end é hospedado pela Vercel e usa a API/banco já publicados no Supabase:

`https://bpxbxiesmarofnjztcpu.supabase.co/functions/v1/cartao-leads`

O painel gerencial sincroniza automaticamente com a nuvem a cada 1 segundo quando Breno está logado.

## Cadastro do sorteio

A aba `Cadastro do sorteio` fica disponível sem login e envia os participantes para `/api/site-leads`.
Esses cadastros aparecem no painel do Breno com responsável `Site`.

Regras aplicadas pela API:

- nome completo, CPF e telefone são obrigatórios;
- CPF, nome completo normalizado e telefone não podem ser repetidos;
- o participante precisa confirmar que seguiu o Instagram do Cartão de Todos;
- o participante precisa confirmar que o WhatsApp pertence ao nome cadastrado.

## Logins

- Breno: `breno.portes` / `gestao147`
- Amanda: `amanda` / `Amandacdt@`
- Giovana: `giovana` / `Giovana@cdt.`
