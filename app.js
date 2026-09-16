const API_URL = 'https://script.google.com/macros/s/AKfycbxc49T5iqv7V5XvZZciOyaW6a4_CGhjy6hjuxVwHehE8bOX8SGlTL-RJnbC4xpafWWx/exec';
const app = document.getElementById('app');
const state = { user:null, products:[], batches:[], remarks:{}, filter:'', loading:false };

function money(v){ const n=Number(v); return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN',{maximumFractionDigits:2})}` : '—'; }
function esc(v){ return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function toast(msg){ const x=document.createElement('div');x.className='toast';x.textContent=msg;document.body.appendChild(x);setTimeout(()=>x.remove(),2800); }
function imageUrl(p){ return p['Product Image']||p.image||p.Image||p['Image Link']||p['Image URL']||''; }
function productKey(p){ return p['SKU_ID']||p.sku||p.SKU||p['Product SKU']||p['Product Name']||p.productName; }
function token(){ return localStorage.getItem('vendorPurchaseSession')||''; }

async function api(action,payload={}){
  const body={action,...payload,token:payload.token||token(),sessionToken:payload.sessionToken||token()};
  const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});
  let data;
  try{ data=await res.json(); }catch{ throw new Error(`Backend response error (${res.status}). Check the Apps Script deployment and access settings.`); }
  if(!data.success) throw new Error(data.message||data.error||'Request failed'); return data;
}

function renderLogin(){
  app.innerHTML=`<main class="login"><section class="login-card"><div class="brand">MULTYBYTE<span>.</span></div><div class="eyebrow" style="margin-top:30px">Vendor Purchase OS</div><h1>Procurement, simplified.</h1><p>Secure workspace for purchase requests, vendor pricing and procurement communication.</p><form id="loginForm"><div class="field"><label>Login type</label><select id="loginRole"><option value="vendor">Vendor</option><option value="admin">Admin</option></select></div><div class="field"><label>User ID / Email</label><input id="loginId" required autocomplete="username"></div><div class="field"><label>Password</label><input id="loginPassword" type="password" required autocomplete="current-password"></div><button class="btn btn-primary" style="width:100%">Sign in</button></form><div class="notice" style="margin-top:18px">Products come from the Google Sheet MASTER catalog. Vendors only see products assigned to their vendor/supplier mapping.</div></section></main>`;
  document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();try{const d=await api('login',{role:loginRole.value,id:loginId.value,password:loginPassword.value});state.user=d.user||{role:d.role,id:d.id,name:d.name};localStorage.setItem('vendorPurchaseSession',d.token||d.sessionToken);await loadApp();}catch(err){toast(err.message)}};
}

async function loadApp(){
  renderShell();
  try{
    const d=await api('getProducts'); state.products=d.products||d.data||[];
    if(state.user.role==='admin'||state.user.role==='Admin'){
      const s=await api('getDashboardStats');
      if(s.stats){document.getElementById('statProducts').textContent=s.stats.totalProducts??s.stats.products??state.products.length;document.getElementById('statVendors').textContent=s.stats.totalVendors??s.stats.vendors??'—';}
      loadBatches();
    }
    renderProducts();
  }catch(e){toast(e.message)}
}

function renderShell(){
  const isAdmin=String(state.user.role).toLowerCase()==='admin';
  app.innerHTML=`<div class="app-shell"><header class="topbar"><div class="brand">MULTYBYTE<span>.</span></div><div class="top-actions"><span class="role">${isAdmin?'ADMIN':'VENDOR'}</span><span class="muted" style="font-size:12px">${esc(state.user.name||state.user.id||'')}</span><button id="logout" class="btn btn-ghost">Logout</button></div></header><main class="content"><section class="hero"><div><div class="eyebrow">Vendor Purchase</div><h1>Purchase workspace</h1><p>Fixed product information. Editable quantity, price, freight and threaded remarks.</p></div><button class="btn btn-lime" id="newBatch">+ New Purchase</button></section><section class="stats"><div class="stat"><small>Products available</small><strong id="statProducts">—</strong></div><div class="stat"><small>Vendors</small><strong id="statVendors">${isAdmin?'—':'Restricted'}</strong></div><div class="stat"><small>Purchase quantity</small><strong id="statQty">0</strong></div><div class="stat"><small>Selected value</small><strong id="statValue">₹0</strong></div></section><section class="workspace"><div class="toolbar"><input class="field search" id="search" placeholder="Search product name or SKU…"><select id="category"><option value="">All categories</option></select><button class="btn btn-ghost" id="refresh">Refresh</button></div><div class="table-wrap"><table class="products"><thead><tr><th>Product</th><th>SKU</th><th>MRP</th><th>Purchase Quantity</th><th>Box Size</th><th>Price</th><th>Remark / Conversation</th><th>Freight Included</th><th>Action</th></tr></thead><tbody id="rows"></tbody></table></div></section><section class="panel" style="margin-top:20px"><h2>Purchase Requests</h2><div id="batches"><div class="muted">Loading…</div></div></section></main></div>`;
  logout.onclick=async()=>{try{await api('logout')}catch{} localStorage.removeItem('vendorPurchaseSession');state.user=null;renderLogin()};
  refresh.onclick=loadApp; newBatch.onclick=()=>document.getElementById('search')?.focus(); search.oninput=renderProducts; category.onchange=renderProducts;
}

function renderProducts(){
  const q=(document.getElementById('search')?.value||'').toLowerCase(); const cat=document.getElementById('category')?.value||'';
  const filtered=state.products.filter(p=>{const name=p['Product Name']||p.productName||'';const key=productKey(p)||'';const c=p.Categories||p.category||'';return (!q||`${name} ${key}`.toLowerCase().includes(q))&&(!cat||c===cat)});
  const categoryEl=document.getElementById('category');
  if(categoryEl&&categoryEl.options.length===1){[...new Set(state.products.map(p=>p.Categories||p.category).filter(Boolean))].sort().forEach(c=>categoryEl.add(new Option(c,c)));}
  const rows=document.getElementById('rows');
  rows.innerHTML=filtered.map((p,i)=>{
    const key=esc(productKey(p)); const img=imageUrl(p); const name=p['Product Name']||p.productName||''; const mrp=p.MRP||p.mrp||''; const box=p['Box Size']||p.boxSize||'—'; const defaultPrice=p.Price??p.price??p['Sale Price']??p.salePrice??p['Direct Purchase']??p.directPurchase??p['India Price']??p.indiaPrice??'';
    return `<tr data-key="${key}"><td><div class="product">${img?`<img class="thumb" src="${esc(img)}" loading="lazy" onerror="this.outerHTML='<div class=\"thumb thumb-fallback\">No image</div>'">`:'<div class="thumb thumb-fallback">No image</div>'}<div><strong>${esc(name)}</strong><div class="muted" style="font-size:11px;margin-top:4px">${esc(p['Brand Name']||p.brandName||'')}</div></div></div></td><td><span class="locked">${key}</span></td><td class="fixed">${money(mrp)}</td><td><input class="qty-input" type="number" min="1" step="1" value="" data-field="qty" placeholder="Units"></td><td class="fixed">${esc(box)}</td><td><input class="price-input" type="number" min="0" step="0.01" value="${esc(defaultPrice)}" data-field="price" placeholder="₹ Price"></td><td><div class="conversation" id="conv_${i}"><textarea class="remark" data-field="remark" placeholder="Add remark / reply…"></textarea></div></td><td><div class="freight"><label><input type="radio" name="fr_${i}" value="Yes"> Yes</label><label><input type="radio" name="fr_${i}" value="No" checked> No</label></div></td><td><button class="btn btn-primary save-row">Save</button></td></tr>`}).join('')||`<tr><td colspan="9" class="empty">No products found.</td></tr>`;
  rows.querySelectorAll('.save-row').forEach(b=>b.onclick=saveRow); updateTotals(); rows.querySelectorAll('input,textarea').forEach(x=>x.addEventListener('input',updateTotals));
}

function updateTotals(){let qty=0,val=0;document.querySelectorAll('tr[data-key]').forEach(r=>{const q=Number(r.querySelector('[data-field="qty"]')?.value||0);const p=Number(r.querySelector('[data-field="price"]')?.value||0);qty+=q;val+=q*p});if(document.getElementById('statQty'))statQty.textContent=qty.toLocaleString('en-IN');if(document.getElementById('statValue'))statValue.textContent=money(val)}

async function saveRow(e){
  const tr=e.target.closest('tr'); const p=state.products.find(x=>String(productKey(x))===tr.dataset.key); if(!p)return;
  const qty=Number(tr.querySelector('[data-field="qty"]').value); if(!qty||qty<1){toast('Enter the number of units you want to purchase.');return}
  const price=Number(tr.querySelector('[data-field="price"]').value); if(!Number.isFinite(price)||price<0){toast('Enter a valid price.');return}
  const remark=tr.querySelector('[data-field="remark"]').value.trim(); const freight=tr.querySelector('input[name^="fr_"]:checked')?.value||'No';
  try{const d=await api('savePurchaseItem',{productSku:productKey(p),productName:p['Product Name']||p.productName,quantity:qty,price,remark,freightIncluded:freight,mrp:p.MRP||p.mrp,boxSize:p['Box Size']||p.boxSize,productImage:imageUrl(p)});toast(d.message||'Purchase item saved.');tr.querySelector('[data-field="remark"]').value='';loadBatches();}catch(err){toast(err.message)}
}

async function loadBatches(){
  try{const d=await api('getPurchaseBatches');state.batches=d.batches||[];const el=document.getElementById('batches');if(!el)return;if(!state.batches.length){el.innerHTML='<div class="muted">No purchase requests yet.</div>';return}el.innerHTML=state.batches.map(b=>`<div style="border-top:1px solid var(--line);padding:14px 0;display:flex;justify-content:space-between;gap:12px;align-items:center"><div><strong>${esc(b.batchId||b.Batch_ID)}</strong><div class="muted" style="font-size:12px">${esc(b.createdAt||'')} · ${esc(b.status||'DRAFT')} · ${esc(b.vendorName||b.vendorId||'')}</div></div><div><strong>${money(b.totalValue)}</strong><div class="muted" style="font-size:12px">${b.totalQuantity||0} units</div></div></div>`).join('')}catch(e){const el=document.getElementById('batches');if(el)el.innerHTML='<div class="muted">Purchase history unavailable.</div>'}
}

(async()=>{const t=token();if(t){try{const d=await api('getSession');state.user=d.user||d.session||d;await loadApp()}catch{localStorage.removeItem('vendorPurchaseSession');renderLogin()}}else renderLogin()})();