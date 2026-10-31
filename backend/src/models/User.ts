import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash?: string;
  discordId?: string;
  createdAt: Date;
  accountTier: 'Free' | 'Unlimited' | 'Admin';
  groupArea: string;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String },
  discordId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
  accountTier: { type: String, enum: ['Free', 'Unlimited', 'Admin'], default: 'Free' },
  groupArea: { type: String, required: true }
});

export default mongoose.model<IUser>('User', UserSchema);
