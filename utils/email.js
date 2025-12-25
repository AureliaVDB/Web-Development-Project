const nodemailer = require('nodemailer');
const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const EMAIL_DISABLED = !isProd && (String(process.env.EMAIL_DISABLED || 'false').toLowerCase() === 'true');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send booking confirmation email
async function sendBookingConfirmation(userEmail, userName, booking, pool) {
  if (EMAIL_DISABLED) {
    console.log('[Email disabled] Would send booking confirmation to:', userEmail);
    return;
  }
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: 'Booking Confirmation - Swimming Pool',
    html: `
      <h2>Booking Confirmed!</h2>
      <p>Hi ${userName},</p>
      <p>Your swimming pool booking has been confirmed.</p>
      
      <h3>Booking Details:</h3>
      <ul>
        <li><strong>Pool:</strong> ${pool.name}</li>
        <li><strong>Address:</strong> ${pool.address}, ${pool.city}</li>
        <li><strong>Date:</strong> ${new Date(booking.bookingDate).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</li>
        <li><strong>Duration:</strong> ${booking.duration} hour(s)</li>
        <li><strong>Booking ID:</strong> ${booking.id}</li>
      </ul>
      
      <p><strong>Important:</strong> You can cancel this booking up to 24 hours before the start time.</p>
      
      <p>See you at the pool!</p>
      <p>Swimming Pool Booking Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Booking confirmation email sent to:', userEmail);
  } catch (error) {
    console.error('Error sending booking confirmation email:', error.message);
  }
}

// Send cancellation email
async function sendCancellationEmail(userEmail, userName, booking, pool) {
  if (EMAIL_DISABLED) {
    console.log('[Email disabled] Would send cancellation email to:', userEmail);
    return;
  }
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: 'Booking Cancelled - Swimming Pool',
    html: `
      <h2>Booking Cancelled</h2>
      <p>Hi ${userName},</p>
      <p>Your swimming pool booking has been cancelled.</p>
      
      <h3>Cancelled Booking Details:</h3>
      <ul>
        <li><strong>Pool:</strong> ${pool.name}</li>
        <li><strong>Address:</strong> ${pool.address}, ${pool.city}</li>
        <li><strong>Date:</strong> ${new Date(booking.bookingDate).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</li>
        <li><strong>Booking ID:</strong> ${booking.id}</li>
      </ul>
      
      <p>You can make a new booking anytime through our platform.</p>
      
      <p>Swimming Pool Booking Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Cancellation email sent to:', userEmail);
  } catch (error) {
    console.error('Error sending cancellation email:', error.message);
  }
}

// Send password reset email
async function sendPasswordResetEmail(userEmail, userName, resetToken) {
  if (EMAIL_DISABLED) {
    console.log('[Email disabled] Would send password reset email to:', userEmail);
    return;
  }
  const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5175';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: 'Password Reset - Swimming Pool',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${userName},</p>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      
      <p><a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a></p>
      
      <p>Or copy this link: ${resetUrl}</p>
      
      <p><strong>This link will expire in 1 hour.</strong></p>
      
      <p>If you didn't request this, please ignore this email.</p>
      
      <p>Swimming Pool Booking Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', userEmail);
  } catch (error) {
    console.error('Error sending password reset email:', error.message);
  }
}

// Send email verification
async function sendVerificationEmail(userEmail, userName, verificationToken) {
  if (EMAIL_DISABLED) {
    console.log('[Email disabled] Would send verification email to:', userEmail);
    return;
  }
  const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5175';
  const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: 'Verify Your Email - Swimming Pool',
    html: `
      <h2>Welcome to Swimming Pool Booking!</h2>
      <p>Hi ${userName},</p>
      <p>Thanks for signing up! Please verify your email address to start booking:</p>
      
      <p><a href="${verifyUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a></p>
      
      <p>Or copy this link: ${verifyUrl}</p>
      
      <p>Once verified, you'll be able to book swimming pools!</p>
      
      <p>Swimming Pool Booking Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent to:', userEmail);
  } catch (error) {
    console.error('Error sending verification email:', error.message);
  }
}

module.exports = {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
};
