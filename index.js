import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Enhanced CORS configuration
const corsOptions = {
  origin: "https://www.vinclarify.info",
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Enable preflight for all routes
app.use(express.json());

// Test endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// PayPal Order Creation
app.post("/api/create-paypal-order", async (req, res) => {
  try {
    const { amount, vin, plan } = req.body;
    
    if (!amount || !vin || !plan) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const authResponse = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const { access_token } = await authResponse.json();

    const orderResponse = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "USD",
            value: amount.toString()
          },
          description: `VIN Report - ${plan} plan`
        }]
      })
    });

    const orderData = await orderResponse.json();
    res.json(orderData);
    
  } catch (error) {
    console.error("PayPal order creation error:", error);
    res.status(500).json({ 
      error: "Failed to create PayPal order",
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS configured for: https://www.vinclarify.info`);
});