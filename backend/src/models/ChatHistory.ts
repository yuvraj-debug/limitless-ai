import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IChatHistory extends Document {
  userId: mongoose.Types.ObjectId;
  conversationId: string;
  title: string;
  isIncognito: boolean;
  messages: IMessage[];
  lastModified: Date;
}

const MessageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ChatHistorySchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  conversationId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  isIncognito: { type: Boolean, default: false },
  messages: { type: [MessageSchema], default: [] },
  lastModified: { type: Date, default: Date.now }
});

// Index to retrieve chat logs quickly
ChatHistorySchema.index({ userId: 1, lastModified: -1 });

export default mongoose.model<IChatHistory>('ChatHistory', ChatHistorySchema);
