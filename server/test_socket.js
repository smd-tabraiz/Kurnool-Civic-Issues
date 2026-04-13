const { io } = require('socket.io-client');
const mongoose = require('mongoose');

const testSocket = async () => {
    try {
        const socket = io('http://localhost:5000');
        
        socket.on('connect', async () => {
            console.log('Test client connected');
            
            // Connect DB briefly to get a test user and issue
            await mongoose.connect('mongodb://localhost:27017/kurnool-civic');
            const db = mongoose.connection.db;
            const issue = await db.collection('issues').findOne({});
            const admin = await db.collection('users').findOne({ role: 'admin' });
            
            if (!issue || !admin) {
                console.log('No issue or admin found in DB');
                process.exit();
            }

            console.log(`Triggering update_status for issue: ${issue._id}`);
            
            socket.emit('update_status', {
                issueId: issue._id.toString(),
                status: 'resolved',
                message: 'Test resolve from node script',
                adminId: admin._id.toString()
            }, (res) => {
                console.log('Server response:', res);
                setTimeout(() => {
                    process.exit(0);
                }, 2000);
            });
        });
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testSocket();
