import { login, logout, getUser, handleAuthCallback, acceptInvite, recoverPassword, refreshSession } from '@netlify/identity';
const $=id=>document.getElementById(id);
let data,revision=0,manifest,dirty=false,busy=false,invite,recovery,conflict=false;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);if(error)$('status').scrollIntoView({block:'nearest',behavior:'smooth'});}
function changed(){dirty=true;$('dirty').textContent='Unsaved changes';}
async function api(path,options={}){
  await refreshSession();
  const response=await fetch('/api/admin/'+path,{...options,credentials:'same-origin',cache:'no-store'});
  const result=await response.json();
  if(!response.ok){if(response.status===409)conflict=true;throw new Error(result.error || 'Request failed.');}
  return result;
}
function lock(value){busy=value;document.querySelectorAll('#studio input,#studio textarea,#studio button,#studio select').forEach(el=>el.disabled=value);}
async function openStudio(){
  const [schema,result]=await Promise.all([fetch('/content-defaults.json').then(r=>r.json()),api('content')]);
  manifest=schema;data=result.data;revision=result.revision;
  $('publication').textContent=result.publishedAt?'Last published '+new Date(result.publishedAt).toLocaleString():'Your current website is live. No CMS changes published yet.';
  $('auth').hidden=true;$('studio').hidden=false;
  const sections=[...new Set(manifest.fields.map(f=>f.section))];
  $('section').replaceChildren(new Option('All sections',''),...sections.map(s=>new Option(s,s)));
  renderText();renderGallery();
  data.phones.forEach((number,i)=>{$('phone'+i).value=number;$('phone'+i).oninput=e=>{data.phones[i]=e.target.value.trim();changed();};});
  $('whatsapp').value=data.whatsapp;$('whatsapp').oninput=e=>{data.whatsapp=e.target.value.trim();changed();};
}
function renderText(){
  const search=$('search').value.toLowerCase(), section=$('section').value;
  const fields=manifest.fields.filter(f=>(!section||f.section===section)&&(!search||[f.label,data.values[f.key],f.section].some(v=>v.toLowerCase().includes(search))));
  $('text').replaceChildren(...fields.map(field=>{
    const label=document.createElement('label');label.className='textfield';
    const small=document.createElement('small');small.textContent=field.section+(field.attr?' · '+field.attr:'');
    const name=document.createElement('span');name.textContent=field.label;
    const input=document.createElement('textarea');input.value=data.values[field.key];input.maxLength=8000;input.rows=input.value.length>150?4:2;
    input.addEventListener('input',()=>{data.values[field.key]=input.value;changed();});
    label.append(small,name,input);return label;
  }));
  if(!fields.length){const p=document.createElement('p');p.textContent='No matching text. Try another search or section.';$('text').append(p);}
}
function button(label,handler){const el=document.createElement('button');el.type='button';el.className='secondary';el.textContent=label;el.onclick=handler;return el;}
function uploadControl(label,handler){const el=document.createElement('label');el.className='upload';el.textContent=label;const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.onchange=()=>{if(input.files[0])handler(input.files[0]);};el.append(input);return el;}
async function upload(file){
  if(file.size>5*1024*1024)throw new Error('Choose an image under 5 MB.');
  const result=await api('media/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});return result.src;
}
async function replaceImage(index,file){lock(true);status('Uploading photograph…');try{data.gallery[index].src=await upload(file);changed();status('Photograph replaced in your draft. Publish to update the website.');}catch(error){status(error.message,true);}finally{lock(false);renderGallery();}}
function renderGallery(){
  $('photos').replaceChildren(...data.gallery.map((image,index)=>{
    const card=document.createElement('article');card.className='photo';
    const preview=document.createElement('img');preview.src='/'+image.src.replace(/^\//,'');preview.alt=image.alt;preview.loading='lazy';
    const controls=document.createElement('div');
    for(const [key,title]of [['alt','Image description (accessibility)'],['caption','Caption']]){
      const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.value=image[key];input.maxLength=500;input.oninput=()=>{image[key]=input.value;changed();};label.append(input);controls.append(label);
    }
    const actions=document.createElement('div');actions.className='actions';
    const up=button('Move up',()=>{if(index){[data.gallery[index-1],data.gallery[index]]=[image,data.gallery[index-1]];changed();renderGallery();}});up.disabled=index===0;
    const down=button('Move down',()=>{if(index<data.gallery.length-1){[data.gallery[index+1],data.gallery[index]]=[image,data.gallery[index+1]];changed();renderGallery();}});down.disabled=index===data.gallery.length-1;
    actions.append(uploadControl('Replace image',file=>replaceImage(index,file)),up,down,button('Remove',()=>{data.gallery.splice(index,1);changed();renderGallery();}));
    controls.append(actions);card.append(preview,controls);return card;
  }));
  if(!data.gallery.length)$('photos').textContent='Your gallery is empty. Add photographs to begin.';
}
$('addImages').onchange=async e=>{
  const files=[...e.target.files];if(!files.length)return;
  lock(true);status('Uploading photographs…');
  try{for(const file of files){if(data.gallery.length>=100)throw new Error('Use at most 100 photographs.');const src=await upload(file);data.gallery.push({src,alt:file.name.replace(/\.[^.]+$/,''),caption:''});changed();}status('Photographs added to your draft. Publish when ready.');}
  catch(error){status(error.message,true);}finally{e.target.value='';lock(false);renderGallery();}
};
for(const action of ['save','publish'])$(action).onclick=async()=>{
  if(busy)return;
  if(conflict){status('Reload to get the latest draft before saving. Copy your unsaved text first.',true);return;}
  lock(true);status(action==='publish'?'Publishing your website…':'Saving your private draft…');
  try{
    const result=await api(action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision})});
    revision=result.revision;dirty=false;$('dirty').textContent='All changes saved';
    status(action==='publish'?'Published. Visitors see your changes on their next page load.':'Draft saved. The public website is unchanged.');
    if(action==='publish')$('publication').textContent='Last published '+new Date().toLocaleString();
  }catch(error){status(error.message,true);}finally{lock(false);}
};
$('search').oninput=renderText;$('section').onchange=renderText;
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('.tab').forEach(tab=>tab.hidden=tab.id!==button.dataset.tab);});
$('logout').onclick=async()=>{if(dirty&&!confirm('Sign out and discard your unsaved changes?'))return;try{await logout();dirty=false;location.reload();}catch{status('Unable to sign out. Please try again.',true);}};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
$('loginForm').onsubmit=async e=>{
  e.preventDefault();$('loginButton').disabled=true;status('Signing in…');
  try{
    if(invite)await acceptInvite(invite,$('password').value);
    else if(recovery)await recoverPassword(recovery,$('password').value);
    else await login($('email').value.trim(),$('password').value);
    $('password').value='';invite=null;recovery=null;await openStudio();status('Signed in. Changes remain private until you publish.');
  }catch(error){status(error.message||'Sign-in failed. Check your details and try again.',true);}finally{$('loginButton').disabled=false;}
};
(async()=>{
  try{
    // Capture recovery before the SDK consumes the callback hash.
    const params=new URLSearchParams(location.hash.slice(1));recovery=params.get('recovery_token');
    const result=recovery?null:await handleAuthCallback();
    if(recovery||result?.type==='invite'){
      invite=result?.token;history.replaceState(null,'',location.pathname);
      $('email').required=false;$('email').closest('label').hidden=true;$('password').autocomplete='new-password';$('password').minLength=12;
      $('loginButton').textContent=recovery?'Set new password':'Accept invitation';$('accountNote').textContent='Choose a password of at least 12 characters. An admin role is required before you can edit.';return;
    }
    $('password').removeAttribute('minlength');
    if(await getUser())await openStudio();
  }catch(error){status(error.message||'Authentication is unavailable. Please try again later.',true);}
})();
