import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { OffersGateway } from './offers.gateway';
import { Offer, OfferSchema } from './schemas/offer.schema';

/**
 * Módulo de ofertas, responsável por orquestrar API, WebSocket e persistência.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
    BullModule.registerQueue({
      name: 'offers',
    }),
  ],
  controllers: [OffersController],
  providers: [OffersService, OffersGateway],
  exports: [OffersService, OffersGateway],
})
export class OffersModule {}
