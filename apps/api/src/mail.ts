import nodemailer from 'nodemailer';
import type { Config } from './config.ts';

export type AccountMessage = { to: string; subject: string; text: string };
export type AccountMailer = { send(message: AccountMessage): Promise<void> };

/** Acceptance means the SMTP server accepted the recipient, never inbox delivery. */
export function createAccountMailer(config: Config): AccountMailer | null {
  if (!config.smtp) return null;
  const smtp = config.smtp;
  const transport = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure,
    requireTLS: !smtp.secure,
    ...(smtp.user && smtp.password ? { auth: { user: smtp.user, pass: smtp.password } } : {}),
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    connectionTimeout: 5000, greetingTimeout: 10000, socketTimeout: 10000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  });
  return {
    async send(message) {
      const result = await transport.sendMail({ from: { name: 'Klisteni', address: smtp.from }, ...message });
      if (!result.accepted.some((address) => String(address).toLowerCase() === message.to.toLowerCase()) || result.rejected.length) {
        throw new Error('SMTP recipient was not accepted');
      }
    },
  };
}
