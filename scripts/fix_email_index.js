require('dotenv').config();
const mongoose = require('mongoose');

const fixIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('users');

        // List indexes before
        const indexesBefore = await collection.indexes();
        console.log('Indexes before:', indexesBefore.map(i => i.name));

        // Drop email index if it exists
        const emailIndex = indexesBefore.find(i => i.key.email === 1);
        if (emailIndex) {
            console.log(`Dropping index: ${emailIndex.name}`);
            await collection.dropIndex(emailIndex.name);
            console.log('Index dropped successfully');
        } else {
            console.log('Email index not found');
        }

        // List indexes after
        const indexesAfter = await collection.indexes();
        console.log('Indexes after:', indexesAfter.map(i => i.name));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
};

fixIndexes();
