import { Injectable } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import Redis from 'ioredis';
import { OffersGateway } from '../offers/offers.gateway';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
});

/**
 * Processador dos trabalhos Bull relacionados às ofertas.
 */
@Injectable()
@Processor('offers')
export class JobsProcessor {
  constructor(
    private readonly offersGateway: OffersGateway,
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
  ) {}

  /**
   * Processa o trabalho de notificação de motoristas via WebSocket.
   * @param job Job Bull
   */
  @Process('notify-drivers')
  async handleNotifyDrivers(job: Job) {
    const { offerId, drivers } = job.data;
    const status = await redis.get(`offer:${offerId}:status`);
    
    if (status === 'pending') {
      // Notificar via WebSocket
      this.offersGateway.notifyDrivers(offerId, drivers);
      
      // Registrar notificação no MongoDB para cada motorista
      const notificationTime = new Date();
      for (const driverId of drivers) {
        await this.offerModel.findByIdAndUpdate(
          offerId,
          {
            $push: {
              notifiedDrivers: {
                driverId: driverId,
                notifiedAt: notificationTime
              }
            }
          }
        );
      }
    }
  }

  /**
   * Processa o trabalho de expiração de oferta.
   * @param job Job Bull
   */
  @Process('expire-offer')
  async handleExpireOffer(job: Job) {
    const { offerId } = job.data;
    // Tenta alterar o status para 'expired' de forma atômica
    const luaScript = `
      if redis.call('get', KEYS[1]) == 'pending' then
        redis.call('set', KEYS[1], 'expired')
        return 1
      end
      return 0
    `;
    const result = await redis.eval(luaScript, 1, `offer:${offerId}:status`);
    if (result === 1) {
      // Atualiza o MongoDB para 'expired'
      await this.offerModel.findByIdAndUpdate(offerId, {
        status: 'expired',
      });
    }
  }
}
