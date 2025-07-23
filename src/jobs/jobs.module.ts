import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../database/database.module';
import { JobsProcessor } from './jobs.processor';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { NotificationService } from '../offers/notification.service';
import { RedisService } from '../redis/redis.service';
import { MongoOptimizedService } from '../database/mongo-optimized.service';

/**
 * Módulo responsável pela configuração das filas Bull otimizadas para alto volume.
 */
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'offers',
      defaultJobOptions: {
        // Configurações otimizadas para jobs
        removeOnComplete: 100,  // Manter apenas 100 jobs completos
        removeOnFail: 50,       // Manter apenas 50 jobs com falha
        attempts: 3,            // Máximo 3 tentativas
        backoff: {
          type: 'exponential',  // Backoff exponencial
          delay: 2000,
        },
      },
    }),
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
  ],
  providers: [
    JobsProcessor, 
    NotificationService,
    RedisService,
    MongoOptimizedService
  ],
  exports: [BullModule, RedisService, MongoOptimizedService],
})
export class JobsModule {}
