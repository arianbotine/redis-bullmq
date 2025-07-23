#!/bin/bash

# Script para parar todos os serviços da aplicação

echo "🛑 Parando serviços da PoC - Sistema de Ofertas"
echo "=============================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Parar containers Docker
log_info "Parando containers Docker..."
if docker-compose down --remove-orphans -v; then
    log_success "Containers Docker parados"
else
    log_warning "Erro ao parar containers Docker ou não há containers rodando"
fi

# Matar processos Node.js relacionados ao projeto (opcional)
log_info "Verificando processos Node.js..."

# Procurar por processos do NestJS na porta 3000
NEST_PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$NEST_PID" ]; then
    log_info "Parando aplicação NestJS (PID: $NEST_PID)..."
    kill $NEST_PID 2>/dev/null
    log_success "Aplicação NestJS parada"
else
    log_info "Nenhuma aplicação rodando na porta 3000"
fi

# Verificar processos worker
WORKER_PID=$(pgrep -f "worker.ts" 2>/dev/null)
if [ ! -z "$WORKER_PID" ]; then
    log_info "Parando worker Bull (PID: $WORKER_PID)..."
    kill $WORKER_PID 2>/dev/null
    log_success "Worker Bull parado"
else
    log_info "Nenhum worker Bull rodando"
fi

# Parar processos NestJS em background (nohup)
NEST_BACKGROUND=$(pgrep -f "npm run start:dev" 2>/dev/null)
if [ ! -z "$NEST_BACKGROUND" ]; then
    log_info "Parando aplicação NestJS em background (PID: $NEST_BACKGROUND)..."
    kill $NEST_BACKGROUND 2>/dev/null
    log_success "Aplicação NestJS em background parada"
fi

# Parar processos worker em background (nohup)
WORKER_BACKGROUND=$(pgrep -f "npm run start:worker" 2>/dev/null)
if [ ! -z "$WORKER_BACKGROUND" ]; then
    log_info "Parando worker Bull em background (PID: $WORKER_BACKGROUND)..."
    kill $WORKER_BACKGROUND 2>/dev/null
    log_success "Worker Bull em background parado"
fi

# Limpar arquivos de log se existirem
if [ -f "app.log" ]; then
    log_info "Removendo app.log..."
    rm -f app.log
fi

if [ -f "worker.log" ]; then
    log_info "Removendo worker.log..."
    rm -f worker.log
fi

echo ""
log_success "Todos os serviços foram parados!"
echo ""
echo "🔄 Para reiniciar:"
echo "   • Inicialização completa: ./start.sh"
echo "   • Reinício rápido: ./quick-start.sh"
echo "   • Apenas Docker: docker-compose up -d"
