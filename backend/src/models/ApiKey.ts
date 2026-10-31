import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  key: string; // Encrypted
  modelFamily: string; // e.g. 'DeepSeek', 'Llama', 'Mistral'
  groupArea: string; // e.g. 'group-A', 'group-B'
  isActive: boolean;
  statusState: 'Active' | 'Dead' | 'CoolingDown';
  cooldownUntil: Date | null;
  usageCount: number;
}

const ApiKeySchema: Schema = new Schema({
  key: { type: String, required: true },
  modelFamily: { type: String, required: true },
  groupArea: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  statusState: { type: String, enum: ['Active', 'Dead', 'CoolingDown'], default: 'Active' },
  cooldownUntil: { type: Date, default: null },
  usageCount: { type: Number, default: 0 }
});

export default mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
