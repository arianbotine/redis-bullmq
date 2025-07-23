import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

/**
 * Bootstrap da aplicação NestJS.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Configurações CORS para WebSocket
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Servir arquivos estáticos da pasta public
  app.useStaticAssets(join(__dirname, '..', 'public'));
  
  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Portal Web disponível em: ${await app.getUrl()}/index.html`);
}

bootstrap();
