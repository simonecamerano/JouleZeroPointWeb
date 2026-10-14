import mongoose, { Document, Model, Schema } from 'mongoose';
import type { DefCarta, Mazzo, PlayerId } from '../game/engine';

export interface VoceLogMatch {
  t: Date;
  giocatore: PlayerId | 'server';
  azione: unknown;
}

export interface GiocatoreMatch {
  ruolo: PlayerId;
  userId: string | null;
  username: string | null;
  deckId: string;
}

export interface IMatch extends Document {
  codice: string;
  giocatori: GiocatoreMatch[];
  mazzi: Record<PlayerId, Mazzo>;
  carte: Record<number, DefCarta>;
  seed: number;
  versioneRegolamento: string;
  versioneScript: string;
  esito: { vincitore: PlayerId | null; motivo: string };
  durata: number;
  round: number;
  log: VoceLogMatch[];
  controAI: boolean;
  iniziata: Date;
  createdAt: Date;
}

const matchSchema = new Schema<IMatch>({
  codice: { type: String, required: true, index: true },
  giocatori: [{
    _id: false,
    ruolo: { type: String, enum: ['A', 'B'], required: true },
    userId: { type: String, default: null, index: true },
    username: { type: String, default: null },
    deckId: { type: String, required: true },
  }],
  mazzi: { type: Schema.Types.Mixed, required: true },
  carte: { type: Schema.Types.Mixed, required: true },
  seed: { type: Number, required: true },
  versioneRegolamento: { type: String, required: true },
  versioneScript: { type: String, required: true },
  esito: {
    vincitore: { type: String, enum: ['A', 'B'], default: null },
    motivo: { type: String, required: true },
  },
  durata: { type: Number, required: true },
  round: { type: Number, required: true },
  log: { type: [Object], default: [] }, // array di Mixed
  controAI: { type: Boolean, default: false },
  iniziata: { type: Date, required: true },
}, { timestamps: true });

const Match: Model<IMatch> = mongoose.models.Match || mongoose.model<IMatch>('Match', matchSchema);
export default Match;
