const dotenv = require('dotenv');
dotenv.config();

const { sendCompletionEmail } = require('./utils/emailService');

const testMail = async () => {
    try {
        console.log('Sending test email to:', process.env.EMAIL_FROM);
        await sendCompletionEmail(process.env.EMAIL_FROM, 'Citizen John', 'Massive Pothole on Main Road');
        console.log('Test completed.');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

testMail();
