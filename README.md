# The Veil Store — Production-ready starter

This ZIP contains a working responsive frontend + Node/Express backend for The Veil Store, including:

- Home / Shop / About / Contact style matching the supplied reference screens
- Anonymous Gifting and Corporate Gifting buttons opening WhatsApp chats with pre-filled messages
- Product catalog loaded from `data/products.json`
- Cart and checkout
- Razorpay Standard Checkout with server-created Razorpay Orders
- Server-side Razorpay payment signature verification
- Razorpay webhook endpoint
- Priority/scheduled delivery slot booking for selected pincodes
- Midnight slots such as 12:00 AM–12:30 AM
- Configurable extra slot fee and slot capacity
- Pincode serviceability
- Contact form saved by the backend
- No Razorpay secret is exposed to the browser

## 1. Install

Install Node.js 20+.

Then:

```bash
npm install
```

## 2. Configure Razorpay

Copy `.env.example` to `.env` and fill:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
```

Keep the Key Secret only on the server.

For first testing use Razorpay Test Mode. After successful testing, replace the test keys with your Live Mode keys.

## 3. Start

```bash
npm start
```

Open:

`http://localhost:3000`

## 4. Your logo and tagline

Replace:

`public/assets/logo-placeholder.svg`

with your own logo, or change the `<img>` source in `public/index.html`.

The current tagline is in `config.json`:

```json
"tagline": "Premium gifts. Hidden stories. Memorable moments."
```

## 5. Anonymous + Corporate WhatsApp

The WhatsApp number is in `config.json`:

```json
"whatsapp": "917380670402"
```

The two buttons are wired in `public/app.js`. Change the pre-filled messages there if you want different text.

## 6. Priority delivery

Edit `config.json`:

- `delivery.slotFee` = extra amount charged
- `delivery.slotCapacity` = maximum paid/pending orders per slot
- `delivery.serviceablePincodes` = areas where priority delivery is offered
- `delivery.slots` = available delivery windows

The example includes a 12:00 AM–12:30 AM midnight slot.

Important: before launching, replace the sample pincode list with the exact areas where you can reliably guarantee the selected time window.

## 7. Razorpay webhook

After deploying the backend on HTTPS, create a Razorpay webhook pointing to:

`https://YOUR-DOMAIN.com/api/webhooks/razorpay`

Use the same secret as `RAZORPAY_WEBHOOK_SECRET`.

Subscribe at minimum to the payment/order events you need for your operational workflow, especially successful payment events.

## 8. Deployment

This is designed for a Node.js host such as Render, Railway, Fly.io, AWS, DigitalOcean, or another Node server.

Set the same environment variables in the host dashboard.

For live Razorpay, your site and webhook must use HTTPS.

## 9. Production notes

This version stores orders/messages in JSON files so it is easy to run immediately. For a high-volume store, move persistence to PostgreSQL/MySQL and add an admin dashboard.

Do not put `.env` into GitHub. Add it to `.gitignore`.

Also replace the sample product image URLs with your own product/CDN URLs before launch.

## 10. Order workflow

1. Customer adds gifts.
2. If priority delivery is selected, backend checks pincode, date, slot and capacity.
3. Backend calculates the total itself (never trusts a frontend total).
4. Backend creates the Razorpay Order.
5. Browser opens Razorpay Checkout using only the public Key ID.
6. Server verifies the returned payment signature.
7. Razorpay webhook also updates payment state.
8. Order is stored with delivery slot information.

