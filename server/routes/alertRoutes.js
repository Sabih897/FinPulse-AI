import express from 'express';
import Alert from '../models/Alert.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
    const unreadCount = await Alert.countDocuments({ userId: req.user.id, readAt: null });
    return res.json({ success: true, alerts, unreadCount });
  } catch (error) {
    console.error('Load alerts error:', error);
    return res.status(500).json({ success: false, error: 'Unable to load alerts.' });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found.' });
    return res.json({ success: true, alert });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to update alert.' });
  }
});

router.patch('/read-all', protect, async (req, res) => {
  try {
    await Alert.updateMany({ userId: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to mark alerts as read.' });
  }
});

export default router;
