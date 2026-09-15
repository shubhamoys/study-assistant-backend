import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { renderEmail } from './email-template';

interface SendMailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.pass');
    this.from = this.configService.get<string>('mail.from')!;
    this.frontendUrl = this.configService.get<string>('app.frontendUrl')!;

    // No Mailtrap credentials configured yet — fall back to logging the
    // email instead of throwing on every register/forgot-password call, so
    // these flows stay testable end-to-end (the link is right there in the
    // server console) before real credentials are wired up.
    this.transporter =
      user && pass
        ? createTransport({
            host: this.configService.get<string>('mail.host'),
            port: this.configService.get<number>('mail.port'),
            auth: { user, pass },
          })
        : null;
  }

  async sendVerificationEmail(to: string, rawToken: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${rawToken}`;
    await this.send({
      to,
      subject: 'Verify your email — StudyLoop',
      text: `Welcome to StudyLoop! Confirm your email address by visiting: ${link}`,
      html: renderEmail({
        preheader:
          'Confirm your email address to finish setting up your account.',
        heading: 'Verify your email',
        paragraphs: [
          'Welcome to StudyLoop! Confirm this is your email address to finish setting up your account.',
        ],
        ctaText: 'Verify email',
        ctaLink: link,
      }),
    });
  }

  async sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${rawToken}`;
    await this.send({
      to,
      subject: 'Reset your password — StudyLoop',
      text: `Reset your password by visiting: ${link}\nThis link expires in 1 hour.`,
      html: renderEmail({
        preheader:
          'Reset your StudyLoop password. This link expires in 1 hour.',
        heading: 'Reset your password',
        paragraphs: [
          'We got a request to reset your StudyLoop password. Click the button below to choose a new one.',
          "If you didn't request this, you can safely ignore this email — your password won't be changed.",
        ],
        ctaText: 'Reset password',
        ctaLink: link,
        footnote: 'This link expires in 1 hour.',
      }),
    });
  }

  private async send(args: SendMailArgs): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `MAILTRAP_USER/MAILTRAP_PASS not set — logging email instead of sending.\nTo: ${args.to}\nSubject: ${args.subject}\n${args.text}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
  }
}
