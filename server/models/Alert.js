import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['warning', 'critical', 'info'], default: 'warning' },
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

alertSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Alert', alertSchema);
