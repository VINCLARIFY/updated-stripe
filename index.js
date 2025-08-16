import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const app = express();

// ✅ Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json()); // <-- Yeh zaroori hai

// ✅ PayPal Credentials from .env
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = process.env.PAYPAL_API || "https://api-m.sandbox.paypal.com";

// 🔎 Debug logs (Render logs me dikhega)
console.log("🔑 PayPal Client ID:", PAYPAL_CLIENT_ID);
console.log("🔑 PayPal Secret:", PAYPAL_SECRET ? "Loaded ✅" : "Missing ❌");
console.log("🔑 PayPal API:", PAYPAL_API);

// 🔑 Function to Get Access Token
async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    const errorData = await res.text();
    console.error("❌ PayPal Auth Error:", errorData);
    throw new Error(`Failed to get access token: ${errorData}`);
  }

  const data = await res.json();
  return data.access_token;
}

// 🚑 Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    env: PAYPAL_API.includes("sandbox") ? "sandbox" : "live",
    clientId: PAYPAL_CLIENT_ID ? "Loaded ✅" : "Missing ❌",
    secret: PAYPAL_SECRET ? "Loaded ✅" : "Missing ❌"
  });
});

// 🛒 Create PayPal Order
app.post("/api/create-paypal-order", async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const accessToken = await getAccessToken();

    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency || "USD",
              value: amount.toString()
            }
          }
        ]
      })
    });

    const orderData = await orderRes.json();
    res.json(orderData);
  } catch (err) {
    console.error("❌ Create order error:", err.message);
    res.status(500).json({ message: "Failed to create PayPal order" });
  }
});

// 💳 Capture PayPal Order
app.post("/api/capture-paypal-order", async (req, res) => {
  try {
    const { orderID } = req.body;
    const accessToken = await getAccessToken();

    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      }
    });

    const captureData = await captureRes.json();
    res.json(captureData);
  } catch (err) {
    console.error("❌ Capture order error:", err.message);
    res.status(500).json({ message: "Failed to capture PayPal order" });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
