import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsProcessor } from './jobs.processor';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { OffersGateway } from '../offers/offers.gateway';

/**
 * Módulo responsável pela configuração das filas Bull e conexão com o Redis.
 */
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'offers',
    }),
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
  ],
  providers: [JobsProcessor, OffersGateway],
  exports: [BullModule],
})
export class JobsModule {}
