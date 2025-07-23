import { Injectable, OnModuleInit } from '@nestjs/common';
import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { NotificationService } from '../offers/notification.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';
import { RedisService } from '../redis/redis.service';
import { MongoOptimizedService } from '../database/mongo-optimized.service';

/**
 * Processador dos trabalhos Bull otimizado para alto volume.
 * Implementa circuit breakers, operações em lote e retry com backoff.
 */
@Injectable()
@Processor('offers')
export class JobsProcessor implements OnModuleInit {
  private readonly circuitBreaker = {
    redis: { failures: 0, threshold: 5, timeout: 30000, lastFailure: 0 },
    mongo: { failures: 0, threshold: 3, timeout: 20000, lastFailure: 0 }
  };

  constructor(
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
    private readonly mongoService: MongoOptimizedService,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectQueue('offers') private readonly offersQueue: Queue,
  ) {
    console.log('🚀 [JOBS-PROCESSOR] JobsProcessor inicializado com sucesso');
    
    // Adicionar listeners para debug
    this.offersQueue.on('completed', (job) => {
      console.log(`✅ [QUEUE] Job ${job.id} completado com sucesso`);
    });
    
    this.offersQueue.on('failed', (job, err) => {
      console.log(`❌ [QUEUE] Job ${job.id} falhou:`, err.message);
    });
    
    this.offersQueue.on('active', (job) => {
      console.log(`🔄 [QUEUE] Job ${job.id} está sendo processado`);
    });
    
    this.offersQueue.on('waiting', (jobId) => {
      console.log(`⏳ [QUEUE] Job ${jobId} adicionado à fila de espera`);
    });
  }

  /**
   * Método executado após a inicialização do módulo
   */
  async onModuleInit() {
    console.log('🔄 [JOBS-PROCESSOR] OnModuleInit executado - Worker pronto para processar jobs');
    console.log('🔍 [JOBS-PROCESSOR] Verificando se há jobs pendentes para processar...');
    
    // Verificar estado da fila
    try {
      const waiting = await this.offersQueue.getWaiting();
      const active = await this.offersQueue.getActive();
      const completed = await this.offersQueue.getCompleted();
      const failed = await this.offersQueue.getFailed();
      
      console.log(`📊 [QUEUE-STATUS] Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}, Failed: ${failed.length}`);
      
      if (waiting.length > 0) {
        console.log('🔍 [QUEUE-STATUS] Jobs em espera:', waiting.map(j => `${j.name}:${j.id}`));
      }
    } catch (error) {
      console.log('❌ [QUEUE-STATUS] Erro ao verificar status da fila:', error.message);
    }
    
    // Log adicional para debug - versão 3
    setTimeout(() => {
      console.log('🕐 [JOBS-PROCESSOR] Worker ativo há 5 segundos, verificando status v3...');
    }, 5000);
  }

  /**
   * Circuit breaker para operações Redis
   */
  private async withRedisCircuitBreaker<T>(operation: () => Promise<T>): Promise<T | null> {
    const breaker = this.circuitBreaker.redis;
    const now = Date.now();
    
    // Se circuit breaker está aberto, verificar se deve tentar novamente
    if (breaker.failures >= breaker.threshold) {
      if (now - breaker.lastFailure < breaker.timeout) {
        console.log('⚡ [CIRCUIT-BREAKER] Redis circuit breaker ABERTO');
        return null;
      }
      // Reset do circuit breaker após timeout
      breaker.failures = 0;
    }
    
    try {
      const result = await operation();
      breaker.failures = 0; // Reset em caso de sucesso
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = now;
      console.error(`❌ [CIRCUIT-BREAKER] Redis falha ${breaker.failures}/${breaker.threshold}:`, error.message);
      return null;
    }
  }

  /**
   * Circuit breaker para operações MongoDB
   */
  private async withMongoCircuitBreaker<T>(operation: () => Promise<T>): Promise<T | null> {
    const breaker = this.circuitBreaker.mongo;
    const now = Date.now();
    
    if (breaker.failures >= breaker.threshold) {
      if (now - breaker.lastFailure < breaker.timeout) {
        console.log('⚡ [CIRCUIT-BREAKER] MongoDB circuit breaker ABERTO');
        return null;
      }
      breaker.failures = 0;
    }
    
    try {
      const result = await operation();
      breaker.failures = 0;
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = now;
      console.error(`❌ [CIRCUIT-BREAKER] MongoDB falha ${breaker.failures}/${breaker.threshold}:`, error.message);
      return null;
    }
  }

  /**
   * Processa o trabalho de notificação de motoristas via API REST.
   * Otimizado para alto volume com operações em lote.
   * @param job Job Bull
   */
  @Process('notify-drivers')
  async handleNotifyDrivers(job: Job) {
    console.log(`🎯 [WORKER] INICIANDO processamento de notificação - Job ID: ${job.id}, Dados:`, job.data);
    const { offerId, drivers, driverIndex } = job.data;
    console.log(`📱 [WORKER] Processando notificação LOTE: oferta ${offerId}, ${drivers.length} motoristas (índice ${driverIndex})`);
    
    // Verificar status com circuit breaker
    const status = await this.withRedisCircuitBreaker(async () => {
      return await this.redisService.getWithTimeout(`offer:${offerId}:status`, 3000);
    });
    
    if (!status) {
      console.log(`⚠️ [WORKER] Não foi possível verificar status da oferta ${offerId} - Redis indisponível`);
      throw new Error('Redis indisponível para verificação de status');
    }
    
    if (status === 'pending') {
      // Simular notificação para sistema externo via API REST
      await this.notificationService.notifyDrivers(offerId, drivers);
      
      // Preparar notificações em lote (OTIMIZAÇÃO CRÍTICA)
      const notificationTime = new Date();
      const notifications = drivers.map(driverId => ({
        driverId,
        notifiedAt: notificationTime
      }));
      
      // Usar operação em lote otimizada do MongoDB
      const success = await this.withMongoCircuitBreaker(async () => {
        return await this.mongoService.bulkNotificationUpdate(offerId, notifications);
      });
      
      if (success) {
        console.log(`✅ [WORKER] ${notifications.length} notificações registradas em LOTE no MongoDB: ${notificationTime.toISOString()}`);
      } else {
        console.log(`❌ [WORKER] Falha ao registrar notificações em lote para oferta ${offerId}`);
        throw new Error('Falha na atualização MongoDB em lote');
      }
    } else {
      console.log(`⚠️ [WORKER] Oferta ${offerId} não está mais 'pending' (status: ${status}). Notificação cancelada.`);
    }
  }

  /**
   * Processa o trabalho de expiração de oferta.
   * Operação atômica otimizada para alta concorrência.
   * @param job Job Bull
   */
  @Process('expire-offer')
  async handleExpireOffer(job: Job) {
    console.log(`🎯 [WORKER] INICIANDO processamento de expiração - Job ID: ${job.id}, Dados:`, job.data);
    const { offerId } = job.data;
    console.log(`⏰ [WORKER] Processando expiração da oferta: ${offerId}`);
    
    // Usar operação atômica do Redis Service (OTIMIZAÇÃO CRÍTICA)
    const redisSuccess = await this.withRedisCircuitBreaker(async () => {
      return await this.redisService.atomicStatusChange(offerId, 'pending', 'expired');
    });
    
    if (redisSuccess) {
      console.log(`✅ [WORKER] Oferta ${offerId} expirada no Redis - atualizando MongoDB`);
      
      // Usar operação atômica do MongoDB (PREVENÇÃO DE CONDIÇÃO DE CORRIDA)
      const mongoSuccess = await this.withMongoCircuitBreaker(async () => {
        return await this.mongoService.atomicStatusUpdate(
          offerId, 
          'pending', 
          'expired',
          { expiredAt: new Date() }
        );
      });
      
      if (mongoSuccess) {
        // Limpeza otimizada das chaves Redis
        await this.optimizedCleanupRedisKeys(offerId);
        console.log(`🧹 [WORKER] Limpeza concluída para oferta ${offerId}`);
      } else {
        console.log(`❌ [WORKER] Falha ao atualizar MongoDB para oferta ${offerId} - Rollback necessário`);
        // Em caso de falha, reverter status no Redis
        await this.redisService.atomicStatusChange(offerId, 'expired', 'pending');
      }
    } else {
      console.log(`⚠️ [WORKER] Oferta ${offerId} já foi processada ou Redis indisponível`);
    }
  }

  /**
   * Remove todas as chaves Redis relacionadas a uma oferta de forma otimizada.
   * Usa operação atômica para melhor performance em alto volume.
   * @param offerId ID da oferta
   */
  private async optimizedCleanupRedisKeys(offerId: string): Promise<void> {
    try {
      // Padrões de chaves relacionadas à oferta
      const keyPatterns = [
        `offer:${offerId}:*`,
        `bull:offers:*${offerId}*`,
      ];

      // Usar operação atômica do Redis Service (OTIMIZAÇÃO CRÍTICA)
      const deletedCount = await this.withRedisCircuitBreaker(async () => {
        return await this.redisService.atomicCleanupKeys(keyPatterns);
      });

      if (deletedCount !== null && deletedCount > 0) {
        console.log(`🗑️ [WORKER] ${deletedCount} chaves Redis removidas para oferta ${offerId}`);
      }

      // Remover chave de status específica (garantia)
      await this.withRedisCircuitBreaker(async () => {
        const redis = this.redisService.getInstance();
        await redis.del(`offer:${offerId}:status`);
        return true;
      });
      
    } catch (error) {
      console.error(`❌ [WORKER] Erro ao limpar chaves Redis para oferta ${offerId}:`, error.message);
    }
  }

  /**
   * Método de retry com backoff exponencial
   * Para operações críticas que podem falhar temporariamente
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`❌ [RETRY] Falha após ${maxRetries} tentativas:`, error.message);
          return null;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1); // Backoff exponencial
        console.log(`⏳ [RETRY] Tentativa ${attempt} falhou, aguardando ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return null;
  }
}
