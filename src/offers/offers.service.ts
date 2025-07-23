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
    // 3. Bull: agenda trabalhos
    for (let i = 0; i < dto.drivers.length; i++) {
      await this.offerQueue.add('notify-drivers', {
        offerId: offer._id,
        drivers: [dto.drivers[i]],
      }, {
        delay: i * 1000, // escalonado por driver
        jobId: `notify-drivers:${offer._id}:${dto.drivers[i]}`,
      });
    }
    await this.offerQueue.add('expire-offer', {
      offerId: offer._id,
    }, {
      delay: dto.durationMinutes * 60 * 1000,
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
      // Cancela trabalhos futuros
      const job = await this.offerQueue.getJob(`expire-offer:${offerId}`);
      if (job) {
        await job.remove();
      }
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
}
