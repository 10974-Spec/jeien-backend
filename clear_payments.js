const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

mongoose.connect(process.env.MONGODB_URI, {})
  .then(async () => {
    try {
      const col = mongoose.connection.collection('payments');
      // Drop all mpesa indexes
      const indexes = await col.indexes();
      for (const idx of indexes) {
        if (idx.name !== '_id_' && !idx.name.includes('checkout')) {
          await col.dropIndex(idx.name).catch(() => { });
          console.log('Dropped index:', idx.name);
        }
      }

      const res1 = await col.deleteMany({ mpesaReceiptNumber: null });
      const res2 = await col.deleteMany({ mpesaReceiptNumber: { $exists: false } });
      const res3 = await col.deleteMany({ mpesaReceiptNumber: "" });

      console.log('Deleted null receipts:', res1.deletedCount + res2.deletedCount + res3.deletedCount);
    } catch (e) {
      console.log('DB Ops Error:', e.message);
    }
    process.exit(0);
  })
  .catch(e => {
    console.error('Connection error:', e.message);
    process.exit(1);
  });
