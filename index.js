import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();
const app = express();

const allowedOrigins = [
  "https://vinclarify.info",
  "http://localhost:3000"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

// ✅ PayPal Credentials
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = "https://api-m.paypal.com"; // ✅ Live environment
 // live karna ho to api-m.paypal.com

// 🔑 Get Access Token from PayPal
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
  const data = await res.json();
  return data.access_token;
}

// 🚑 Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy" });
});

// 🛒 Create Order
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
        purchase_units: [{
          amount: { currency_code: currency || "USD", value: amount.toString() }
        }]
      })
    });

    const orderData = await orderRes.json();
    res.json(orderData);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ message: "Failed to create PayPal order" });
  }
});

// 💳 Capture Order
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
    console.error("Capture order error:", err);
    res.status(500).json({ message: "Failed to capture PayPal order" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
