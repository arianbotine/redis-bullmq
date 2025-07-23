import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';
import { OffersModule } from './offers/offers.module';

/**
 * Módulo raiz da aplicação, responsável por importar todos os módulos principais.
 */
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
    }),
    DatabaseModule, 
    JobsModule, 
    OffersModule
  ],
})
export class AppModule {}
