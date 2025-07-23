# 🚀 PoC - Sistema de Ofertas de Rotas

Sistema de ofertas de rotas com notificações escaladas e processamento de jobs integrado usando NestJS, Bull, Redis e MongoDB.

## 📋 Características

- **✅ Aplicação Monolítica**: API e processamento de jobs integrados em uma única aplicação
- **✅ Notificações Escaladas**: Distribui notificações uniformemente ao longo da duração da oferta
- **✅ Processamento Confiável**: Jobs são processados apenas quando a aplicação está ativa
- **✅ Limpeza Automática**: Redis e MongoDB sincronizados adequadamente
- **✅ Interface Web**: Portal para criar e testar ofertas
- **✅ Logs Detalhados**: Monitoramento completo do processamento

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   NestJS App    │    │      Redis      │    │    MongoDB      │
│                 │    │                 │    │                 │
│ • REST API      │◄──►│ • Bull Queues   │    │ • Offers        │
│ • Jobs Processor│    │ • Job Storage   │◄──►│ • Notifications │
│ • Web Portal    │    │ • Status Cache  │    │ • Persistence   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Tecnologias

- **NestJS**: Framework backend
- **Bull/BullMQ**: Sistema de filas com Redis
- **Redis**: Cache e armazenamento de jobs  
- **MongoDB**: Persistência de dados
- **TypeScript**: Linguagem principal
- **Docker Compose**: Orquestração de serviços

## 🚀 Inicio Rápido

### 1️⃣ Inicialização Automática
```bash
# Inicia todos os serviços e a aplicação
./start.sh
```

### 2️⃣ Inicialização Manual
```bash
# 1. Iniciar serviços Docker
docker-compose up -d

# 2. Instalar dependências
npm install

# 3. Compilar aplicação
npm run build

# 4. Iniciar aplicação (com processamento integrado)
npm run start:dev
```

### 3️⃣ Parar Serviços
```bash
./stop.sh
```

## 🌐 Endpoints da API

### Ofertas
- **POST** `/offers` - Criar nova oferta
- **GET** `/offers` - Listar todas as ofertas
- **GET** `/offers/:id` - Obter oferta específica
- **POST** `/offers/:id/accept` - Aceitar oferta
- **GET** `/offers/:id/notifications` - Ver histórico de notificações

### Portal Web
- **GET** `/` - Portal web para testes

## 📊 Exemplo de Uso

### Criar Oferta
```bash
curl -X POST http://localhost:3000/offers \
  -H "Content-Type: application/json" \
  -d '{
    "routeId": "route-123",
    "durationMinutes": 30,
    "drivers": ["driver1", "driver2", "driver3", "driver4", "driver5"]
  }'
```

### Aceitar Oferta
```bash
curl -X POST http://localhost:3000/offers/{id}/accept \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver1"}'
```

## 🔧 Funcionamento do Sistema

### 1. **Criação de Oferta**
- Salva no MongoDB com status `pending`
- Cria chave de status no Redis
- Agenda jobs de notificação distribuídos no tempo
- Agenda job de expiração

### 2. **Processamento de Notificações**
- Jobs executados apenas com aplicação ativa
- Notificações simuladas via logs (REST API externa)
- Registro no MongoDB de motoristas notificados
- Verificação de status antes de notificar

### 3. **Expiração de Ofertas**
- Job de expiração executado apenas pela aplicação
- Verificação atômica de status usando script LUA
- Limpeza completa do Redis quando expira
- Atualização do MongoDB para `expired`

### 4. **Aceitação de Ofertas**
- Atualização imediata no MongoDB
- Limpeza de todas as chaves Redis relacionadas
- Cancelamento de jobs pendentes

## 🚦 Estados da Oferta

- **`pending`**: Aguardando aceitação
- **`accepted`**: Aceita por um motorista  
- **`expired`**: Expirou sem aceitação

## 🎯 Principais Melhorias Implementadas

### ✅ **Bug de Expiração Corrigido**
- Ofertas só expiram com aplicação ativa
- Consistência entre Redis e MongoDB garantida
- Script LUA para operações atômicas

### ✅ **Arquitetura Simplificada**
- Worker integrado na aplicação principal
- Eliminação de processos separados desnecessários
- Configuração mais simples e confiável

### ✅ **Monitoramento Aprimorado**
- Logs detalhados em todas as operações
- Tracking completo do ciclo de vida das ofertas
- Debugging facilitado

## 🐛 Testes

### Teste Manual via Portal
1. Abra http://localhost:3000
2. Crie uma oferta
3. Observe as notificações nos logs
4. Teste aceitação ou aguarde expiração

### Teste via API
```bash
# Criar oferta
OFFER_ID=$(curl -s -X POST http://localhost:3000/offers \
  -H "Content-Type: application/json" \
  -d '{"routeId":"test-123","durationMinutes":30,"drivers":["d1","d2"]}' \
  | jq -r '._id')

# Verificar status
curl -s http://localhost:3000/offers/$OFFER_ID | jq '.status'

# Aceitar oferta
curl -X POST http://localhost:3000/offers/$OFFER_ID/accept \
  -H "Content-Type: application/json" \
  -d '{"driverId": "d1"}'
```

## 📁 Estrutura do Projeto

```
src/
├── app.module.ts           # Módulo principal da aplicação
├── main.ts                 # Bootstrap da aplicação NestJS
├── database/               # Configuração do MongoDB
├── jobs/                   # Módulo de processamento de jobs
│   ├── jobs.module.ts      # Configuração Bull/Redis
│   └── jobs.processor.ts   # Processadores de jobs
└── offers/                 # Módulo de ofertas
    ├── offers.controller.ts # REST API endpoints
    ├── offers.service.ts    # Lógica de negócio
    ├── notification.service.ts # Simulação de API externa  
    └── schemas/offer.schema.ts # Schema MongoDB

public/
└── index.html              # Portal web para testes

scripts/
├── start.sh                # Script de inicialização
├── stop.sh                 # Script para parar serviços
└── test-bug-fix.sh         # Teste de correção de bugs
```

## 🎉 Conclusão

Esta aplicação demonstra uma arquitetura robusta e simplificada para processamento de ofertas com:

- **Confiabilidade**: Processamento apenas com aplicação ativa
- **Consistência**: Sincronização Redis/MongoDB garantida  
- **Simplicidade**: Arquitetura monolítica bem estruturada
- **Observabilidade**: Logs detalhados para debugging
- **Testabilidade**: Interface web e API REST para testes

O sistema está pronto para ser usado como base para implementações em produção! 🚀
