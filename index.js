require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();

// Configure CORS properly
const corsOptions = {
  origin: [
    'https://www.vinclarify.info',
    'https://vinclarify.info',
    'http://localhost:3000' // for development
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight for all routes
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

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// Create order
app.post("/create-paypal-order", async (req, res) => {
  try {
    const { amount, currency = "USD", vin, plan } = req.body;
    
    // Validate input
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
        },
        description: `VIN Report for ${vin} (${plan} plan)`
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

// Capture order
app.post("/capture-paypal-order", async (req, res) => {
  try {
    const { orderID, vin, plan, ...customerData } = req.body;
    
    if (!orderID || !vin || !plan) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    const capture = await client.execute(request);
    
    // Here you would typically:
    // 1. Save the transaction to your database
    // 2. Generate the VIN report
    // 3. Send confirmation email
    
    res.json({
      status: "COMPLETED",
      id: capture.result.purchase_units[0].payments.captures[0].id,
      payer_email: capture.result.payer.email_address,
      vin,
      plan,
      customerData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));