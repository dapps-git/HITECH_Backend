const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  customerName: { type: String, default: 'Valued Customer' },
  phone: { type: String, required: true },
  vehicleModel: { type: String, required: true },
  preferredDate: { type: String, required: true },
  status: { type: String, default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
