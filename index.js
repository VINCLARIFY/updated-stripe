const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const paypal = require("@paypal/paypal-server-sdk"); // ✅ new SDK

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configure PayPal environment
const Environment =
  process.env.NODE_ENV === "production"
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

const paypalClient = new paypal.core.PayPalHttpClient(
  new Environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
  )
);

// ✅ Create PayPal Order (no validation, only amount + currency)
app.post("/create-paypal-order", async (req, res) => {
  try {
    const { amount, currency = "USD" } = req.body;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toString(),
          },
        },
      ],
    });

    const order = await paypalClient.execute(request);

    res.json({
      id: order.result.id,
      status: order.result.status,
    });
  } catch (err) {
    console.error("PayPal create order error:", err);
    res.status(500).json({
      error: "Failed to create PayPal order",
      details: err.message,
    });
  }
});

// ✅ Capture PayPal Order
app.post("/capture-paypal-order", async (req, res) => {
  try {
    const { orderID } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await paypalClient.execute(request);
    const captureId =
      capture.result.purchase_units[0].payments.captures[0].id;
    const payerEmail = capture.result.payer.email_address;

    res.json({
      status: "COMPLETED",
      id: captureId,
      payer_email: payerEmail,
    });
  } catch (err) {
    console.error("PayPal capture error:", err);
    res.status(500).json({
      error: "Failed to capture payment",
      details: err.message,
    });
  }
});

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ PayPal environment: ${process.env.NODE_ENV || "sandbox"}`);
});
