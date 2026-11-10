import test from 'node:test';
import assert from 'node:assert/strict';
import { manifest, validateContent, imageExtension } from '../netlify/server/content.mjs';
import app from '../netlify/server/index.mjs';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
const copy=()=>structuredClone(manifest.defaults);
test('all initial website content passes validation',()=>assert.deepEqual(validateContent(copy()),copy()));
test('rejects unsafe gallery URLs and invalid contact numbers',()=>{
  for(const src of ['javascript:alert(1)','data:image/svg+xml,<svg/>','https://example.com/image.jpg','/api/media/../../secret']){
    const data=copy();data.gallery[0].src=src;assert.throws(()=>validateContent(data));
  }
  const data=copy();data.whatsapp='123';assert.throws(()=>validateContent(data));
});
test('rejects incomplete content and overly large fields',()=>{
  const data=copy();delete data.values[manifest.fields[0].key];assert.throws(()=>validateContent(data));
  data.values[manifest.fields[0].key]='x'.repeat(8001);assert.throws(()=>validateContent(data));
});
test('image type is verified from bytes, excluding SVG',()=>{
  assert.equal(imageExtension(Buffer.from([255,216,255,224])),'jpg');
  assert.equal(imageExtension(Buffer.from([137,80,78,71,13,10,26,10])),'png');
  assert.throws(()=>imageExtension(Buffer.from('<svg onload="alert(1)">')));
});
test('public visitors cannot read drafts, save, publish, or upload',async()=>{
  for(const [path,method]of [['content','GET'],['save','POST'],['publish','POST'],['media/upload','POST']]){
    const response=await app.request('https://safari.test/api/admin/'+path,{method,headers:{Origin:'https://safari.test'}});
    assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');
  }
});
test('cross-origin write requests are rejected before session lookup',async()=>{
  const response=await app.request('https://safari.test/api/admin/publish',{method:'POST',headers:{Origin:'https://attacker.test',Cookie:'nf_jwt=invalid'}});
  assert.equal(response.status,403);
});
test('public markup retains booking, navigation, video, and all 23 images',()=>{
  const html=readFileSync('public/index.html','utf8');const $=load(html);
  assert.equal($('.gallery figure').length,23);assert.equal($('#bookingForm').length,1);
  assert.equal($('video source').attr('src'),'assets/safari-video.mp4');
  assert.equal($('.hero-tag').text(),'Discover the Wild. Feel the Wonder.');
  assert.equal($('#editLaunch,#editPanel').length,0);
  assert.ok(html.includes("window.safariContent?.whatsapp"));
  assert.equal($('h1 br').length,2);
  for(const field of manifest.fields) assert.equal($(`[data-cms${field.attr?'-'+field.attr:''}="${field.key}"]`).length,1);
});
