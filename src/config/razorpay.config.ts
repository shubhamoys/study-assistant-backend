import { registerAs } from '@nestjs/config';

export default registerAs('razorpay', () => ({
  keyId: process.env.RAZORPAY_API_KEY,
  keySecret: process.env.RAZORPAY_SECRET_KEY,
}));
