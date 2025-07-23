import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Serviço Redis otimizado para alto volume com pool de conexões
 * e operações atômicas para evitar condições de corrida.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis;
  private isReady: boolean = false;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      
      // Pool de conexões otimizado para alto volume
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      
      // Timeouts otimizados
      connectTimeout: 10000,
      commandTimeout: 5000,
      
      // Pool settings
      enableReadyCheck: true,
      
      // Configurações de performance - CORRIGIDO
      enableOfflineQueue: true, // Permitir fila offline para evitar falhas
    });
    
    // Event listeners para monitoramento
    this.redis.on('connect', () => {
      console.log('🔴 [REDIS] Conectado com sucesso');
    });
    
    this.redis.on('error', (err) => {
      console.error('❌ [REDIS] Erro de conexão:', err.message);
      this.isReady = false;
    });
    
    this.redis.on('ready', () => {
      console.log('✅ [REDIS] Pronto para receber comandos');
      this.isReady = true;
    });
    
    this.redis.on('reconnecting', () => {
      console.log('🔄 [REDIS] Reconectando...');
      this.isReady = false;
    });
    
    // Inicializar conexão manualmente
    this.initializeConnection();
  }
  
  /**
   * Inicializa conexão Redis
   */
  private initializeConnection(): void {
    // Usar setTimeout para evitar aviso do linter sobre async no constructor
    setTimeout(async () => {
      try {
        await this.redis.connect();
      } catch (error) {
        console.error('❌ [REDIS] Erro ao conectar:', error.message);
      }
    }, 0);
  }
  
  /**
   * Aguarda Redis estar pronto antes de executar comandos
   */
  private async waitForReady(timeoutMs: number = 10000): Promise<void> {
    if (this.isReady) return;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout esperando Redis ficar pronto'));
      }, timeoutMs);
      
      const checkReady = () => {
        if (this.isReady) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }
  
  /**
   * Obtém a instância Redis
   */
  getInstance(): Redis {
    return this.redis;
  }
  
  /**
   * Script LUA para operação atômica de mudança de status
   * Evita condições de corrida em ambientes com múltiplas instâncias
   */
  async atomicStatusChange(offerId: string, fromStatus: string, toStatus: string): Promise<boolean> {
    await this.waitForReady();
    
    const luaScript = `
      local key = KEYS[1]
      local fromStatus = ARGV[1]
      local toStatus = ARGV[2]
      
      local currentStatus = redis.call('GET', key)
      if currentStatus == fromStatus then
        redis.call('SET', key, toStatus)
        return 1
      end
      return 0
    `;
    
    const result = await this.redis.eval(
      luaScript,
      1,
      `offer:${offerId}:status`,
      fromStatus,
      toStatus
    ) as number;
    
    return result === 1;
  }
  
  /**
   * Limpeza atômica de chaves Redis usando pattern matching
   * Operação otimizada para alto volume com LUA script
   */
  async atomicCleanupKeys(patterns: string[]): Promise<number> {
    await this.waitForReady();
    
    const luaScript = `
      local totalDeleted = 0
      for i = 1, #ARGV do
        local pattern = ARGV[i]
        local keys = redis.call('KEYS', pattern)
        if #keys > 0 then
          totalDeleted = totalDeleted + redis.call('DEL', unpack(keys))
        end
      end
      return totalDeleted
    `;
    
    const result = await this.redis.eval(luaScript, 0, ...patterns) as number;
    return result;
  }
  
  /**
   * Get com timeout para evitar bloqueios
   */
  async getWithTimeout(key: string, timeoutMs: number = 5000): Promise<string | null> {
    await this.waitForReady();
    
    return Promise.race([
      this.redis.get(key),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Redis GET timeout')), timeoutMs)
      )
    ]);
  }
  
  /**
   * Set com opções otimizadas
   */
  async setOptimized(key: string, value: string, ttlSeconds?: number): Promise<string> {
    await this.waitForReady();
    
    if (ttlSeconds) {
      return this.redis.setex(key, ttlSeconds, value);
    }
    return this.redis.set(key, value);
  }
  
  /**
   * Pipeline para operações em lote (melhor performance)
   */
  createPipeline() {
    return this.redis.pipeline();
  }
  
  /**
   * Fechar conexão no shutdown da aplicação
   */
  async onModuleDestroy() {
    console.log('🔴 [REDIS] Fechando conexão...');
    await this.redis.quit();
  }
}