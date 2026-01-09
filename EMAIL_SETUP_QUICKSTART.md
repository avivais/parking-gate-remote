# Quick Start: Gmail Email Setup

## What You Need to Do

1. **Enable 2-Step Verification on Gmail**:
   - Go to: https://myaccount.google.com/security
   - Click "2-Step Verification" and enable it

2. **Create an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" → "Other (Custom name)" → Enter "Parking Gate"
   - Click "Generate"
   - **Copy the 16-character password** (remove spaces!)

3. **Set Environment Variables**:
   Add these to your backend `.env` file:
   
   ```bash
   EMAIL_FROM=mitzpe6.8@gmail.com
   EMAIL_USER=mitzpe6.8@gmail.com
   EMAIL_PASSWORD=YOUR_APP_PASSWORD_HERE  # The 16-char password from step 2
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   ```

## Important Notes

- ⚠️ Use the **App Password** (from step 2), NOT your regular Gmail password
- ⚠️ Remove all spaces from the App Password when setting EMAIL_PASSWORD
- The regular password "Avivr_121" will NOT work - you MUST create an App Password

See `docs/EMAIL_SETUP.md` for detailed instructions.
