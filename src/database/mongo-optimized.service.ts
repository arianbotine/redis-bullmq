import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';

/**
 * Serviço MongoDB otimizado para operações em lote
 * e prevenção de condições de corrida em alto volume.
 */
@Injectable()
export class MongoOptimizedService {
  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
  ) {}

  /**
   * Atualização em lote para múltiplas notificações
   * Evita múltiplas operações separadas que causam gargalo
   */
  async bulkNotificationUpdate(
    offerId: string, 
    notifications: Array<{ driverId: string; notifiedAt: Date }>
  ): Promise<boolean> {
    try {
      const result = await this.offerModel.findByIdAndUpdate(
        offerId,
        {
          $push: {
            notifiedDrivers: { $each: notifications }
          }
        },
        { 
          new: false, // Não retornar documento atualizado (performance)
          runValidators: false, // Skip validação para performance
        }
      );
      
      return !!result;
    } catch (error) {
      console.error(`❌ [MONGO] Erro na atualização em lote para oferta ${offerId}:`, error.message);
      return false;
    }
  }

  /**
   * Atualização de status com condição atômica
   * Previne condições de corrida no MongoDB
   */
  async atomicStatusUpdate(
    offerId: string, 
    fromStatus: string, 
    toStatus: string,
    additionalFields?: Record<string, any>
  ): Promise<boolean> {
    try {
      const updateFields = {
        status: toStatus,
        [`${toStatus}At`]: new Date(),
        ...additionalFields
      };

      const result = await this.offerModel.findOneAndUpdate(
        { 
          _id: offerId, 
          status: fromStatus  // Condição atômica
        },
        updateFields,
        { 
          new: false,
          runValidators: false
        }
      );
      
      return !!result;
    } catch (error) {
      console.error(`❌ [MONGO] Erro na atualização atômica ${offerId} (${fromStatus} → ${toStatus}):`, error.message);
      return false;
    }
  }

  /**
   * Busca otimizada com projeção específica
   * Retorna apenas campos necessários para performance
   */
  async findOfferStatus(offerId: string): Promise<{ status: string } | null> {
    try {
      return await this.offerModel.findById(
        offerId, 
        { status: 1, _id: 0 }, // Projeção: apenas status
        { lean: true } // Retorna objeto plano (mais rápido)
      );
    } catch (error) {
      console.error(`❌ [MONGO] Erro ao buscar status da oferta ${offerId}:`, error.message);
      return null;
    }
  }

  /**
   * Operação bulk write para múltiplas atualizações
   * Útil para processar muitas ofertas simultaneamente
   */
  async bulkWrite(operations: any[]): Promise<boolean> {
    try {
      if (operations.length === 0) return true;

      const result = await this.offerModel.bulkWrite(operations, {
        ordered: false, // Processar todas mesmo se alguma falhar
        writeConcern: { w: 1 } // Confirmar escrita em pelo menos 1 réplica
      });

      console.log(`✅ [MONGO] Bulk write executado: ${result.modifiedCount} documentos modificados`);
      return true;
    } catch (error) {
      console.error(`❌ [MONGO] Erro no bulk write:`, error.message);
      return false;
    }
  }

  /**
   * Limpeza de ofertas expiradas em lote
   * Para manutenção periódica do banco
   */
  async cleanupExpiredOffers(olderThanHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      const result = await this.offerModel.deleteMany({
        status: 'expired',
        expiredAt: { $lt: cutoffTime }
      });

      console.log(`🧹 [MONGO] Limpeza concluída: ${result.deletedCount} ofertas expiradas removidas`);
      return result.deletedCount;
    } catch (error) {
      console.error(`❌ [MONGO] Erro na limpeza de ofertas expiradas:`, error.message);
      return 0;
    }
  }

  /**
   * Agregação otimizada para estatísticas
   */
  async getOfferStats(): Promise<any> {
    try {
      return await this.offerModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgNotifications: { $avg: { $size: '$notifiedDrivers' } }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);
    } catch (error) {
      console.error(`❌ [MONGO] Erro ao gerar estatísticas:`, error.message);
      return [];
    }
  }
}
