import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';
import { OffersModule } from './offers/offers.module';

/**
 * Módulo raiz da aplicação, responsável por importar todos os módulos principais.
 */
@Module({
  imports: [DatabaseModule, JobsModule, OffersModule],
})
export class AppModule {}
