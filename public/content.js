(async()=>{
  try {
    const response=await fetch('/api/content',{cache:'no-store'});
    if(!response.ok) return;
    const data=await response.json();
    window.safariContent=data;
    document.querySelectorAll('[data-cms]').forEach(el=>{const value=data.values[el.dataset.cms];if(typeof value==='string')el.textContent=value;});
    for(const attr of ['placeholder','alt','aria-label','content']) document.querySelectorAll('[data-cms-'+attr+']').forEach(el=>{const value=data.values[el.getAttribute('data-cms-'+attr)];if(typeof value==='string')el.setAttribute(attr,value);});
    document.querySelectorAll('[data-phone-index]').forEach(el=>{const number=data.phones[Number(el.dataset.phoneIndex)];el.href='tel:'+number;el.textContent=(el.closest('.contactlinks')?'☎ ':'')+number;});
    const gallery=document.querySelector('.gallery');
    gallery.replaceChildren(...data.gallery.map(photo=>{
      const figure=document.createElement('figure');figure.className='photo';
      const img=document.createElement('img');img.src=photo.src;img.alt=photo.alt;img.loading='lazy';
      const caption=document.createElement('figcaption');caption.textContent=photo.caption;
      figure.append(img,caption);return figure;
    }));
  } catch { /* Existing static content remains available when the service is offline. */ }
})();
