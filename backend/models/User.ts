import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Interface representing the User entity for type safety and identity management.
 * Extends Mongoose Document to inherit database-specific properties.
 */
export interface IUser extends Document {
  id: string;
  username: string;
  usernameDisplay: string;
  email: string;
  password: string;
  isVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  isAdmin: boolean;
  privacyAccepted: boolean;
  privacyAcceptedAt: Date;
  privacyVersion: string;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema: Schema = new Schema({
  username: {
    type: String, // Normalized identifier for auth and linking
    required: [true, 'Username is mandatory'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  usernameDisplay: {
    type: String, // Preserved casing for UI presentation
    required: true,
    trim: true,
  },
  email: {
    type: String, // Primary contact and recovery identifier
    required: [true, 'Email is mandatory'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String, // Bcrypt hashed credential
    required: [true, 'Password is mandatory'],
  },
  isVerified: {
    type: Boolean,
    default: false, // Prevents unregistered access
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  isAdmin: {
    type: Boolean,
    default: false,
  },
  privacyAccepted: {
    type: Boolean,
    required: true,
    default: false
  },
  privacyAcceptedAt: {
    type: Date
  },
  privacyVersion: {
    type: String,
    default: 'v1.0-2026-03'
  },
  lastLogin: {
    // Reference date for the retention policy declared in the privacy notice:
    // accounts with no access for 24 months are deleted. Set at registration so
    // an account that is never used again still has a starting point.
    type: Date,
    default: Date.now
  }
}, {
  // Automatic lifecycle tracking: createdAt and updatedAt timestamps
  timestamps: true,
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
