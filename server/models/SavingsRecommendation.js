import mongoose from 'mongoose';

const savingsRecommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  action: { type: String, required: true },
  baselineMonthlyAmount: { type: Number, required: true, min: 0 },
  targetMonthlyAmount: { type: Number, required: true, min: 0 },
  expectedMonthlyReduction: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['new', 'accepted', 'dismissed'], default: 'new', index: true },
  generatedAt: { type: Date, default: Date.now, index: true },
  observationDays: { type: Number, default: 14, min: 7, max: 30 }
}, { timestamps: true });

savingsRecommendationSchema.index({ userId: 1, generatedAt: -1 });

export default mongoose.model('SavingsRecommendation', savingsRecommendationSchema);
