const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  customerName: { type: String, required: true },
  customerImage: { type: String, default: '' },
  rating: { type: Number, default: 5 },
  reviewText: { type: String, required: true },
  relativeTime: { type: String, default: 'recently' },
  googleReviewLink: { type: String, default: '' },
  order: { type: Number, default: 1 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
