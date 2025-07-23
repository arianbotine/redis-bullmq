# PoC - Sistema de Ofertas de Rotas de Entrega (NestJS, Redis, Bull, MongoDB)

## ✅ Status do Projeto

**PROJETO TESTADO E FUNCIONANDO!** ✅

- ✅ Compilação bem-sucedida
- ✅ MongoDB e Redis rodando via Docker
- ✅ Aplicação NestJS iniciada corretamente
- ✅ Endpoints de criação e aceite funcionando
- ✅ Controle de atomicidade implementado (Redis + LUA)
- ✅ Integração MongoDB + Redis + Bull funcionando

## Visão Geral

Esta Prova de Conceito (PoC) implementa uma arquitetura híbrida para gerenciamento de ofertas de rotas de entrega, combinando operações em tempo real (Redis + Bull) e persistência definitiva (MongoDB). A comunicação com motoristas ocorre via WebSocket.

## Estrutura do Projeto

```
src/
  app.module.ts
  main.ts
  database/
    database.module.ts
  jobs/
    jobs.module.ts
    jobs.processor.ts
  offers/
    offers.module.ts
    offers.controller.ts
    offers.service.ts
    offers.gateway.ts
    schemas/
      offer.schema.ts
  worker.ts
```

## Variáveis de Ambiente

- `MONGO_URI`: URI de conexão do MongoDB (ex: `mongodb://localhost:27017/offers`)
- `REDIS_HOST`: Host do Redis (ex: `localhost`)
- `REDIS_PORT`: Porta do Redis (ex: `6379`)

## Execução RÁPIDA (Ambiente Testado)

### 1. Pré-requisitos

- Node.js 18+
- Docker e Docker Compose

### 2. Configuração e Execução

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar MongoDB, Redis e Redis Commander (Docker)
docker-compose up -d

# 3. Iniciar aplicação NestJS
npm run start:dev

# 4. Acessar as interfaces:
# - Aplicação: http://localhost:3000
# - Redis Commander (Web): http://localhost:8081
#   - Usuário: admin
#   - Senha: admin
```

### 3. Testes Validados ✅

```bash
# Criar oferta (testado ✅)
curl -X POST http://localhost:3000/offers \
  -H "Content-Type: application/json" \
  -d '{"routeId": "R123", "drivers": ["driver1", "driver2"], "durationMinutes": 2}'

# Aceitar oferta (testado ✅) - substitua OFFER_ID pelo ID retornado
curl -X POST http://localhost:3000/offers/OFFER_ID/accept \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver1"}'

# Tentar aceitar novamente (retorna 409 Conflict ✅)
curl -X POST http://localhost:3000/offers/OFFER_ID/accept \
  -H "Content-Type: application/json" \
  -d '{"driverId": "driver2"}'
```

### 4. 🌐 Portal Web Redis Commander ✅

Acesse **http://localhost:8081** para visualizar:
- ✅ Chaves Redis em tempo real
- ✅ Status das ofertas (`offer:*:status`)
- ✅ TTL das chaves
- ✅ Filas Bull (`bull:offers:*`)
- ✅ Interface amigável para debug

## Arquitetura Implementada ✅

### Fluxo de Dados Validado:

1. **Criação de Oferta** ✅
   - MongoDB: Persiste oferta com status 'pending'
   - Redis: Cria chave de controle com TTL
   - Bull: Agenda jobs de notificação escalonada

2. **Aceite Atomico** ✅
   - Redis: Script LUA garante atomicidade
   - Bull: Cancela jobs futuros
   - MongoDB: Atualiza status assincronamente
   - WebSocket: Notifica em tempo real

3. **Controle de Conflitos** ✅
   - Retorna 409 Conflict para ofertas já aceitas
   - Impede duplo aceite via Redis atômico

## Tecnologias Utilizadas

- **Framework**: NestJS ✅
- **Linguagem**: TypeScript ✅
- **BD Persistente**: MongoDB (Docker) ✅
- **BD em Memória**: Redis (Docker) ✅
- **Filas**: Bull (não BullMQ) ✅
- **WebSockets**: Socket.IO ✅
