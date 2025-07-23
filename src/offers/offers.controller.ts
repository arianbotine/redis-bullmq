import { Controller, Post, Body, Param, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { OffersService } from './offers.service';

/**
 * Controller REST para operações de ofertas.
 */
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  /**
   * Lista todas as ofertas.
   */
  @Get()
  async listOffers() {
    return this.offersService.listOffers();
  }

  /**
   * Busca uma oferta específica.
   */
  @Get(':id')
  async getOfferById(@Param('id') id: string) {
    return this.offersService.getOfferById(id);
  }

  /**
   * Busca o histórico de notificações de uma oferta.
   */
  @Get(':id/notifications')
  async getNotificationHistory(@Param('id') id: string) {
    return this.offersService.getNotificationHistory(id);
  }

  /**
   * Cria uma nova oferta.
   * @param dto Dados da oferta
   */
  @Post()
  async createOffer(@Body() dto: any) {
    return this.offersService.createOffer(dto);
  }

  /**
   * Aceita uma oferta (disputa).
   * @param id ID da oferta
   * @param body Dados do motorista
   */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptOffer(@Param('id') id: string, @Body() body: { driverId: string }) {
    return this.offersService.acceptOffer(id, body.driverId);
  }
}
