const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');

dotenv.config({ override: true });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendCompletionEmail = async (toEmail, userName, issueTitle) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API Key not found. Email not sent.');
    return;
  }

  const msg = {
    to: toEmail,
    from: `"Kurnool Civic Portal" <${process.env.EMAIL_FROM}>`,
    subject: '✅ Issue Resolved - Kurnool Civic Portal',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #a78bfa 100%); padding: 32px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">Issue Resolved!</h1>
        </div>
        <div style="padding: 32px; background: white; color: #1a1a2e;">
          <p>Hi <strong>${userName}</strong>,</p>
          <p>Great news! The issue you reported has been marked as <strong>Resolved</strong> by the administration.</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">Issue Title:</p>
            <p style="margin: 4px 0 0; font-weight: 700; color: #1e293b;">${issueTitle}</p>
          </div>
          
          <p>Congratulations! You have been rewarded for bringing this issue to our attention. Thank you for getting awarded of this issue from the admin.</p>
          <p>Thank you for contributing to a better Kurnool. Your active participation helps us identify and solve community problems faster.</p>
          
          <div style="text-align: center; margin-top: 32px;">
            <a href="${process.env.CLIENT_URL}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 14px;">Visit Dashboard</a>
          </div>
        </div>
        <div style="padding: 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
          <p>&copy; 2024 Kurnool Civic Issue Reporter. This is an automated notification.</p>
        </div>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${toEmail} via SendGrid`);
  } catch (error) {
    console.error('Email Error:', error.response ? error.response.body : error.message);
  }
};

module.exports = {
  sendCompletionEmail,
};
