#!/bin/bash

echo "🌐 PoC - Sistema de Ofertas com Portal Web Redis"
echo "=============================================="
echo ""
echo "✅ Redis Commander Portal Web configurado!"
echo ""

echo "📊 Informações dos serviços:"
echo "   🚀 API NestJS:       http://localhost:3000"
echo "   🌐 Redis Commander:  http://localhost:8081"
echo "   📊 Login Redis:      admin / admin"
echo ""

# Verificar se os serviços estão rodando
echo "🔍 Verificando serviços..."

# Teste API
if curl -s http://localhost:3000/offers > /dev/null 2>&1; then
    echo "   ✅ API NestJS: Online"
else
    echo "   ❌ API NestJS: Offline (execute: npm run start:dev)"
fi

# Teste Redis Commander
if curl -s http://localhost:8081 > /dev/null 2>&1; then
    echo "   ✅ Redis Commander: Online"
else
    echo "   ❌ Redis Commander: Offline (execute: docker-compose up -d)"
fi

echo ""

# Criar oferta para demonstração
echo "📝 Criando oferta de demonstração..."
RESPONSE=$(curl -s -X POST http://localhost:3000/offers \
  -H "Content-Type: application/json" \
  -d '{"routeId": "DEMO_PORTAL", "drivers": ["web_user", "portal_admin"], "durationMinutes": 2}')

if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
    OFFER_ID=$(echo "$RESPONSE" | jq -r '._id')
    echo "   ✅ Oferta criada: $OFFER_ID"
    echo ""
    echo "🔍 No Redis Commander você pode ver:"
    echo "   🔑 Chave: offer:$OFFER_ID:status"
    echo "   ⏰ TTL: ~3 minutos (durationMinutes + 5)"
    echo "   📊 Filas Bull: bull:offers:*"
    echo ""
    echo "📋 Para acessar o Redis Commander:"
    echo "   1. Abra: http://localhost:8081"
    echo "   2. Login: admin / admin"
    echo "   3. Procure pela chave: offer:$OFFER_ID:status"
    echo "   4. Veja o valor: 'pending'"
    echo "   5. Observe o TTL diminuindo"
else
    echo "   ❌ Falha ao criar oferta"
fi

echo ""
echo "🎯 Demo Redis Commander pronto para uso!"
