const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const Admin = require('./models/Admin');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hitech_db_user:hitech234@cluster0.hdxwklk.mongodb.net/hitech_db?retryWrites=true&w=majority';

async function seedAdmin() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const adminEmail = 'highqualityadmin@gmail.com';
    const rawPassword = 'highqualityadmin12345';
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    await Admin.findOneAndUpdate(
      { email: adminEmail },
      { email: adminEmail, password: hashedPassword, name: 'Hi-Quality Admin' },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    console.log('Successfully stored ENCRYPTED Admin credentials in MongoDB Atlas!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Hashed Password: ${hashedPassword}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding Admin:', err.message);
    process.exit(1);
  }
}

seedAdmin();
