const mongoose = require('mongoose');

const FaqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true }
});

const BlogPostSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true },
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String, default: '' },
  featuredImage: { type: String, default: '/images/bg.webp' },
  referenceImages: { type: [String], default: [] },
  visibility: { type: String, enum: ['visible', 'hidden'], default: 'visible' },
  publishDate: { type: Date, default: Date.now },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  keywords: { type: String, default: '' },
  author: { type: String, default: 'Hi Quality Silencers Editorial' },
  category: { type: String, default: 'DPF & Silencer Guides' },
  faqs: [FaqSchema]
}, { timestamps: true });

module.exports = mongoose.models.BlogPost || mongoose.model('BlogPost', BlogPostSchema);
