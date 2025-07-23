import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { NotificationService } from './notification.service';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { RedisService } from '../redis/redis.service';
import { MongoOptimizedService } from '../database/mongo-optimized.service';

/**
 * Módulo de ofertas otimizado para alto volume.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
    BullModule.registerQueue({
      name: 'offers',
    }),
  ],
  controllers: [OffersController],
  providers: [
    OffersService, 
    NotificationService,
    RedisService,
    MongoOptimizedService
  ],
  exports: [OffersService, RedisService, MongoOptimizedService],
})
export class OffersModule {}
