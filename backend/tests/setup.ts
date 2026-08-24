import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dotenv from 'dotenv';

// Load environment variables for tests. 
// Provide dummy keys if missing to allow the app to function in CI without a .env file.
dotenv.config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-dummy-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-thirty-two-chars-long';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Test Database Helpers — Joule Zero Point (TypeScript)
 *
 * Uses MongoMemoryServer: a fully in-memory MongoDB instance.
 * No credentials, no external connections — works locally and in CI.
 */

let mongod: MongoMemoryServer | null = null;

export const connectTestDB = async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
};

export const closeTestDB = async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    }
    if (mongod) {
        await mongod.stop();
        mongod = null;
    }
};

export const clearDatabase = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
};
