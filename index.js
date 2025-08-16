import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';

dotenv.config();
const app = express();

// Enhanced CORS configuration
const allowedOrigins = [
  'https://vinclarify.info',
  'http://localhost:3000' // For development
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date(),
    service: 'VIN Report API',
    version: '1.0.0'
  });
});

// PayPal authentication helper
async function getPayPalAccessToken() {
  try {
    const authResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) {
      throw new Error(`PayPal auth failed: ${authResponse.statusText}`);
    }

    const { access_token } = await authResponse.json();
    return access_token;
  } catch (error) {
    console.error('PayPal authentication error:', error);
    throw error;
  }
}

// Create PayPal Order
app.post('/api/create-paypal-order', async (req, res) => {
  try {
    const { amount, vin, plan, currency } = req.body;

    // Validate input
    if (!amount || !vin || !plan || !currency) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['amount', 'vin', 'plan', 'currency']
      });
    }

    if (vin.length !== 17) {
      return res.status(400).json({ error: 'Invalid VIN length' });
    }

    const accessToken = await getPayPalAccessToken();

    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': `VIN-${vin}-${Date.now()}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: amount.toString()
          },
          description: `VIN Report - ${plan} plan`,
          custom_id: vin,
          invoice_id: `VIN-${vin}-${Date.now()}`
        }],
        application_context: {
          brand_name: 'VIN Clarify',
          user_action: 'PAY_NOW',
          return_url: 'https://vinclarify.info/payment-success',
          cancel_url: 'https://vinclarify.info/payment-canceled'
        }
      })
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      return res.status(orderResponse.status).json({
        error: 'Failed to create PayPal order',
        details: errorData
      });
    }

    const orderData = await orderResponse.json();
    res.status(201).json(orderData);

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create order',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Capture PayPal Order
app.post('/api/capture-paypal-order', async (req, res) => {
  try {
    const { orderID, vin, plan, ...customerData } = req.body;

    // Validate input
    if (!orderID || !vin || !plan) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['orderID', 'vin', 'plan']
      });
    }

    // Validate customer data
    const requiredFields = [
      'firstName', 'lastName', 'email', 
      'ssnLast4', 'mothersName', 
      'address', 'city', 'state', 'zip'
    ];

    const missingFields = requiredFields.filter(field => !customerData[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing customer information',
        missingFields
      });
    }

    const accessToken = await getPayPalAccessToken();

    // Capture payment
    const captureResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`, 
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': `CAPTURE-${vin}-${Date.now()}`
        }
      }
    );

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json();
      return res.status(captureResponse.status).json({
        error: 'Payment capture failed',
        details: errorData
      });
    }

    const captureData = await captureResponse.json();

    // Mock response with report generation details
    const responseData = {
      status: 'COMPLETED',
      transactionId: captureData.id,
      orderId: `VIN-${vin}-${Date.now()}`,
      vin,
      plan,
      amount: captureData.purchase_units[0].amount.value,
      currency: captureData.purchase_units[0].amount.currency_code,
      customer: {
        name: `${customerData.firstName} ${customerData.lastName}`,
        email: customerData.email
      },
      reportUrl: `https://vinclarify.info/reports/VIN-${vin}-${Date.now()}`,
      downloadExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      timestamp: new Date()
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('Payment capture error:', error);
    res.status(500).json({ 
      error: 'Payment processing failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});