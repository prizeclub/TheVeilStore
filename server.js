import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CONFIG = JSON.parse(await fs.readFile(path.join(__dirname, 'config.json'), 'utf8'));
const DATA = path.join(__dirname, 'data');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const money = n => Math.round(Number(n) * 100);
const readJson = async file => JSON.parse(await fs.readFile(path.join(DATA, file), 'utf8'));
const writeJson = async (file, value) => fs.writeFile(path.join(DATA, file), JSON.stringify(value, null, 2));
const id = prefix => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
const clean = s => String(s ?? '').trim().slice(0, 1000);

async function razorpay(pathname, options={}) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const err = new Error('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
    err.status = 503; throw err;
  }
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1${pathname}`, {
    ...options,
    headers: { 'Content-Type':'application/json', 'Authorization':`Basic ${auth}`, ...(options.headers||{}) }
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.description || 'Razorpay API error');
    err.status = res.status; err.details = data; throw err;
  }
  return data;
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
}
function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(rawBody).digest('hex');
  if (!signature || expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

app.get('/api/config', (req,res) => {
  res.json({
    brand: CONFIG.brand,
    contact: CONFIG.contact,
    delivery: CONFIG.delivery,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || ''
  });
});

app.get('/api/products', async (req,res) => res.json(await readJson('products.json')));

app.get('/api/slots', async (req,res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({error:'Invalid date'});
  const orders = await readJson('orders.json');
  const now = Date.now();
  const counts = {};
  for (const o of orders) {
    if (o.deliveryDate === date && o.deliverySlotId && (o.paymentStatus === 'paid' || (o.paymentStatus === 'created' && new Date(o.expiresAt).getTime() > now))) {
      counts[o.deliverySlotId] = (counts[o.deliverySlotId] || 0) + 1;
    }
  }
  res.json(CONFIG.delivery.slots.map(s => ({
    ...s, fee: CONFIG.delivery.slotFee,
    available: Math.max(0, CONFIG.delivery.slotCapacity - (counts[s.id] || 0))
  })));
});

app.post('/api/orders', async (req,res) => {
  try {
    const {items=[], customer={}, delivery={}, slotRequired=false} = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({error:'Cart is empty'});
    const name = clean(customer.name), email = clean(customer.email), phone = clean(customer.phone);
    const pincode = clean(delivery.pincode);
    if (!name || !phone || !/^\d{6}$/.test(pincode)) return res.status(400).json({error:'Name, phone and valid 6-digit pincode are required'});
    if (!/^\d{10}$/.test(phone.replace(/\D/g,''))) return res.status(400).json({error:'Enter a valid 10-digit phone number'});
    const products = await readJson('products.json');
    const productMap = new Map(products.map(p => [p.id,p]));
    const safeItems = [];
    let subtotal = 0;
    for (const item of items) {
      const p = productMap.get(String(item.productId));
      const qty = Math.max(1, Math.min(20, Number(item.quantity)||1));
      if (!p) return res.status(400).json({error:'Invalid product in cart'});
      subtotal += p.price * qty;
      safeItems.push({productId:p.id, name:p.name, price:p.price, quantity:qty});
    }
    const deliveryFee = 0;
    let slotFee = 0;
    let deliveryDate = null, deliverySlotId = null, deliverySlotLabel = null;
    if (slotRequired) {
      if (!CONFIG.delivery.serviceablePincodes.includes(pincode)) return res.status(400).json({error:'Priority slot delivery is not available for this pincode yet.'});
      deliveryDate = String(delivery.date || '');
      deliverySlotId = String(delivery.slotId || '');
      const slot = CONFIG.delivery.slots.find(s => s.id === deliverySlotId);
      const dateObj = new Date(`${deliveryDate}T00:00:00+05:30`);
      const today = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'}));
      today.setHours(0,0,0,0);
      const max = new Date(today); max.setDate(max.getDate()+CONFIG.delivery.advanceDays);
      if (!slot || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || dateObj < new Date(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}T00:00:00+05:30`) || dateObj > max) {
        return res.status(400).json({error:'Choose a valid delivery date and slot.'});
      }
      const orders = await readJson('orders.json');
      const now = Date.now();
      const active = orders.filter(o => o.deliveryDate===deliveryDate && o.deliverySlotId===deliverySlotId && (o.paymentStatus==='paid' || (o.paymentStatus==='created' && new Date(o.expiresAt).getTime()>now)));
      if (active.length >= CONFIG.delivery.slotCapacity) return res.status(409).json({error:'That slot is full. Please select another slot.'});
      slotFee = CONFIG.delivery.slotFee;
      deliverySlotLabel = slot.label;
    }
    const total = subtotal + deliveryFee + slotFee;
    const orderId = id('TVS');
    const receipt = orderId.replace(/[^a-zA-Z0-9]/g,'').slice(0,40);
    const rpOrder = await razorpay('/orders', {method:'POST', body:JSON.stringify({
      amount: money(total), currency:'INR', receipt, notes:{store_order_id:orderId, delivery_date:deliveryDate||'', delivery_slot:deliverySlotLabel||''}
    })});
    const order = {
      id:orderId, razorpayOrderId:rpOrder.id, items:safeItems, subtotal, deliveryFee, slotFee, total,
      customer:{name,email,phone}, delivery:{address:clean(delivery.address),pincode},
      deliveryDate, deliverySlotId, deliverySlotLabel,
      paymentStatus:'created', createdAt:new Date().toISOString(), expiresAt:new Date(Date.now()+15*60*1000).toISOString()
    };
    const orders = await readJson('orders.json'); orders.push(order); await writeJson('orders.json',orders);
    res.json({orderId, razorpayOrderId:rpOrder.id, amount:money(total), currency:'INR', keyId:process.env.RAZORPAY_KEY_ID, expiresAt:order.expiresAt});
  } catch(e) { console.error(e); res.status(e.status||500).json({error:e.message}); }
});

app.post('/api/payments/verify', async (req,res) => {
  try {
    const {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({error:'Missing payment verification data'});
    const orders = await readJson('orders.json');
    const idx = orders.findIndex(o => o.razorpayOrderId === razorpay_order_id);
    if (idx < 0) return res.status(404).json({error:'Order not found'});
    const order = orders[idx];
    if (!verifyPaymentSignature(order.razorpayOrderId, razorpay_payment_id, razorpay_signature)) return res.status(400).json({error:'Payment signature verification failed'});
    let payment;
    try { payment = await razorpay(`/payments/${encodeURIComponent(razorpay_payment_id)}`); } catch {}
    if (payment && payment.amount !== money(order.total)) return res.status(400).json({error:'Payment amount mismatch'});
    orders[idx] = {...order, paymentStatus:'paid', razorpayPaymentId:razorpay_payment_id, paidAt:new Date().toISOString()};
    await writeJson('orders.json',orders);
    res.json({ok:true, orderId:order.id, message:'Payment verified and order confirmed.'});
  } catch(e) { console.error(e); res.status(e.status||500).json({error:e.message}); }
});

// Raw body is required for webhook HMAC verification, so this route uses express.raw.
app.post('/api/webhooks/razorpay', express.raw({type:'application/json'}), async (req,res) => {
  try {
    if (!verifyWebhookSignature(req.body, req.headers['x-razorpay-signature'])) return res.status(400).send('Invalid signature');
    const event = JSON.parse(req.body.toString('utf8'));
    const orderId = event?.payload?.payment?.entity?.order_id || event?.payload?.order?.entity?.id;
    if (orderId) {
      const orders = await readJson('orders.json');
      const idx = orders.findIndex(o => o.razorpayOrderId === orderId);
      if (idx >= 0) {
        const payment = event?.payload?.payment?.entity;
        orders[idx] = {...orders[idx], paymentStatus: event.event==='payment.captured'||event.event==='order.paid'?'paid':orders[idx].paymentStatus, razorpayPaymentId:payment?.id||orders[idx].razorpayPaymentId, webhookEvent:event.event, updatedAt:new Date().toISOString()};
        await writeJson('orders.json',orders);
      }
    }
    res.json({ok:true});
  } catch(e) { console.error(e); res.status(500).send('Webhook error'); }
});

app.post('/api/contact', async (req,res) => {
  try {
    const {name,email,phone,subject,message} = req.body || {};
    if (!clean(name)||!clean(email)||!clean(message)) return res.status(400).json({error:'Name, email and message are required'});
    const messages = await readJson('messages.json');
    messages.push({id:id('MSG'),name:clean(name),email:clean(email),phone:clean(phone),subject:clean(subject),message:clean(message),createdAt:new Date().toISOString()});
    await writeJson('messages.json',messages);
    res.json({ok:true,message:'Thanks. Your message has been received.'});
  } catch(e) { res.status(500).json({error:'Could not save your message'}); }
});

app.get('/api/order/:id', async (req,res) => {
  const orders = await readJson('orders.json');
  const o = orders.find(x=>x.id===req.params.id);
  if (!o) return res.status(404).json({error:'Order not found'});
  res.json({id:o.id, paymentStatus:o.paymentStatus, total:o.total, deliveryDate:o.deliveryDate, deliverySlotLabel:o.deliverySlotLabel});
});

app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,()=>console.log(`The Veil Store running at ${BASE_URL}`));
