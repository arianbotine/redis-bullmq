import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

/**
 * Gateway WebSocket para comunicação em tempo real de ofertas.
 */
@WebSocketGateway()
export class OffersGateway {
  @WebSocketServer()
  server: Server;

  /**
   * Notifica motoristas sobre uma oferta via WebSocket.
   * @param offerId ID da oferta
   * @param drivers IDs dos motoristas
   */
  notifyDrivers(offerId: string, drivers: string[]) {
    drivers.forEach(driverId => {
      this.server.to(driverId).emit('offer-notification', { offerId });
    });
  }

  /**
   * Emite evento de aceite de oferta.
   * @param offerId ID da oferta
   * @param driverId ID do motorista
   */
  emitOfferAccepted(offerId: string, driverId: string) {
    this.server.emit('offer-accepted', { offerId, driverId });
  }
}
