import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Model } from 'mongoose';
import { Queue } from 'bull';
import Redis from 'ioredis';
import { Offer, OfferDocument } from './schemas/offer.schema';
import { OffersGateway } from './offers.gateway';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
});

/**
 * Serviço de ofertas, orquestrando Redis, Bull e MongoDB.
 */
@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectQueue('offers') private readonly offerQueue: Queue,
    private readonly offersGateway: OffersGateway,
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
    // 1. MongoDB: cria documento
    const offer = await this.offerModel.create({
      ...dto,
      status: 'pending',
    });
    
    // 2. Redis: cria chave de status com TTL
    const ttl = (dto.durationMinutes + 5) * 60; // segundos
    await redis.set(`offer:${offer._id}:status`, 'pending', 'EX', ttl);
    
    // 3. Bull: agenda trabalhos com nova lógica de escalonamento
    const numDrivers = dto.drivers.length;
    const totalDuration = dto.durationMinutes * 60 * 1000; // ms
    
    // Calcular intervalos de notificação
    // Se 15min e 3 motoristas: min 0, min 5, min 10, expirar min 15
    const notificationInterval = numDrivers > 1 ? totalDuration / numDrivers : 0;
    
    // Agendar notificação para cada motorista
    for (let i = 0; i < numDrivers; i++) {
      const delayMs = i * notificationInterval;
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
    await this.offerQueue.add('expire-offer', {
      offerId: offer._id,
    }, {
      delay: totalDuration,
      jobId: `expire-offer:${offer._id}`,
    });
    
    return offer;
  }

  /**
   * Aceita uma oferta de forma atômica no Redis.
   * @param offerId ID da oferta
   * @param driverId ID do motorista
   */
  async acceptOffer(offerId: string, driverId: string) {
    // LUA para garantir atomicidade
    const luaScript = `
      if redis.call('get', KEYS[1]) == 'pending' then
        redis.call('set', KEYS[1], 'accepted')
        return 1
      end
      return 0
    `;
    const result = await redis.eval(luaScript, 1, `offer:${offerId}:status`);
    
    if (result === 1) {
      // Cancelar TODOS os trabalhos pendentes para esta oferta
      await this.cancelAllPendingJobs(offerId);
      
      // Emite evento WebSocket
      this.offersGateway.emitOfferAccepted(offerId, driverId);
      
      // Atualiza MongoDB de forma assíncrona
      this.offerModel.findByIdAndUpdate(offerId, {
        status: 'accepted',
        acceptedBy: driverId,
        acceptedAt: new Date(),
      }).exec();
      
      return { status: 'accepted' };
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
}
