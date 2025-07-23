import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * Módulo de configuração do MongoDB otimizado para alto volume.
 */
@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/offers',
      {
        // Pool de conexões otimizado para alto volume
        maxPoolSize: 50,           // Máximo de conexões simultâneas
        minPoolSize: 5,            // Mínimo de conexões ativas
        maxIdleTimeMS: 30000,      // Timeout para conexões idle
        waitQueueTimeoutMS: 10000, // Timeout para aguardar conexão disponível
        
        // Timeouts de servidor
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        
        // Write concern para garantir durabilidade
        writeConcern: {
          w: 'majority',
          j: true,
          wtimeout: 10000
        },
      }
    ),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
