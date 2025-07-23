import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Model } from 'mongoose';
import { Queue } from 'bull';
import { Offer, OfferDocument } from './schemas/offer.schema';
import { NotificationService } from './notification.service';
import { RedisService } from '../redis/redis.service';
import { MongoOptimizedService } from '../database/mongo-optimized.service';

/**
 * Serviço de ofertas otimizado para alto volume.
 * Usa serviços especializados para Redis e MongoDB.
 */
@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectQueue('offers') private readonly offerQueue: Queue,
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
    private readonly mongoService: MongoOptimizedService,
  ) {}

  /**
   * Lista todas as ofertas do MongoDB.
   */
  async listOffers() {
    return this.offerModel.find().sort({ createdAt: -1 }).exec();
  }

  /**
   * Busca uma oferta específica com histórico de notificações.
   */
  async getOfferById(offerId: string) {
    return this.offerModel.findById(offerId).exec();
  }

  /**
   * Busca o histórico de notificações de uma oferta.
   */
  async getNotificationHistory(offerId: string) {
    const offer = await this.offerModel.findById(offerId).select('notifiedDrivers').exec();
    return offer ? offer.notifiedDrivers : [];
  }

  /**
   * Cria uma nova oferta e agenda trabalhos no BullMQ.
   * @param dto Dados da oferta
   */
  async createOffer(dto: {
    routeId: string;
    drivers: string[];
    durationMinutes: number;
  }) {
    console.log('📝 [OFFERS] Iniciando criação de oferta:', dto);
    
    // 1. MongoDB: cria documento
    const offer = await this.offerModel.create({
      ...dto,
      status: 'pending',
    });
    console.log('✅ [OFFERS] Documento MongoDB criado:', offer._id);
    
    // 2. Redis: cria chave de status com TTL
    const ttl = (dto.durationMinutes + 5) * 60; // segundos
    console.log('🔑 [OFFERS] Definindo status no Redis com TTL:', ttl);
    await this.redisService.setOptimized(`offer:${offer._id}:status`, 'pending', ttl);
    console.log('✅ [OFFERS] Status Redis definido');
    
    // 3. Bull: agenda trabalhos com nova lógica de escalonamento
    const numDrivers = dto.drivers.length;
    const totalDuration = dto.durationMinutes * 60 * 1000; // ms
    console.log('⏰ [OFFERS] Calculando timing - duração total:', totalDuration, 'ms');
    
    // Calcular intervalos de notificação
    // Se 15min e 3 motoristas: min 0, min 5, min 10, expirar min 15
    const notificationInterval = numDrivers > 1 ? totalDuration / numDrivers : 0;
    console.log('📊 [OFFERS] Intervalo de notificação:', notificationInterval, 'ms');
    
    // Agendar notificação para cada motorista
    for (let i = 0; i < numDrivers; i++) {
      const delayMs = i * notificationInterval;
      console.log(`📞 [OFFERS] Agendando notificação ${i} com delay:`, delayMs, 'ms');
      await this.offerQueue.add('notify-drivers', {
        offerId: offer._id,
        drivers: [dto.drivers[i]],
        driverIndex: i
      }, {
        delay: delayMs,
        jobId: `notify-drivers:${offer._id}:${i}:${dto.drivers[i]}`,
      });
    }
    
    // Agendar expiração no final do tempo total
    console.log('⏱️ [OFFERS] Agendando expiração com delay:', totalDuration, 'ms');
    await this.offerQueue.add('expire-offer', {
      offerId: offer._id,
    }, {
      delay: totalDuration,
      jobId: `expire-offer:${offer._id}`,
    });
    
    console.log('🎉 [OFFERS] Oferta criada com sucesso:', offer._id);
    return offer;
  }

  /**
   * Aceita uma oferta de forma atômica no Redis.
   * Otimizado para alta concorrência e operações seguras.
   * @param offerId ID da oferta
   * @param driverId ID do motorista
   */
  async acceptOffer(offerId: string, driverId: string) {
    // Operação atômica usando o RedisService otimizado
    const success = await this.redisService.atomicStatusChange(offerId, 'pending', 'accepted');
    
    if (success) {
      console.log(`✅ [OFFERS] Oferta ${offerId} aceita por ${driverId}`);
      
      // Cancelar TODOS os trabalhos pendentes para esta oferta
      await this.cancelAllPendingJobs(offerId);
      
      // Simular notificação de aceite para sistema externo
      await this.notificationService.notifyOfferAccepted(offerId, driverId);
      
      // Atualizar MongoDB com operação atômica otimizada
      const mongoSuccess = await this.mongoService.atomicStatusUpdate(
        offerId,
        'pending',
        'accepted',
        {
          acceptedBy: driverId,
          acceptedAt: new Date(),
        }
      );
      
      if (!mongoSuccess) {
        console.error(`❌ [OFFERS] Falha ao atualizar MongoDB para oferta aceita ${offerId}`);
        // Rollback do Redis se MongoDB falhar
        await this.redisService.atomicStatusChange(offerId, 'accepted', 'pending');
        throw new ConflictException('Erro interno - tente novamente');
      }
      
      // Limpeza das chaves Redis
      await this.cleanupRedisKeys(offerId);
      
      return { status: 'accepted', acceptedBy: driverId };
    } else {
      throw new ConflictException('Oferta já foi aceita ou expirada');
    }
  }

  /**
   * Cancela todos os jobs pendentes para uma oferta específica.
   * @param offerId ID da oferta
   */
  private async cancelAllPendingJobs(offerId: string) {
    try {
      // Buscar todos os jobs ativos da fila
      const jobs = await this.offerQueue.getJobs(['waiting', 'delayed']);
      
      // Filtrar jobs relacionados a esta oferta e cancelar
      for (const job of jobs) {
        if (job.id && String(job.id).includes(offerId)) {
          await job.remove();
          console.log(`Job cancelado: ${job.id}`);
        }
      }
    } catch (error) {
      console.error('Erro ao cancelar jobs:', error);
    }
  }

  /**
   * Limpeza otimizada das chaves Redis relacionadas à oferta.
   * @param offerId ID da oferta
   */
  private async cleanupRedisKeys(offerId: string): Promise<void> {
    try {
      const keyPatterns = [
        `offer:${offerId}:*`,
        `bull:offers:*${offerId}*`,
      ];

      const deletedCount = await this.redisService.atomicCleanupKeys(keyPatterns);
      
      if (deletedCount > 0) {
        console.log(`🗑️ [OFFERS] ${deletedCount} chaves Redis limpas para oferta ${offerId}`);
      }
    } catch (error) {
      console.error(`❌ [OFFERS] Erro ao limpar chaves Redis para oferta ${offerId}:`, error.message);
    }
  }
}
