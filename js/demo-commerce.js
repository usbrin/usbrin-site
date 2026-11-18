/* USBRIN Commerce — catálogo e sacola demonstrativa.
 * Sem checkout, API, armazenamento, pagamento ou coleta de dados.
 */
document.addEventListener('DOMContentLoaded',()=>{
 'use strict';
 const api=window.USBRINCommerce;if(!api)return;
 const store=document.body.dataset.shop;if(!api.collections[store])return;
 const $=selector=>document.querySelector(selector);
 const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
 const items=api.stock.filter(x=>x.store===store);
 const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let cart=[],category='Todos',sort='destaques',currentProduct=null;
 const filters=$('#category-filters'),catalog=$('#product-grid'),search=$('#catalog-search'),sorter=$('#catalog-sort');
 const detail=$('#product-dialog'),cartDialog=$('#cart-dialog');
 const toast=$('#toast');let toastTimer;
 function inform(message){toast.textContent=message;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2600);}
 const nav=$('#site-nav'),menu=$('.menu-toggle');
 if(menu&&nav){
  const close=()=>{nav.classList.remove('open');menu.textContent='Menu';menu.setAttribute('aria-expanded','false');};
  menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Fechar':'Menu';});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('open')){close();menu.focus();}});
 }
 function imageError(img){
  if(img.dataset.imageFallback)return;
  img.dataset.imageFallback='1';img.style.opacity='.17';
  const parent=img.parentElement;
  if(parent){const fallback=document.createElement('span');fallback.className='image-unavailable';fallback.textContent='Fotografia indisponível';fallback.setAttribute('role','note');parent.append(fallback);}
 }
 function watchImages(root){
  root.querySelectorAll('img').forEach(img=>{
    img.addEventListener('error',()=>imageError(img),{once:true});
    if(img.complete&&img.naturalWidth===0)imageError(img);
  });
 }
 function drawFilters(){
  filters.replaceChildren();
  for(const name of api.collections[store].categories){
   const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.category=name;b.setAttribute('aria-pressed',String(name===category));
   b.addEventListener('click',()=>{category=name;drawFilters();drawCatalog();});
   filters.append(b);
  }
 }
 function drawCatalog(){
  const visible=api.list(store,category,search.value,sort);
  catalog.replaceChildren();
  for(const product of visible){
   const el=document.createElement('article');el.className='product-card';el.dataset.productId=product.id;
   el.innerHTML=`<button type="button" class="product-photo" data-view="${safe(product.id)}" aria-label="Ver detalhes de ${safe(product.name)}"><img src="${safe(product.image)}" alt="${safe(product.alt)}" width="980" height="840" loading="lazy" decoding="async"><span class="product-tag">${safe(product.tag)}</span></button><div class="product-copy"><span class="category">${safe(product.category)}</span><h3>${safe(product.name)}</h3><p>${safe(product.description)}</p><strong class="product-price">${money(product.price)}<small>Valor demonstrativo</small></strong><div class="product-actions"><button type="button" data-view="${safe(product.id)}">Ver detalhes</button><button type="button" class="add" data-add="${safe(product.id)}">Adicionar +</button></div></div>`;
   el.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>openDetails(product)));
   el.querySelector('[data-add]').addEventListener('click',()=>addItem(product.id,product.variants[0],1));
   catalog.append(el);watchImages(el);
  }
  $('#catalog-count').textContent=visible.length===1?'1 produto encontrado':visible.length+' produtos encontrados';
  $('#catalog-empty').hidden=visible.length!==0;
 }
 function openDetails(item){
  currentProduct=item;
  $('#detail-image').src=item.image;
  $('#detail-image').alt=item.alt;
  $('#detail-category').textContent=item.category+' · '+item.tag;
  $('#product-dialog-title').textContent=item.name;
  $('#detail-description').textContent=item.description;
  $('#detail-price').textContent=money(item.price)+' · valor demonstrativo';
  $('#detail-variant-label').textContent=item.variantLabel;
  const variants=$('#detail-variant');variants.replaceChildren();
  for(const value of item.variants){const option=document.createElement('option');option.value=value;option.textContent=value;variants.append(option);}
  $('#detail-quantity').value='1';
  detail.showModal();
 }
 function addItem(id,variant,quantity){
  const next=api.add(cart,id,variant,quantity);
  if(!next){inform('Revise a quantidade: máximo de 10 unidades por opção.');return;}
  cart=next;drawCart();
  inform('Adicionado à sacola demonstrativa.');
 }
 function drawCart(){
  const container=$('#cart-items');container.replaceChildren();
  for(const line of cart){
   const product=api.byId(line.id);
   if(!product)continue;
   const row=document.createElement('article');row.className='cart-line';
   row.innerHTML=`<img src="${safe(product.image)}" width="90" height="90" alt="${safe(product.alt)}" loading="lazy"><div><h3>${safe(product.name)}</h3><p>${safe(line.variant)} · ${safe(product.category)}</p><strong>${money(product.price*line.quantity)}</strong><div class="cart-quantity"><button type="button" class="decrement" aria-label="Diminuir quantidade de ${safe(product.name)}">−</button><span>${line.quantity}</span><button type="button" class="increment" aria-label="Aumentar quantidade de ${safe(product.name)}">+</button><button type="button" class="remove">Remover</button></div></div>`;
   function update(q){const next=api.setQuantity(cart,line.id,line.variant,q);if(next){cart=next;drawCart();}else inform('Máximo de 10 unidades por opção.');}
   row.querySelector('.decrement').addEventListener('click',()=>update(line.quantity-1));
   row.querySelector('.increment').addEventListener('click',()=>update(line.quantity+1));
   row.querySelector('.remove').addEventListener('click',()=>update(0));
   container.append(row);watchImages(row);
  }
  const totals=api.totals(cart);
  const has=!!totals&&totals.quantity>0;
  document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=String(totals?.quantity||0));
  $('#cart-empty').hidden=has;
  $('#cart-totals').hidden=!has;
  if(has){
   $('#cart-subtotal').textContent=money(totals.subtotal);
   $('#cart-delivery').textContent=totals.freeDelivery?'Grátis (simulado)':money(totals.delivery);
   $('#cart-total').textContent=money(totals.total);
  }
 }
 document.querySelectorAll('[data-open-cart]').forEach(button=>button.addEventListener('click',()=>{drawCart();cartDialog.showModal();}));
 $('[data-close-cart]').addEventListener('click',()=>cartDialog.close());
 $('[data-close-product]').addEventListener('click',()=>detail.close());
 [detail,cartDialog].forEach(d=>d.addEventListener('click',event=>{if(event.target===d)d.close();}));
 $('#detail-add').addEventListener('click',()=>{
  if(!currentProduct)return;
  const q=Number($('#detail-quantity').value);
  if(!Number.isInteger(q)||q<1||q>10){inform('Escolha uma quantidade entre 1 e 10.');return;}
  const next=api.add(cart,currentProduct.id,$('#detail-variant').value,q);
  if(!next){inform('Não foi possível adicionar essa quantidade.');return;}
  cart=next;detail.close();drawCart();cartDialog.showModal();
 });
 search.addEventListener('input',drawCatalog);
 sorter.addEventListener('change',()=>{sort=sorter.value;drawCatalog();});
 drawFilters();drawCatalog();drawCart();watchImages(document);
});
