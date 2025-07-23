#!/bin/bash

# Script de teste para a PoC de Ofertas de Rotas

echo "🚀 Iniciando testes da PoC - Sistema de Ofertas de Rotas"
echo "=============================================="

# Função para testar se um serviço está rodando
test_service() {
    local service=$1
    local port=$2
    local name=$3
    
    if nc -z localhost $port 2>/dev/null; then
        echo "✅ $name está rodando na porta $port"
        return 0
    else
        echo "❌ $name não está rodando na porta $port"
        return 1
    fi
}

echo ""
echo "📋 Verificando serviços necessários..."

# Testa MongoDB
if test_service "mongodb" 27017 "MongoDB"; then
    MONGO_OK=1
else
    MONGO_OK=0
    echo "   Para instalar MongoDB: sudo apt install mongodb"
fi

# Testa Redis
if test_service "redis" 6379 "Redis"; then
    REDIS_OK=1
else
    REDIS_OK=0
    echo "   Para instalar Redis: sudo apt install redis-server"
fi

# Verifica se a aplicação está rodando
if test_service "app" 3000 "Aplicação NestJS"; then
    APP_OK=1
else
    APP_OK=0
    echo "   Para iniciar: npm run start:dev"
fi

echo ""

if [[ $MONGO_OK -eq 1 && $REDIS_OK -eq 1 && $APP_OK -eq 1 ]]; then
    echo "🎯 Executando testes da API..."
    echo ""
    
    # Teste 1: Criar oferta
    echo "📤 Teste 1: Criando oferta..."
    OFFER_RESPONSE=$(curl -s -X POST http://localhost:3000/offers \
        -H "Content-Type: application/json" \
        -d '{
            "routeId": "R123",
            "drivers": ["driver1", "driver2", "driver3"],
            "durationMinutes": 2
        }')
    
    if echo "$OFFER_RESPONSE" | jq . > /dev/null 2>&1; then
        echo "✅ Oferta criada com sucesso!"
        OFFER_ID=$(echo "$OFFER_RESPONSE" | jq -r '._id')
        echo "   ID da oferta: $OFFER_ID"
        echo "   Resposta: $OFFER_RESPONSE"
    else
        echo "❌ Falha ao criar oferta"
        echo "   Resposta: $OFFER_RESPONSE"
        exit 1
    fi
    
    echo ""
    
    # Aguarda um pouco para garantir que a oferta foi processada
    echo "⏳ Aguardando 2 segundos..."
    sleep 2
    
    # Teste 2: Aceitar oferta
    echo "📥 Teste 2: Aceitando oferta..."
    ACCEPT_RESPONSE=$(curl -s -X POST http://localhost:3000/offers/$OFFER_ID/accept \
        -H "Content-Type: application/json" \
        -d '{"driverId": "driver1"}')
    
    if echo "$ACCEPT_RESPONSE" | jq . > /dev/null 2>&1; then
        echo "✅ Oferta aceita com sucesso!"
        echo "   Resposta: $ACCEPT_RESPONSE"
    else
        echo "❌ Falha ao aceitar oferta"
        echo "   Resposta: $ACCEPT_RESPONSE"
    fi
    
    echo ""
    
    # Teste 3: Tentar aceitar novamente (deve falhar)
    echo "🔄 Teste 3: Tentando aceitar oferta novamente (deve falhar)..."
    ACCEPT_AGAIN_RESPONSE=$(curl -s -X POST http://localhost:3000/offers/$OFFER_ID/accept \
        -H "Content-Type: application/json" \
        -d '{"driverId": "driver2"}')
    
    if echo "$ACCEPT_AGAIN_RESPONSE" | grep -q "409"; then
        echo "✅ Conflito detectado corretamente (409)!"
        echo "   Resposta: $ACCEPT_AGAIN_RESPONSE"
    else
        echo "⚠️  Resposta inesperada:"
        echo "   Resposta: $ACCEPT_AGAIN_RESPONSE"
    fi
    
    echo ""
    echo "🎉 Testes concluídos!"
    
else
    echo ""
    echo "❌ Nem todos os serviços estão rodando. Execute os comandos necessários primeiro."
    echo ""
    echo "🔧 Comandos para preparar o ambiente:"
    echo "   1. Instalar dependências: npm install"
    echo "   2. Iniciar MongoDB: sudo service mongodb start"
    echo "   3. Iniciar Redis: sudo service redis-server start"  
    echo "   4. Iniciar aplicação: npm run start:dev"
    echo "   5. Iniciar worker (outro terminal): npm run start:worker"
fi
