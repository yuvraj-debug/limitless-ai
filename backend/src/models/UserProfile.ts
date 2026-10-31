import mongoose, { Schema, Document } from 'mongoose';

export interface IUserProfile extends Document {
  userId: mongoose.Types.ObjectId;
  persistentFacts: string[];
  agentsMd: string; // custom instructions
  enabledSkills: string[]; // list of active skills
}

const UserProfileSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  persistentFacts: { type: [String], default: [] },
  agentsMd: { type: String, default: '' },
  enabledSkills: { type: [String], default: [] }
});

export default mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
