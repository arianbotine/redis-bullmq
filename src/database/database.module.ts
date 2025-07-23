import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * Módulo responsável pela configuração da conexão com o MongoDB via Mongoose.
 */
@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/offers'),
  ],
})
export class DatabaseModule {}
