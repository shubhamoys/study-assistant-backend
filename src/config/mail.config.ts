import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.MAILTRAP_HOST ?? 'sandbox.smtp.mailtrap.io',
  port: parseInt(process.env.MAILTRAP_PORT ?? '2525', 10),
  user: process.env.MAILTRAP_USER,
  pass: process.env.MAILTRAP_PASS,
  from:
    process.env.MAIL_FROM ?? 'AI Study Assistant <no-reply@studyassistant.dev>',
}));
