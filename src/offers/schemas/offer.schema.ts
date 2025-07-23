import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Interface do documento Offer para o MongoDB.
 */
export type OfferDocument = Offer & Document;

/**
 * Schema do Mongoose para ofertas.
 */
@Schema({ timestamps: { createdAt: 'createdAt' } })
export class Offer {
  @Prop({ required: true })
  routeId: string;

  @Prop({ required: true, enum: ['pending', 'accepted', 'expired'] })
  status: string;

  @Prop({ type: [String], required: true })
  drivers: string[];

  @Prop({ required: true })
  durationMinutes: number;

  @Prop()
  acceptedBy?: string;

  @Prop()
  acceptedAt?: Date;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);
