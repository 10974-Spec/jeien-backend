const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

mongoose.connect(process.env.MONGO_URI, {})
  .then(async () => {
    console.log('Connected to DB');
    try {
      await mongoose.connection.collection('payments').dropIndex('mpesaReceiptNumber_1');
      console.log('Dropped index mpesaReceiptNumber_1');
    } catch (e) {
      console.log('Index drop ignored or failed:', e.message);
    }
    process.exit(0);
  }).catch(e => {
    console.error('Connection error:', e.message);
    process.exit(1);
  });
