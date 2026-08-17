const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  title: { type: String, required: true },
  desc: { type: String, required: true },
  icon: { type: String, default: 'FaWrench' },
  link: { type: String, default: '#contact' },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models.Service || mongoose.model('Service', ServiceSchema);
