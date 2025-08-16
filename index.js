require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();

// Strict CORS configuration allowing only https://www.vinclarify.info
const corsOptions = {
  origin: 'https://vinclarify.info',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  optionsSuccessStatus: 200 // For legacy browser support
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(bodyParser.json());

const environment =
  process.env.PAYPAL_ENVIRONMENT === "production"
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      );
const client = new paypal.core.PayPalHttpClient(environment);

// Create order endpoint
app.post("/create-paypal-order", cors(corsOptions), async (req, res) => {
  try {
    const { amount, currency = "USD", vin, plan } = req.body;
    
    if (!amount || !vin || !plan) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{
        amount: { 
          currency_code: currency, 
          value: amount.toString() 
        }
      }],
    });
    
    const order = await client.execute(request);
    res.json({ 
      id: order.result.id, 
      status: order.result.status 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Capture order endpoint
app.post("/capture-paypal-order", cors(corsOptions), async (req, res) => {
  try {
    const { orderID } = req.body;
    
    if (!orderID) {
      return res.status(400).json({ error: "Missing order ID" });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    const capture = await client.execute(request);
    
    res.json({
      status: "COMPLETED",
      id: capture.result.purchase_units[0].payments.captures[0].id,
      payer_email: capture.result.payer.email_address
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));