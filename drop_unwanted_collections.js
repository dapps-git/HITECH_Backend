const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hitech_db_user:hitech234@cluster0.hdxwklk.mongodb.net/hitech_db?retryWrites=true&w=majority';

async function dropUnwantedCollections() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    if (names.includes('bookings')) {
      await db.collection('bookings').drop();
      console.log('Successfully dropped "bookings" collection.');
    } else {
      console.log('"bookings" collection not found.');
    }

    if (names.includes('enquiries')) {
      await db.collection('enquiries').drop();
      console.log('Successfully dropped "enquiries" collection.');
    } else {
      console.log('"enquiries" collection not found.');
    }

    const remainingCols = await db.listCollections().toArray();
    console.log('================================================');
    console.log('Remaining MongoDB Atlas collections:', remainingCols.map(c => c.name));
    console.log('================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error dropping collections:', err.message);
    process.exit(1);
  }
}

dropUnwantedCollections();
