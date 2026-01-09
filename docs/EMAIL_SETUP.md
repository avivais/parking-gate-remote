# Email Setup Guide (Gmail)

This guide will help you configure Gmail SMTP for sending approval emails.

## Gmail Settings Required

### Step 1: Enable 2-Step Verification
Gmail no longer allows "less secure apps" to access your account. You need to enable 2-Step Verification:

1. Go to your Google Account: https://myaccount.google.com/security
2. Under "Signing in to Google", click **2-Step Verification**
3. Follow the steps to enable it

### Step 2: Create an App Password
After enabling 2-Step Verification, you can create an App Password:

1. Go to App Passwords: https://myaccount.google.com/apppasswords
   - Or navigate: Google Account → Security → 2-Step Verification → App passwords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device and enter "Parking Gate App"
4. Click **Generate**
5. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)
   - ⚠️ **Important**: Remove all spaces when using it - use it as one continuous 16-character string

## Environment Variables

Add these to your `.env` file (or `backend.env.template` for production):

```bash
# Email Configuration
EMAIL_FROM=mitzpe6.8@gmail.com
EMAIL_FROM_NAME=מצפה 6-8 - מערכת פתיחת שער
EMAIL_USER=mitzpe6.8@gmail.com
EMAIL_PASSWORD=YOUR_16_CHARACTER_APP_PASSWORD_HERE  # The App Password from Step 2
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
```

### Where to get each variable:

- **EMAIL_FROM**: Your Gmail address (what recipients will see as sender email)
  - Example: `mitzpe6.8@gmail.com`

- **EMAIL_FROM_NAME**: Display name for the sender (optional, but recommended)
  - This name will appear before the email address in the "From" field
  - Example: `מצפה 6-8 - מערכת פתיחת שער` or `Mitzpe 6-8 Gate System`
  - If not set, only the email address will be shown
  - Recipients will see: "Name <email@example.com>"

- **EMAIL_USER**: Your Gmail address (for authentication)
  - Example: `mitzpe6.8@gmail.com`
  - Usually same as EMAIL_FROM

- **EMAIL_PASSWORD**: Your Gmail App Password (NOT your regular password!)
  - ⚠️ **Important**: This is the 16-character App Password you generated in Step 2
  - Remove all spaces before using it
  - Example: If generated password is `abcd efgh ijkl mnop`, use `abcdefghijklmnop`

- **EMAIL_HOST**: Gmail SMTP server
  - Always: `smtp.gmail.com`

- **EMAIL_PORT**: Gmail SMTP port (TLS)
  - Always: `587`

## Example Configuration

For the account `mitzpe6.8@gmail.com` with App Password `abcdefghijklmnop`:

```bash
EMAIL_FROM=mitzpe6.8@gmail.com
EMAIL_FROM_NAME=מצפה 6-8 - מערכת פתיחת שער
EMAIL_USER=mitzpe6.8@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
```

Recipients will see the email as coming from: "מצפה 6-8 - מערכת פתיחת שער <mitzpe6.8@gmail.com>"

## Troubleshooting

### "Invalid login" or "Authentication failed"
- Make sure you're using the **App Password**, not your regular Gmail password
- Verify 2-Step Verification is enabled
- Check that there are no spaces in the App Password

### "Less secure app access" error
- You don't need to enable "less secure apps" - use App Passwords instead
- Make sure 2-Step Verification is enabled first

### Email not sending
- Check backend logs for email service errors
- Verify all environment variables are set correctly
- Test the App Password by trying to login with it in an email client

## Security Notes

- **Never commit your App Password to git**
- Keep your `.env` file secure and never share it
- If you suspect your App Password is compromised, revoke it and generate a new one at: https://myaccount.google.com/apppasswords