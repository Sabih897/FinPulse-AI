import mongoose from 'mongoose';

const historicalMonthSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  income: { type: Number, default: 0, min: 0 },
  expenses: { type: Number, default: 0, min: 0 },
  categories: { type: Map, of: Number, default: {} },
  notes: { type: String, default: '' },
  source: { type: String, enum: ['manual'], default: 'manual' }
}, { timestamps: true });

historicalMonthSchema.index({ userId: 1, month: 1 }, { unique: true });

export default mongoose.model('HistoricalMonth', historicalMonthSchema);
