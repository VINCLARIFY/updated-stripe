import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// ✅ Yahan apna frontend domain allow karo
app.use(cors({
  origin: ["https://vinclarify.info"],  // tumhara frontend domain
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Server is running with CORS fixed 🚀");
});

// ✅ PayPal routes
app.post("/create-paypal-order", async (req, res) => {
  try {
    const auth = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64"),
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
        purchase_units: [{ amount: { currency_code: "USD", value: "10.00" } }]
      })
    });

    const data = await order.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/capture-paypal-order/:orderID", async (req, res) => {
  try {
    const { orderID } = req.params;
    const auth = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64"),
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
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
