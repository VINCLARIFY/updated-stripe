import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { default as fetch } from "node-fetch";

dotenv.config();
const app = express();

// CORS configuration
app.use(cors({
  origin: "https://vinclarify.info",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Server is running with CORS fixed 🚀");
});

// PayPal routes
app.post("/create-paypal-order", async (req, res) => {
  try {
    const { amount = "10.00" } = req.body;
    
    const auth = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    
    const { access_token } = await auth.json();

    const order = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
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
          }
        }]
      })
    });

    const data = await order.json();
    res.json(data);
  } catch (err) {
    console.error("PayPal create order error:", err);
    res.status(500).json({ error: "Failed to create PayPal order" });
  }
});

app.post("/capture-paypal-order/:orderID", async (req, res) => {
  try {
    const { orderID } = req.params;
    
    const auth = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    
    const { access_token } = await auth.json();

    const capture = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`
      }
    });

    const data = await capture.json();
    res.json(data);
  } catch (err) {
    console.error("PayPal capture error:", err);
    res.status(500).json({ error: "Failed to capture PayPal order" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));