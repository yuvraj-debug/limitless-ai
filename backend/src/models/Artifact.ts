import mongoose, { Schema, Document } from 'mongoose';

export interface IArtifactVersion {
  content: string;
  timestamp: Date;
}

export interface IArtifact extends Document {
  conversationId: string;
  artifactId: string; // unique ID parsed from chat stream
  title: string;
  type: 'Document' | 'Sheet' | 'Markdown';
  content: string;
  versions: IArtifactVersion[];
  lastModified: Date;
}

const ArtifactVersionSchema = new Schema({
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ArtifactSchema: Schema = new Schema({
  conversationId: { type: String, required: true },
  artifactId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  type: { type: String, enum: ['Document', 'Sheet', 'Markdown'], required: true },
  content: { type: String, required: true },
  versions: { type: [ArtifactVersionSchema], default: [] },
  lastModified: { type: Date, default: Date.now }
});

ArtifactSchema.index({ conversationId: 1 });

export default mongoose.model<IArtifact>('Artifact', ArtifactSchema);
