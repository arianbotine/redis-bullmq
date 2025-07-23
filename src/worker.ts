import { NestFactory } from '@nestjs/core';
import { JobsModule } from './jobs/jobs.module';

/**
 * Worker dedicado para processar trabalhos BullMQ.
 * Execute este arquivo separadamente como processo worker.
 */
async function bootstrap() {
  const app = await NestFactory.create(JobsModule);
  console.log('Worker BullMQ iniciado e processando trabalhos...');
  
  // Keep the process alive
  process.on('SIGINT', async () => {
    console.log('Fechando worker BullMQ...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
