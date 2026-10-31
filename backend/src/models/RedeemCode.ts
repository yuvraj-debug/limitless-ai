import mongoose, { Schema, Document } from 'mongoose';

export interface IRedeemCode extends Document {
  code: string; // 5-digit uppercase alphanumeric code
  isRedeemed: boolean;
  redeemedBy: mongoose.Types.ObjectId | null;
  redeemedAt: Date | null;
  createdAt: Date;
  isExpired: boolean;
}

const RedeemCodeSchema: Schema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  isRedeemed: { type: Boolean, default: false },
  redeemedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  redeemedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  isExpired: { type: Boolean, default: false }
});

export default mongoose.model<IRedeemCode>('RedeemCode', RedeemCodeSchema);
