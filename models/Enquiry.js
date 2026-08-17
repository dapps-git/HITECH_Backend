const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  name: { type: String, default: 'Customer' },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  message: { type: String, default: '' },
  product: { type: String, default: 'General Enquiry' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Enquiry || mongoose.model('Enquiry', EnquirySchema);
