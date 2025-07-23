#!/bin/bash

# Script de inicialização completa do projeto
# PoC - Sistema de Ofertas de Rotas de Entrega

set -e  # Para o script se houver erro

echo "🚀 Inicializando PoC - Sistema de Ofertas de Rotas"
echo "=================================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Função para detectar terminal disponível
detect_terminal() {
    if command -v gnome-terminal &> /dev/null; then
        echo "gnome-terminal"
    elif command -v xterm &> /dev/null; then
        echo "xterm"
    elif command -v konsole &> /dev/null; then
        echo "konsole"
    elif command -v terminator &> /dev/null; then
        echo "terminator"
    else
        echo "none"
    fi
}

# Função para testar se um serviço está rodando
test_service() {
    local port=$1
    local name=$2
    
    if command -v nc >/dev/null 2>&1; then
        if nc -z localhost $port 2>/dev/null; then
            log_success "$name está rodando na porta $port"
            return 0
        else
            log_error "$name não está rodando na porta $port"
            return 1
        fi
    else
        log_warning "netcat não instalado, não é possível verificar porta $port"
        return 0
    fi
}

# Verificar pré-requisitos
echo "🔍 Verificando pré-requisitos..."

# Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js não está instalado!"
    echo "   Instale Node.js 18+ antes de continuar"
    exit 1
else
    NODE_VERSION=$(node --version)
    log_success "Node.js instalado: $NODE_VERSION"
fi

# npm
if ! command -v npm &> /dev/null; then
    log_error "npm não está instalado!"
    exit 1
else
    NPM_VERSION=$(npm --version)
    log_success "npm instalado: $NPM_VERSION"
fi

# Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker não está instalado!"
    echo "   Instale Docker antes de continuar"
    exit 1
else
    log_success "Docker instalado"
fi

# Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose não está instalado!"
    echo "   Instale Docker Compose antes de continuar"
    exit 1
else
    log_success "Docker Compose disponível"
fi

echo ""

# Passo 0: Parar serviços existentes
log_info "0️⃣ Parando serviços existentes..."

if [ -f "./stop.sh" ]; then
    log_info "Executando script de parada..."
    ./stop.sh > /dev/null 2>&1 || true
    log_success "Serviços anteriores parados"
    sleep 2
else
    log_warning "Script stop.sh não encontrado, parando serviços manualmente..."
    # Parar containers Docker
    docker-compose down --remove-orphans 2>/dev/null || true
    # Matar processos Node.js na porta 3000
    lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
    # Matar processos worker
    pgrep -f "worker.ts" 2>/dev/null | xargs kill -9 2>/dev/null || true
    log_success "Limpeza manual concluída"
fi

echo ""

# Passo 1: Instalar dependências
log_info "1️⃣ Instalando dependências do Node.js..."

if [ -d "node_modules" ]; then
    log_warning "node_modules já existe, pulando npm install"
else
    npm install
    log_success "Dependências instaladas com sucesso"
fi

echo ""

# Passo 2: Verificar e iniciar Docker services
log_info "2️⃣ Iniciando serviços Docker (MongoDB, Redis, Redis Commander)..."

# Iniciar containers (já fizemos limpeza no passo 0)
docker-compose up -d

# Aguardar um pouco para os serviços iniciarem
log_info "Aguardando serviços iniciarem..."

# Aguardar com timeout inteligente
max_wait=30
wait_time=0
while [ $wait_time -lt $max_wait ]; do
    if nc -z localhost 27017 2>/dev/null && nc -z localhost 6379 2>/dev/null; then
        log_success "Serviços principais detectados!"
        break
    fi
    sleep 2
    wait_time=$((wait_time + 2))
    echo -n "."
done

if [ $wait_time -ge $max_wait ]; then
    log_warning "Timeout ao aguardar serviços, mas continuando..."
fi

echo ""

# Verificar se os serviços Docker estão rodando
log_info "Verificando serviços Docker..."

if test_service 27017 "MongoDB"; then
    MONGO_OK=1
else
    MONGO_OK=0
fi

if test_service 6379 "Redis"; then
    REDIS_OK=1
else
    REDIS_OK=0
fi

if test_service 8081 "Redis Commander"; then
    COMMANDER_OK=1
else
    COMMANDER_OK=0
fi

if [ $MONGO_OK -eq 0 ] || [ $REDIS_OK -eq 0 ]; then
    log_error "Falha ao iniciar serviços essenciais. Verifique o Docker."
    echo "   Tente: docker-compose logs"
    exit 1
fi

echo ""

# Passo 3: Compilar aplicação
log_info "3️⃣ Compilando aplicação TypeScript..."
npm run build
log_success "Aplicação compilada com sucesso"

echo ""

# Passo 4: Exibir informações finais
echo "🎉 INICIALIZAÇÃO COMPLETA!"
echo "========================="
echo ""
echo "📊 Status dos serviços:"
if [ $MONGO_OK -eq 1 ]; then
    echo "   ✅ MongoDB:         http://localhost:27017"
else
    echo "   ❌ MongoDB:         FALHA"
fi

if [ $REDIS_OK -eq 1 ]; then
    echo "   ✅ Redis:           http://localhost:6379"
else
    echo "   ❌ Redis:           FALHA"
fi

if [ $COMMANDER_OK -eq 1 ]; then
    echo "   ✅ Redis Commander: http://localhost:8081 (admin/admin)"
else
    echo "   ⚠️  Redis Commander: Offline"
fi

echo ""
echo "🚀 Para iniciar a aplicação principal:"
echo "   npm run start:dev"
echo ""
echo "🔧 Para iniciar o worker (opcional, em terminal separado):"
echo "   npm run start:worker"
echo ""
echo "🧪 Para executar testes:"
echo "   ./test.sh"
echo ""
echo "📖 Endpoints disponíveis após iniciar a aplicação:"
echo "   • POST http://localhost:3000/offers - Criar oferta"
echo "   • POST http://localhost:3000/offers/:id/accept - Aceitar oferta"
echo "   • GET  http://localhost:3000/offers - Listar ofertas"
echo ""

# Opção para iniciar as aplicações automaticamente
read -p "🤔 Deseja iniciar a aplicação e o worker automaticamente agora? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Iniciando aplicação NestJS e Worker Bull em terminais separados..."
    echo ""
    
    # Detectar terminal disponível
    TERMINAL=$(detect_terminal)
    
    if [ "$TERMINAL" = "none" ]; then
        log_warning "Nenhum terminal gráfico detectado. Iniciando em background..."
        echo ""
        echo "🔥 Aplicações iniciando em modo background..."
        echo "   📱 Aplicação Principal: http://localhost:3000"
        echo "   🔧 Worker Bull: Processamento em background (log: worker.log)"
        echo "   🌐 Redis Commander: http://localhost:8081 (admin/admin)"
        echo ""
        echo "💡 Dica: Use './stop.sh' para parar as aplicações"
        echo ""
        
        # Iniciar worker em background
        log_info "Iniciando Worker Bull em background..."
        nohup npm run start:worker > worker.log 2>&1 &
        WORKER_PID=$!
        log_success "Worker Bull iniciado (PID: $WORKER_PID, log: worker.log)"
        
        # Aguardar um pouco para o worker inicializar
        sleep 3
        
        # Iniciar aplicação principal em background
        log_info "Iniciando aplicação principal em background..."
        nohup npm run start:dev > app.log 2>&1 &
        APP_PID=$!
        log_success "Aplicação principal iniciada (PID: $APP_PID, log: app.log)"
        
        echo ""
        log_success "Ambas as aplicações foram iniciadas em background!"
        echo ""
        echo "📋 Para monitorar:"
        echo "   • Worker logs: tail -f worker.log"
        echo "   • Aplicação logs: tail -f app.log"
        echo "   • Parar tudo: ./stop.sh"
        
    else
        echo "🔥 Abrindo aplicações em terminais separados..."
        echo "   📱 Aplicação Principal: http://localhost:3000"
        echo "   🔧 Worker Bull: Processamento em background"
        echo "   🌐 Redis Commander: http://localhost:8081 (admin/admin)"
        echo ""
        echo "💡 Dica: Feche os terminais ou use Ctrl+C em cada um para parar"
        echo ""
        
        # Aguardar um pouco para mostrar as mensagens
        sleep 2
        
        # Iniciar worker em terminal separado
        log_info "Abrindo Worker Bull em novo terminal..."
        case $TERMINAL in
            "gnome-terminal")
                gnome-terminal --title="Worker Bull - PoC Ofertas" -- bash -c "echo '🔧 Iniciando Worker Bull...'; echo 'Use Ctrl+C para parar'; echo ''; npm run start:worker; read -p 'Pressione Enter para fechar...'"
                ;;
            "xterm")
                xterm -title "Worker Bull - PoC Ofertas" -e "bash -c 'echo \"🔧 Iniciando Worker Bull...\"; echo \"Use Ctrl+C para parar\"; echo \"\"; npm run start:worker; read -p \"Pressione Enter para fechar...\"'" &
                ;;
            "konsole")
                konsole --title "Worker Bull - PoC Ofertas" -e bash -c "echo '🔧 Iniciando Worker Bull...'; echo 'Use Ctrl+C para parar'; echo ''; npm run start:worker; read -p 'Pressione Enter para fechar...'" &
                ;;
            "terminator")
                terminator --title="Worker Bull - PoC Ofertas" -e "bash -c 'echo \"🔧 Iniciando Worker Bull...\"; echo \"Use Ctrl+C para parar\"; echo \"\"; npm run start:worker; read -p \"Pressione Enter para fechar...\"'" &
                ;;
        esac
        
        # Aguardar um pouco para o worker inicializar
        sleep 3
        
        # Iniciar aplicação principal em terminal separado
        log_info "Abrindo Aplicação Principal em novo terminal..."
        case $TERMINAL in
            "gnome-terminal")
                gnome-terminal --title="Aplicação NestJS - PoC Ofertas" -- bash -c "echo '🚀 Iniciando Aplicação NestJS...'; echo 'Acesse: http://localhost:3000'; echo 'Use Ctrl+C para parar'; echo ''; npm run start:dev; read -p 'Pressione Enter para fechar...'"
                ;;
            "xterm")
                xterm -title "Aplicação NestJS - PoC Ofertas" -e "bash -c 'echo \"🚀 Iniciando Aplicação NestJS...\"; echo \"Acesse: http://localhost:3000\"; echo \"Use Ctrl+C para parar\"; echo \"\"; npm run start:dev; read -p \"Pressione Enter para fechar...\"'" &
                ;;
            "konsole")
                konsole --title "Aplicação NestJS - PoC Ofertas" -e bash -c "echo '🚀 Iniciando Aplicação NestJS...'; echo 'Acesse: http://localhost:3000'; echo 'Use Ctrl+C para parar'; echo ''; npm run start:dev; read -p 'Pressione Enter para fechar...'" &
                ;;
            "terminator")
                terminator --title="Aplicação NestJS - PoC Ofertas" -e "bash -c 'echo \"🚀 Iniciando Aplicação NestJS...\"; echo \"Acesse: http://localhost:3000\"; echo \"Use Ctrl+C para parar\"; echo \"\"; npm run start:dev; read -p \"Pressione Enter para fechar...\"'" &
                ;;
        esac
        
        echo ""
        log_success "Ambos os terminais foram abertos!"
        echo ""
        echo "📋 Os terminais devem estar abertos agora:"
        echo "   • Terminal 1: Worker Bull (processamento em background)"
        echo "   • Terminal 2: Aplicação NestJS (API na porta 3000)"
        echo ""
        echo "💡 Para parar tudo use: ./stop.sh"
    fi
else
    echo ""
    log_info "OK! Use os comandos acima quando estiver pronto."
    echo ""
    echo "💡 Para iniciar ambos simultaneamente:"
    echo "   Terminal 1: npm run start:dev"
    echo "   Terminal 2: npm run start:worker"
fi
