import { Injectable } from '@nestjs/common';

/**
 * Serviço para integração com sistema externo de notificações.
 * Simula chamadas REST para sistema terceiro responsável pelas notificações.
 */
@Injectable()
export class NotificationService {
  
  /**
   * Simula envio de notificação para motoristas via API REST externa.
   * Em produção, faria uma requisição POST para o sistema de notificações.
   * @param offerId ID da oferta
   * @param drivers IDs dos motoristas
   */
  async notifyDrivers(offerId: string, drivers: string[]) {
    for (const driverId of drivers) {
      // Simular chamada REST para sistema externo
      const timestamp = new Date().toISOString();
      
      // Simular dados que seriam enviados via POST
      const notificationPayload = {
        offerId,
        driverId,
        message: `Nova oferta disponível: ${offerId}`,
        timestamp,
        type: 'offer_notification'
      };

      // LOG simulando a requisição REST
      console.log(`📞 [NOTIFICATION API] POST /notify-driver`);
      console.log(`   📊 Payload:`, JSON.stringify(notificationPayload, null, 2));
      console.log(`   ✅ Notificação enviada para motorista: ${driverId}`);
      console.log(`   🕐 Timestamp: ${timestamp}`);
      console.log('─'.repeat(60));

      // Simular delay de rede (opcional)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Simula notificação de aceite de oferta para sistema externo.
   * @param offerId ID da oferta
   * @param driverId ID do motorista que aceitou
   */
  async notifyOfferAccepted(offerId: string, driverId: string) {
    const timestamp = new Date().toISOString();
    
    const notificationPayload = {
      offerId,
      acceptedBy: driverId,
      message: `Oferta ${offerId} foi aceita por ${driverId}`,
      timestamp,
      type: 'offer_accepted'
    };

    console.log(`📞 [NOTIFICATION API] POST /notify-offer-accepted`);
    console.log(`   📊 Payload:`, JSON.stringify(notificationPayload, null, 2));
    console.log(`   ✅ Sistema externo notificado sobre aceite da oferta`);
    console.log(`   🕐 Timestamp: ${timestamp}`);
    console.log('─'.repeat(60));
  }
}
