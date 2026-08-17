const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const Product = require('./models/Product');
const Service = require('./models/Service');
const BlogPost = require('./models/BlogPost');
const Review = require('./models/Review');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hitech_db_user:hitech234@cluster0.hdxwklk.mongodb.net/hitech_db?retryWrites=true&w=majority';

function sanitizeItem(item) {
  const clean = { ...item };
  if (clean._id && (typeof clean._id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(clean._id))) {
    delete clean._id;
  }
  return clean;
}

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Successfully connected to MongoDB Atlas!');

    const dbPath = path.join(__dirname, 'data', 'db.json');
    if (!fs.existsSync(dbPath)) {
      console.error('db.json file not found at:', dbPath);
      process.exit(1);
    }

    const rawData = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(rawData);

    // 1. Seed Products
    if (Array.isArray(data.products) && data.products.length > 0) {
      console.log(`Seeding ${data.products.length} products...`);
      for (const rawItem of data.products) {
        const item = sanitizeItem(rawItem);
        const query = item.id ? { id: item.id } : { title: item.title };
        await Product.findOneAndUpdate(query, item, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
      }
      console.log('Products seeded successfully!');
    }

    // 2. Seed Services
    if (Array.isArray(data.services) && data.services.length > 0) {
      console.log(`Seeding ${data.services.length} services...`);
      for (const rawItem of data.services) {
        const item = sanitizeItem(rawItem);
        const query = item.id ? { id: item.id } : { title: item.title };
        await Service.findOneAndUpdate(query, item, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
      }
      console.log('Services seeded successfully!');
    }

    // 3. Seed Blogs
    if (Array.isArray(data.blogs) && data.blogs.length > 0) {
      console.log(`Seeding ${data.blogs.length} blog posts...`);
      for (const rawItem of data.blogs) {
        const item = sanitizeItem(rawItem);
        const query = item.slug ? { slug: item.slug } : (item.id ? { id: item.id } : { title: item.title });
        await BlogPost.findOneAndUpdate(query, item, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
      }
      console.log('Blog posts seeded successfully!');
    }

    // 4. Seed Reviews
    if (Array.isArray(data.reviews) && data.reviews.length > 0) {
      console.log(`Seeding ${data.reviews.length} reviews...`);
      for (const rawItem of data.reviews) {
        const item = sanitizeItem(rawItem);
        const query = item.id ? { id: item.id } : { customerName: item.customerName, reviewText: item.reviewText };
        await Review.findOneAndUpdate(query, item, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
      }
      console.log('Reviews seeded successfully!');
    }

    // List all collections created
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('================================================');
    console.log('MongoDB Atlas Seeding Complete!');
    console.log('Collections present in database:', collections.map(c => c.name));
    console.log('================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding MongoDB Atlas:', error);
    process.exit(1);
  }
}

seedDatabase();
