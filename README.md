# IAA-Issuer: Sistema de Gestão de Identidades e Credenciais Verificáveis

## Visão Geral
IAA-Issuer é uma prova de conceito (POC) para um sistema de gestão de identidades e credenciais verificáveis baseado em tecnologias DID (Decentralized Identifiers). O projeto implementa um sistema completo de emissão e verificação de credenciais verificáveis (VCs) e apresentações verificáveis (VPs), com aplicações práticas para gestão de ordens de serviço técnico.

## Objetivos
Este projeto demonstra como as tecnologias de identidade descentralizada podem ser aplicadas em cenários reais de negócio, permitindo:

- Autenticação segura baseada em credenciais verificáveis
- Emissão e gestão de credenciais qualificadas e não-qualificadas
- Verificação de apresentações de credenciais
- Gestão de ordens de serviço técnico com autorização baseada em credenciais

## Funcionalidades Principais

### Emissor de Credenciais (Issuer)
- Emissão de credenciais verificáveis (VCs) qualificadas utilizando o cartão de cidadão
- Armazenamento de credenciais na wallet digital do utilizador
- Autenticação na API através de apresentações verificáveis (VPs)
- Emissão de credenciais adicionais (funcionário, certificações técnicas)
- Gestão completa de ordens de serviço (WO)
- Gestão e revogação de credenciais emitidas

### Verificador (Verifier)
- Verificação da validade de apresentações verificáveis (VPs)
- Validação de credenciais e suas propriedades
- Verificação de credenciais qualificadas e não-qualificadas

## Conceitos Técnicos

### Ordens de Serviço (WO)
Uma ordem de serviço (WO - Work Order) representa uma tarefa técnica a ser executada, como por exemplo, a manutenção de um equipamento de ar condicionado. O sistema gerencia todo o ciclo de vida das ordens de serviço:

1. **Atribuição**: Cada WO é associada a um técnico qualificado e a um ativo específico
2. **Início**: Quando um técnico inicia uma WO, recebe uma VP do ativo (válida por 3 horas) que funciona como autorização para realizar o trabalho
3. **Conclusão**: Ao fechar uma WO, o técnico gera uma VP contendo uma prova seletiva da sua credencial (ex: certificação HVAC) e a credencial do ativo que sofreu intervenção

## Tecnologias Utilizadas
- Node.js e Express para o backend
- Frontend web para interface do usuário
- Bibliotecas DID e VC/VP para gestão de credenciais verificáveis
- Armazenamento de dados com SQLite

## Instalação e Execução

### Pré-requisitos
- Node.js (versão recomendada: 18+)
- npm

### Configuração
```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### Execução
```bash
# Desenvolvimento (frontend e backend simultaneamente)
npm run dev

# Apenas frontend
npm run dev:frontend

# Apenas backend
npm run dev:backend

# Produção
npm run build
npm start
```

## Credenciais Verificáveis Qualificadas

As credenciais verificáveis qualificadas (Qualified VCs) são um tipo especial de credencial que oferece um nível mais alto de confiança e segurança. No contexto deste projeto:

- São emitidas com base em identificação oficial (cartão de cidadão)
- Possuem assinatura digital qualificada
- Oferecem maior garantia de autenticidade da identidade
- São utilizadas como base para derivar outras credenciais no sistema

Estas credenciais formam a base do sistema de confiança, permitindo a emissão de credenciais derivadas com diferentes níveis de divulgação seletiva de informações (selective disclosure).

## Gestão e Revogação de Credenciais

O sistema implementa um mecanismo completo de gestão das credenciais emitidas, permitindo:

- Rastreamento de todas as credenciais emitidas e seu status atual
- Revogação de credenciais quando necessário (por exemplo, em caso de comprometimento, expiração ou mudança de status)
- Verificação do status de revogação durante o processo de validação
- Notificação aos portadores de credenciais sobre mudanças de status

Esta funcionalidade é essencial para manter a integridade do sistema de confiança, garantindo que apenas credenciais válidas e atualizadas sejam aceitas pelos verificadores.
