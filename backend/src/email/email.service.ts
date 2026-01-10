import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter;

    constructor(private readonly configService: ConfigService) {
        const emailHost = this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com');
        const emailPort = this.configService.get<number>('EMAIL_PORT', 587);
        const emailUser = this.configService.get<string>('EMAIL_USER');
        const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');

        if (!emailUser || !emailPassword) {
            this.logger.warn(
                'Email configuration missing. Email sending will be disabled.',
            );
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: emailHost,
            port: emailPort,
            secure: false, // true for 465, false for other ports
            auth: {
                user: emailUser,
                pass: emailPassword,
            },
        });

        // Verify connection
        this.transporter.verify((error) => {
            if (error) {
                this.logger.error('Email transporter verification failed:', error);
            } else {
                this.logger.log('Email transporter ready');
            }
        });
    }

    /**
     * Detects if a string contains Hebrew characters
     * Hebrew Unicode range: U+0590 to U+05FF
     */
    private containsHebrew(text: string): boolean {
        const hebrewRegex = /[\u0590-\u05FF]/;
        return hebrewRegex.test(text);
    }

    /**
     * Formats full name with appropriate direction for RTL email context
     * - Hebrew names: FirstName LastName (no wrapping, RTL handles it)
     * - English names: wrapped with dir="ltr" so FirstName appears first (on left)
     */
    private formatFullName(firstName: string, lastName: string): string {
        const fullName = `${firstName} ${lastName}`.trim();

        // If either name contains Hebrew, return as-is (parent RTL context handles it)
        if (this.containsHebrew(firstName) || this.containsHebrew(lastName)) {
            return fullName;
        }

        // For English/Latin names, wrap entire name with dir="ltr"
        // This ensures "FirstName LastName" order (left to right)
        return `<span dir="ltr">${fullName}</span>`;
    }

    async sendApprovalEmail(
        email: string,
        firstName: string,
        lastName: string,
    ): Promise<void> {
        if (!this.transporter) {
            this.logger.warn(
                'Email transporter not configured. Skipping email send.',
            );
            return;
        }

        try {
            const emailAddress = this.configService.get<string>(
                'EMAIL_FROM',
                this.configService.get<string>('EMAIL_USER', 'noreply@example.com'),
            );
            const emailFromName = this.configService.get<string>(
                'EMAIL_FROM_NAME',
            );

            // Format "from" field using object format for better compatibility
            const emailFrom = emailFromName
                ? {
                      name: emailFromName,
                      address: emailAddress,
                  }
                : emailAddress;

            // Format full name with appropriate direction
            const formattedFullName = this.formatFullName(firstName, lastName);

            // Get homepage URL from config, default to https://mitzpe6-8.com
            const homepageUrl = this.configService.get<string>(
                'HOMEPAGE_URL',
                'https://mitzpe6-8.com',
            );

            // Load email template
            // Try multiple possible paths (dev and production)
            const possiblePaths = [
                join(__dirname, 'templates', 'approval-email.he.html'), // Production (dist folder)
                join(process.cwd(), 'backend', 'src', 'email', 'templates', 'approval-email.he.html'), // Development
                join(process.cwd(), 'src', 'email', 'templates', 'approval-email.he.html'), // Alternative
            ];

            let htmlContent: string = this.getFallbackEmailContent(firstName, lastName);
            let templateLoaded = false;

            for (const templatePath of possiblePaths) {
                try {
                    htmlContent = readFileSync(templatePath, 'utf-8');
                    // Replace placeholders
                    htmlContent = htmlContent.replace(/\{\{fullName\}\}/g, formattedFullName);
                    htmlContent = htmlContent.replace(/\{\{email\}\}/g, email);
                    htmlContent = htmlContent.replace(/\{\{homepageUrl\}\}/g, homepageUrl);
                    templateLoaded = true;
                    break;
                } catch (error) {
                    // Try next path
                    continue;
                }
            }

            if (!templateLoaded) {
                this.logger.warn('Failed to load email template from any path, using fallback');
            }

            // Get BCC email if configured
            const bccEmail = this.configService.get<string>('BCC_EMAIL')?.trim();

            const mailOptions = {
                from: emailFrom,
                to: email,
                subject: 'החשבון שלך אושר - מערכת פתיחת שער',
                html: htmlContent,
                ...(bccEmail && { bcc: bccEmail }), // Add BCC only if configured
            };

            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Approval email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send approval email to ${email}:`, error);
            throw error;
        }
    }

    private getFallbackEmailContent(firstName: string, lastName: string): string {
        const formattedFullName = this.formatFullName(firstName, lastName);
        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="he">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>החשבון אושר</title>
            </head>
            <body style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2c3e50;">החשבון שלך אושר</h1>
                    <p>שלום ${formattedFullName},</p>
                    <p>אנו שמחים להודיע לך שהחשבון שלך במערכת פתיחת השער אושר בהצלחה.</p>
                    <p>כעת תוכל להתחבר למערכת ולהשתמש בשירות פתיחת השער מרחוק.</p>
                    <p>תוכל להתחבר באמצעות כתובת האימייל והסיסמה שהזנת בעת ההרשמה.</p>
                    <p>בברכה,<br>ועד הבית</p>
                </div>
            </body>
            </html>
        `;
    }
}