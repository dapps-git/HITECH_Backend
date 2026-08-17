const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  title: { type: String, required: true },
  category: { type: String, default: 'General Silencer' },
  image: { type: String, required: true },
  iconType: { type: String, default: 'car' },
  shortDesc: { type: String, default: '' },
  fullDesc: { type: String, default: '' },
  desc: { type: String, default: '' },
  spec: { type: String, default: 'OEM Specification' }
}, { timestamps: true });

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
