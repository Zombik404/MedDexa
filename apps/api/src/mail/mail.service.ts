import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env';

/** Sends transactional email through SMTP. Without SMTP_URL, mails are logged (dev only). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  /** Last message, exposed for tests in non-production environments. */
  lastMessage: { to: string; subject: string; text: string } | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = config.get('SMTP_URL', { infer: true });
    this.transport = url ? nodemailer.createTransport(url) : null;
  }

  async send(to: string, subject: string, text: string) {
    this.lastMessage = { to, subject, text };
    if (!this.transport) {
      if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
        this.logger.error('SMTP_URL is not configured; email not sent');
      } else {
        this.logger.log(`[dev mail] to=${to} subject="${subject}"\n${text}`);
      }
      return;
    }
    await this.transport.sendMail({ from: this.config.get('MAIL_FROM', { infer: true }), to, subject, text });
  }
}
