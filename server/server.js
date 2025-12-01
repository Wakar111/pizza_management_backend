import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002

// Determine CORS origin based on environment
const CORS_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173'

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}))
app.use(express.json())

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
  // Force IPv4 to avoid IPv6 timeouts on Render
  family: 4,
  logger: true,
  debug: true
})

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter error:', error)
  } else {
    console.log('✅ Email server is ready to send messages')
  }
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// Send order emails endpoint
app.post('/api/send-order-emails', async (req, res) => {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      order_number,
      items,
      subtotal,
      delivery_fee,
      discounts = [],
      discount_amount = 0,
      total_amount,
      payment_method,
      payment_status,
      notes,
      estimated_delivery_time = '40-50'
    } = req.body

    // Calculate delivery fee if not provided (for backwards compatibility)
    const actualDeliveryFee = delivery_fee !== undefined ? delivery_fee : (total_amount - subtotal)

    // Validate required fields
    if (!customer_email || !customer_name || !items) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customer_email', 'customer_name', 'items']
      })
    }

    // Format items list for email
    const itemsList = items
      .map(item => {
        let itemStr = `${item.quantity}x ${item.name} (${item.size.name})`
        if (item.extras && item.extras.length > 0) {
          const extrasStr = item.extras.map(e => e.name).join(', ')
          itemStr += ` + Extras: ${extrasStr}`
        }
        itemStr += ` - €${(item.totalPrice * item.quantity).toFixed(2)}`
        return itemStr
      })
      .join('\n')

    const paymentMethodText = payment_method === 'cash'
      ? 'Barzahlung bei Lieferung'
      : 'PayPal (Bereits bezahlt)'

    // Customer email
    const customerMailOptions = {
      from: `"Restaurant Hot Pizza" <${process.env.EMAIL_USER}>`,
      to: customer_email,
      subject: `Ihre Bestellung bei Restaurant Hot Pizza - Bestellnummer ${order_number || 'N/A'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Restaurant Hot Pizza</h1>
          </div>
          
          <div style="padding: 30px; background-color: #f9fafb;">
            <h2 style="color: #1f2937;">Hallo ${customer_name},</h2>
            <p style="color: #4b5563; font-size: 16px;">vielen Dank für Ihre Bestellung bei Restaurant Hot Pizza!</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #f97316; margin-top: 0;">Bestelldetails</h3>
              <p><strong>Bestellnummer:</strong> ${order_number || 'N/A'}</p>
              
              <h4 style="color: #1f2937;">Ihre Bestellung:</h4>
              <pre style="background: #f3f4f6; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-family: monospace;">${itemsList}</pre>
              
              <div style="border-top: 2px solid #e5e7eb; margin-top: 15px; padding-top: 15px;">
                <p style="margin: 5px 0;"><strong>Zwischensumme:</strong> €${subtotal.toFixed(2)}</p>
                ${discounts.length > 0 ? discounts.map(discount => `
                  <p style="margin: 5px 0; color: #10b981; font-weight: 500;">🎁 ${discount.name} (-${discount.percentage}%): -€${discount.amount.toFixed(2)}</p>
                `).join('') : ''}
                ${discounts.length > 1 ? `
                  <p style="margin: 5px 0; color: #059669; font-weight: bold; border-top: 1px solid #d1fae5; padding-top: 5px;">💰 Gesamt Rabatt: -€${discount_amount.toFixed(2)}</p>
                ` : ''}
                ${actualDeliveryFee > 0
          ? `<p style="margin: 5px 0;"><strong>Liefergebühr:</strong> €${actualDeliveryFee.toFixed(2)}</p>`
          : '<p style="margin: 5px 0; color: #10b981; font-weight: bold;">✅ Kostenlose Lieferung!</p>'
        }
                <p style="margin: 5px 0; font-size: 18px; color: #f97316;"><strong>Gesamtbetrag: €${total_amount.toFixed(2)}</strong></p>
              </div>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #f97316; margin-top: 0;">Lieferadresse</h3>
              <p style="margin: 5px 0;">${customer_address}</p>
              <p style="margin: 5px 0;"><strong>Tel:</strong> ${customer_phone}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Zahlungsmethode:</strong> ${paymentMethodText}</p>
              ${notes ? `<p style="margin: 15px 0 5px 0;"><strong>Anmerkungen:</strong></p><p style="margin: 5px 0; font-style: italic;">${notes}</p>` : ''}
            </div>
            
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0;">⏱️ Voraussichtliche Lieferzeit</h3>
              <p style="margin: 0; color: #78350f; font-size: 18px; font-weight: bold;">Ca. ${estimated_delivery_time} Minuten</p>
              <p style="margin: 5px 0 0 0; color: #78350f; font-size: 14px;">Ihre Bestellung wird in Kürze zubereitet und geliefert.</p>
            </div>
            
            <p style="color: #4b5563; margin-top: 30px;">Vielen Dank für Ihr Vertrauen!</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
              <p>Mit freundlichen Grüßen<br><strong>Restaurant Hunger Team</strong></p>
            </div>
          </div>
        </div>
      `
    }

    // Owner email
    const ownerMailOptions = {
      from: `"Restaurant Hunger System" <${process.env.EMAIL_USER}>`,
      to: process.env.OWNER_EMAIL,
      subject: `🔔 Neue Bestellung #${order_number || 'N/A'} - ${new Date().toLocaleString('de-DE')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🔔 NEUE BESTELLUNG</h1>
          </div>
          
          <div style="padding: 30px; background-color: #fef2f2;">
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 20px;">
              <h2 style="color: #dc2626; margin-top: 0;">Bestellnummer: ${order_number || 'N/A'}</h2>
              <p style="color: #6b7280;">Bestellzeit: ${new Date().toLocaleString('de-DE')}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">Kundeninformationen</h3>
              <p style="margin: 5px 0;"><strong>Name:</strong> ${customer_name}</p>
              <p style="margin: 5px 0;"><strong>Telefon:</strong> ${customer_phone}</p>
              <p style="margin: 5px 0;"><strong>E-Mail:</strong> ${customer_email}</p>
              <p style="margin: 15px 0 5px 0;"><strong>Lieferadresse:</strong></p>
              <p style="margin: 5px 0; padding: 10px; background: #f3f4f6; border-radius: 4px;">${customer_address}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">Bestellung</h3>
              <pre style="background: #f3f4f6; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-family: monospace;">${itemsList}</pre>
              
              <div style="border-top: 2px solid #e5e7eb; margin-top: 15px; padding-top: 15px;">
                <p style="margin: 5px 0;"><strong>Zwischensumme:</strong> €${subtotal.toFixed(2)}</p>
                ${discounts.length > 0 ? discounts.map(discount => `
                  <p style="margin: 5px 0; color: #10b981; font-weight: 500;">🎁 ${discount.name} (-${discount.percentage}%): -€${discount.amount.toFixed(2)}</p>
                `).join('') : ''}
                ${discounts.length > 1 ? `
                  <p style="margin: 5px 0; color: #059669; font-weight: bold; border-top: 1px solid #d1fae5; padding-top: 5px;">💰 Gesamt Rabatt: -€${discount_amount.toFixed(2)}</p>
                ` : ''}
                ${actualDeliveryFee > 0
          ? `<p style="margin: 5px 0;"><strong>Liefergebühr:</strong> €${actualDeliveryFee.toFixed(2)}</p>`
          : '<p style="margin: 5px 0; color: #10b981; font-weight: bold;">✅ Kostenlose Lieferung!</p>'
        }
                <p style="margin: 5px 0; font-size: 20px; color: #dc2626;"><strong>GESAMTBETRAG: €${total_amount.toFixed(2)}</strong></p>
              </div>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">Zahlungsinformationen</h3>
              <p style="margin: 5px 0;"><strong>Zahlungsmethode:</strong> ${paymentMethodText}</p>
              <p style="margin: 5px 0;"><strong>Zahlungsstatus:</strong> <span style="color: ${payment_status === 'paid' ? '#059669' : '#f59e0b'}; font-weight: bold;">${payment_status === 'paid' ? 'BEZAHLT ✓' : 'AUSSTEHEND'}</span></p>
            </div>
            
            ${notes ? `
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0;">📝 Kundenanmerkungen</h3>
              <p style="margin: 0; color: #78350f;">${notes}</p>
            </div>
            ` : ''}
            
            <div style="margin-top: 30px; padding: 20px; background: #dcfce7; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #166534; font-weight: bold;">Bitte bereiten Sie die Bestellung vor und liefern Sie sie aus.</p>
            </div>
          </div>
        </div>
      `
    }

    // Send both emails
    await Promise.all([
      transporter.sendMail(customerMailOptions),
      transporter.sendMail(ownerMailOptions)
    ])

    console.log(`✅ Order emails sent successfully for order #${order_number}`)

    res.json({
      success: true,
      message: 'Order emails sent successfully'
    })

  } catch (error) {
    console.error('❌ Error sending order emails:', error)
    res.status(500).json({
      error: 'Failed to send emails',
      details: error.message
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📧 Email service configured for: ${process.env.EMAIL_USER}`)
})
