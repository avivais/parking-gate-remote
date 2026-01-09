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
     * Wraps a name with appropriate direction attribute based on content
     * If name contains Hebrew, returns as-is (parent is RTL)
     * If name is English/Latin, wraps with dir="ltr" to prevent reversal
     */
    private wrapNameWithDirection(name: string): string {
        const fullName = name.trim();
        if (!fullName) {
            return name;
        }
        
        // If name contains Hebrew characters, return as-is (parent context is RTL)
        if (this.containsHebrew(fullName)) {
            return fullName;
        }
        
        // For English/Latin names, wrap with dir="ltr" to prevent reversal
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

            // Wrap names with appropriate direction attributes
            const wrappedFirstName = this.wrapNameWithDirection(firstName);
            const wrappedLastName = this.wrapNameWithDirection(lastName);

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
                    // Replace placeholders with wrapped names (preserving spaces)
                    htmlContent = htmlContent.replace(/\{\{firstName\}\}/g, wrappedFirstName);
                    htmlContent = htmlContent.replace(/\{\{lastName\}\}/g, wrappedLastName);
                    htmlContent = htmlContent.replace(/\{\{email\}\}/g, email);
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

            const mailOptions = {
                from: emailFrom,
                to: email,
                subject: 'החשבון שלך אושר - מערכת פתיחת שער',
                html: htmlContent,
            };

            await this.transporter.sendMail(mailOptions);
            this.logger.log(`Approval email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send approval email to ${email}:`, error);
            throw error;
        }
    }

    private getFallbackEmailContent(firstName: string, lastName: string): string {
        const wrappedFirstName = this.wrapNameWithDirection(firstName);
        const wrappedLastName = this.wrapNameWithDirection(lastName);
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
                    <p>שלום ${wrappedFirstName} ${wrappedLastName},</p>
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