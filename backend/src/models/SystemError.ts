import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemError extends Document {
  errorType: string; // e.g., 'API_KEY_429', 'API_KEY_401', 'SYSTEM_EXCEPTION'
  message: string;
  stack?: string;
  apiKeyId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  timestamp: Date;
}

const SystemErrorSchema: Schema = new Schema({
  errorType: { type: String, required: true },
  message: { type: String, required: true },
  stack: { type: String },
  apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model<ISystemError>('SystemError', SystemErrorSchema);
