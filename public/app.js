const state={config:null,products:[],cart:[],category:"All Gifts"};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
const toast=(m)=>{const e=$("#toast");e.textContent=m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),3000)};
const wa=(kind)=>{
 const num=state.config?.contact?.whatsapp||"917380670402";
 const msg=kind==="corporate"?"Hello The Veil Store, I am interested in Corporate Gifting. Please share the details and catalogue.":"Hello The Veil Store, I want to send an Anonymous Gift. Please help me with the options.";
 return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
};
async function init(){
 state.config=await fetch("/api/config").then(r=>r.json());
 state.products=await fetch("/api/products").then(r=>r.json());
 $("#emailLink").textContent=state.config.contact.email; $("#emailLink").href=`mailto:${state.config.contact.email}`;
 $("#phoneLink").textContent=state.config.contact.phone; $("#phoneLink").href=`tel:${state.config.contact.phone}`;
 $("#waLink").textContent=state.config.contact.phone; $("#waLink").href=wa("anonymous");
 $("#addressText").textContent=state.config.contact.address;
 $("#slotFee").textContent=money(state.config.delivery.slotFee); $("#slotFee2").textContent=money(state.config.delivery.slotFee);
 $$('[data-wa]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();window.open(wa(a.dataset.wa),"_blank","noopener")}));
 renderProducts(); updateCart(); setup();
}
function renderProducts(){
 const list=state.category==="All Gifts"?state.products:state.products.filter(p=>p.category===state.category);
 $("#products").innerHTML=list.map(p=>`<article class="product"><div class="product-img"><img src="${p.image}" alt="${p.name}" loading="lazy"></div><div class="product-body"><span class="badge">${p.badge||""}</span><h3>${p.name}</h3><div class="price">${money(p.price)}</div><button data-add="${p.id}">CUSTOMISE</button></div></article>`).join("");
 $$("[data-add]").forEach(b=>b.onclick=()=>add(b.dataset.add));
}
function add(id){const item=state.cart.find(x=>x.productId===id);if(item)item.quantity++;else state.cart.push({productId:id,quantity:1});updateCart();toast("Gift added to your cart.");}
function updateCart(){
 $("#cartCount").textContent=state.cart.reduce((s,x)=>s+x.quantity,0);
 const rows=state.cart.map(x=>{const p=state.products.find(p=>p.id===x.productId);return `<div class="cart-row"><span>${p.name}<br><small>${money(p.price)}</small></span><span class="qty"><button data-minus="${p.id}">−</button> ${x.quantity} <button data-plus="${p.id}">+</button></span><b>${money(p.price*x.quantity)}</b></div>`}).join("");
 $("#cartItems").innerHTML=rows||"<p>Your cart is empty.</p>";
 const total=state.cart.reduce((s,x)=>{const p=state.products.find(p=>p.id===x.productId);return s+p.price*x.quantity},0); $("#cartTotal").textContent=money(total);
 $$("[data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1)); $$("[data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));
 updateSummary();
}
function changeQty(id,d){const i=state.cart.find(x=>x.productId===id);if(!i)return;i.quantity+=d;if(i.quantity<1)state.cart=state.cart.filter(x=>x.productId!==id);updateCart()}
function updateSummary(){
 const sub=state.cart.reduce((s,x)=>{const p=state.products.find(p=>p.id===x.productId);return s+p.price*x.quantity},0);
 $("#summaryItems").innerHTML=state.cart.map(x=>{const p=state.products.find(p=>p.id===x.productId);return `<p>${p.name} × ${x.quantity}<b>${money(p.price*x.quantity)}</b></p>`}).join("")||"<p>No items.</p>";
 const sf=$("#slotRequired")?.checked?state.config.delivery.slotFee:0;
 $("#summarySubtotal").textContent=money(sub); $("#summarySlot").textContent=sf?money(sf):"₹0"; $("#summaryTotal").textContent=money(sub+sf);
}
function setup(){
 $$(".cat").forEach(b=>b.onclick=()=>{$$(".cat").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.category=b.dataset.cat;renderProducts()});
 $("#cartBtn").onclick=()=>$("#cartModal").classList.remove("hidden");
 $$("[data-close]").forEach(b=>b.onclick=()=>b.closest(".modal").classList.add("hidden"));
 $("#checkoutBtn").onclick=()=>{if(!state.cart.length)return toast("Add at least one gift first.");$("#cartModal").classList.add("hidden");$("#checkoutModal").classList.remove("hidden");updateSummary()};
 $("#deliveryBtn").onclick=()=>{$("#cartModal").classList.remove("hidden");toast("Add your gift to the cart, then select a priority slot at checkout.")};
 $("#slotRequired").onchange=async()=>{const on=$("#slotRequired").checked;$("#slotBox").classList.toggle("hidden",!on);updateSummary();if(on)await loadSlots()};
 $("#deliveryDate").onchange=loadSlots;
 $("#orderForm").onsubmit=pay;
 $("#contactForm").onsubmit=sendContact;
}
function localDate(d=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(d)}
async function loadSlots(){
 const date=$("#deliveryDate").value;if(!date)return;
 const r=await fetch(`/api/slots?date=${encodeURIComponent(date)}`);const slots=await r.json();
 if(!r.ok){$("#slotStatus").textContent=slots.error||"Unable to load slots";return}
 $("#deliverySlot").innerHTML='<option value="">Select a slot</option>'+slots.map(s=>`<option value="${s.id}" ${s.available===0?"disabled":""}>${s.label} — ${s.available} left</option>`).join("");
 $("#slotStatus").textContent=`Selected-area delivery fee: ${money(state.config.delivery.slotFee)}.`;
}
async function pay(e){
 e.preventDefault(); if(!state.cart.length)return toast("Your cart is empty.");
 const fd=new FormData(e.target), slotRequired=fd.get("slotRequired")==="on";
 const payload={items:state.cart,customer:{name:fd.get("name"),email:fd.get("email"),phone:fd.get("phone")},delivery:{address:fd.get("address"),pincode:fd.get("pincode"),date:fd.get("date"),slotId:fd.get("slotId")},slotRequired};
 const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;$("#orderMsg").textContent="Creating secure payment order…";
 try{
  const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),data=await r.json();
  if(!r.ok)throw Error(data.error||"Could not create order");
  const options={key:data.keyId,amount:data.amount,currency:data.currency,name:"The Veil Store",description:"Premium Gift Order",order_id:data.razorpayOrderId,prefill:{name:payload.customer.name,email:payload.customer.email,contact:payload.customer.phone},notes:{store_order_id:data.orderId},theme:{color:"#b38a4a"},
   handler:async response=>{
    $("#orderMsg").textContent="Verifying payment…";
    const vr=await fetch("/api/payments/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(response)}),vd=await vr.json();
    if(!vr.ok)throw Error(vd.error||"Payment verification failed");
    state.cart=[];updateCart();e.target.reset();$("#slotBox").classList.add("hidden");$("#checkoutModal").classList.add("hidden");
    toast(`Payment successful. Order ${vd.orderId} is confirmed.`);
   },
   modal:{ondismiss:()=>{$("#orderMsg").textContent="Payment window closed. Your slot remains reserved briefly while you retry."}}
  };
  const rzp=new Razorpay(options);rzp.on("payment.failed",x=>{$("#orderMsg").textContent=x.error?.description||"Payment failed. Please try again.";});rzp.open();
 }catch(err){$("#orderMsg").textContent=err.message}finally{btn.disabled=false}
}
async function sendContact(e){e.preventDefault();const btn=e.target.querySelector("button");btn.disabled=true;const payload=Object.fromEntries(new FormData(e.target));try{const r=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),d=await r.json();if(!r.ok)throw Error(d.error);$("#contactMsg").textContent=d.message;e.target.reset()}catch(x){$("#contactMsg").textContent=x.message}finally{btn.disabled=false}}
$("#subscribe").addEventListener("submit",e=>{e.preventDefault();toast("Thanks for subscribing.")});
document.addEventListener("DOMContentLoaded",init);
