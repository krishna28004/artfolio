import Razorpay from 'razorpay';

// Secure Razorpay Server Instantiation
// Requires purely backend environment variables to prevent token leakage
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'mock_key_id',
  key_secret: process.env.RAZORPAY_SECRET || 'mock_key_secret',
});
