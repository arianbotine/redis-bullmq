import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstrap da aplicação NestJS.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurações CORS para WebSocket
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
