// Webhook utility for Make.com integration
const axios = require('axios');

// Trigger Make.com webhook for new booking events
async function triggerBookingWebhook(booking, pool, user) {
  const webhookUrl = process.env.MAKE_COM_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('[Webhook] MAKE_COM_WEBHOOK_URL not set, skipping webhook trigger');
    return;
  }

  try {
    const payload = {
      event: 'booking_created',
      timestamp: new Date().toISOString(),
      booking: {
        id: booking.id,
        date: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        duration: booking.duration
      },
      pool: {
        name: pool.name,
        city: pool.city,
        address: pool.address
      },
      user: {
        name: user.name,
        email: user.email
      }
    };

    await axios.post(webhookUrl, payload, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('[Webhook] Booking event sent to Make.com');
  } catch (error) {
    console.error('[Webhook] Failed to trigger Make.com webhook:', error.message);
    // Don't throw — webhook failure shouldn't break booking creation
  }
}

module.exports = {
  triggerBookingWebhook
};
