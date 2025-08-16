// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();
app.use(cors());
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
    const { amount, currency = "USD" } = req.body;
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: currency, value: amount.toString() } }],
    });
    const order = await client.execute(request);
    res.json({ id: order.result.id, status: order.result.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Capture order
app.post("/capture-paypal-order", async (req, res) => {
  try {
    const { orderID } = req.body;
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});
    const capture = await client.execute(request);
    res.json({
      status: "COMPLETED",
      id: capture.result.purchase_units[0].payments.captures[0].id,
      payer_email: capture.result.payer.email_address,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
