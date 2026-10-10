import mongoose, { Schema } from 'mongoose';

// Stored refresh-token allowlist for rotation + revocation. Only hash is stored.
export interface RefreshTokenDoc {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

const refreshSchema = new Schema<RefreshTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RefreshToken: mongoose.Model<RefreshTokenDoc> =
  (mongoose.models['RefreshToken'] as mongoose.Model<RefreshTokenDoc> | undefined) ??
  mongoose.model<RefreshTokenDoc>('RefreshToken', refreshSchema);
