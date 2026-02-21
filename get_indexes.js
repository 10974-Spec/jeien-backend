const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

mongoose.connect(process.env.MONGO_URI, {})
  .then(async () => {
    try {
      const indexes = await mongoose.connection.collection('payments').indexes();
      console.log('Current Indexes:', JSON.stringify(indexes, null, 2));

      const count = await mongoose.connection.collection('payments').countDocuments();
      console.log('Total Payments in DB:', count);
    } catch (e) {
      console.log('DB Ops Error:', e.message);
    }
    process.exit(0);
  })
  .catch(e => {
    console.error('Connection error:', e.message);
    process.exit(1);
  });
