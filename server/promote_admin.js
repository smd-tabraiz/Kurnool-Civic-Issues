const mongoose = require('mongoose');
require('dotenv').config();

async function promote() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const res1 = await mongoose.connection.db.collection('users').updateOne(
            { email: 'admin@kurnool.gov.in' }, 
            { $set: { role: 'admin' } }
        );
        const res2 = await mongoose.connection.db.collection('users').updateOne(
            { email: 'smdtabraiz@gmail.com' }, 
            { $set: { role: 'admin' } }
        );
        console.log('Admin promotion results:', { res1, res2 });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

promote();
