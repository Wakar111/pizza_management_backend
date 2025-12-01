# Email Server for Restaurant Hunger

This server handles sending order confirmation emails to customers and the restaurant owner.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure your email settings:
   
   ```env
   PORT=3002
   
   # Email Configuration (SMTP)
   # For Gmail:
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password  # Use App Password, not regular password
   
   # Owner Email (receives order notifications)
   OWNER_EMAIL=owner@restaurant.com
   ```

   ### Gmail Setup
   
   To use Gmail:
   1. Enable 2-factor authentication on your Google account
   2. Generate an App Password: https://myaccount.google.com/apppasswords
   3. Use the generated 16-character password as `EMAIL_PASSWORD`

3. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### Health Check
```
GET /api/health
```
Returns server status.

### Send Order Emails
```
POST /api/send-order-emails
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "0123456789",
  "customer_address": "123 Main St",
  "order_number": "12345",
  "items": [...],
  "subtotal": 25.00,
  "delivery_fee": 2.50,
  "total_amount": 27.50,
  "payment_method": "cash",
  "payment_status": "pending",
  "notes": "Extra napkins please"
}
```

Sends confirmation emails to both customer and restaurant owner.

## Email Templates

The server sends HTML-formatted emails with:
- **Customer Email**: Order confirmation with details, delivery address, and total
- **Owner Email**: New order notification with all customer and order details

## Error Handling

The email service is non-blocking - if email sending fails, the order is still processed successfully in the main application.

## Production Deployment

For production, consider:
- Using a dedicated email service (SendGrid, AWS SES, etc.)
- Setting up proper error logging
- Configuring HTTPS
- Using environment-specific configurations
