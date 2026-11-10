import { requireAdmin } from './auth.mjs';
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/netlify-db';
import { eq, sql } from 'drizzle-orm';
import { getStore } from '@netlify/blobs';
import { content } from '../../db/schema.ts';
import { manifest, validateContent, imageExtension } from './content.mjs';
import { randomUUID } from 'node:crypto';
const app = new Hono();
const db = drizzle();
const media = () => getStore({name:'safari-gallery',consistency:'strong'});
app.use('/api/*', async (c,next) => {
  c.header('Cache-Control','no-store');
  c.header('X-Content-Type-Options','nosniff');
  await next();
});
app.use('/api/admin/*', requireAdmin);
app.get('/api/content', async c => {
  const [row] = await db.select().from(content).where(eq(content.id,'published'));
  return c.json(row?.data || manifest.defaults);
});
app.get('/api/admin/content', async c => {
  const rows = await db.select().from(content);
  const draft = rows.find(row=>row.id==='draft');
  const published = rows.find(row=>row.id==='published');
  return c.json({data:draft?.data || published?.data || manifest.defaults,revision:draft?.revision || 0,publishedAt:published?.updatedAt || null});
});
app.post('/api/admin/:action', async c => {
  const action = c.req.param('action');
  if (!['save','publish'].includes(action)) return c.json({error:'Unknown action.'},404);
  if (Number(c.req.header('content-length')) > 1500000) return c.json({error:'Content is too large.'},413);
  const raw = await c.req.text();
  if (raw.length > 1500000) return c.json({error:'Content is too large.'},413);
  let body, data;
  try {body=JSON.parse(raw);data=validateContent(body.data);if(!Number.isSafeInteger(body.revision)||body.revision<0) throw new Error('Invalid revision.');}
  catch(error){return c.json({error:error.message || 'Invalid content.'},400);}
  try {
    const revision = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(741293)`);
      const [draft] = await tx.select().from(content).where(eq(content.id,'draft'));
      if ((draft?.revision || 0) !== body.revision) throw new Error('CONFLICT');
      const revision = body.revision + 1;
      const update = {data,revision,updatedAt:new Date(),updatedBy:c.get('user').id};
      await tx.insert(content).values({id:'draft',...update}).onConflictDoUpdate({target:content.id,set:update});
      if (action==='publish') await tx.insert(content).values({id:'published',...update}).onConflictDoUpdate({target:content.id,set:update});
      return revision;
    });
    return c.json({revision,published:action==='publish'});
  } catch(error) {
    if(error.message==='CONFLICT') return c.json({error:'Another session saved newer changes. Reload before editing again; copy any unsaved text first.'},409);
    throw error;
  }
});
app.post('/api/admin/media/upload', async c => {
  const max = 5 * 1024 * 1024;
  if (Number(c.req.header('content-length')) > max) return c.json({error:'Choose an image under 5 MB.'},413);
  const reader = c.req.raw.body?.getReader();
  if (!reader) return c.json({error:'Choose an image.'},400);
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>max){await reader.cancel();return c.json({error:'Choose an image under 5 MB.'},413);}chunks.push(Buffer.from(value));}
  const bytes=Buffer.concat(chunks);
  let extension;
  try {extension=imageExtension(bytes);}catch(error){return c.json({error:error.message},400);}
  const key=randomUUID()+'.'+extension;
  await media().set(key,new Uint8Array(bytes));
  return c.json({src:'/api/media/'+key},201);
});
app.get('/api/media/:key', async c => {
  const key=c.req.param('key');
  if(!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) return c.notFound();
  const bytes=await media().get(key,{type:'arrayBuffer'});
  if(!bytes) return c.notFound();
  const extension=key.split('.').pop();
  return new Response(bytes,{headers:{'Content-Type':extension==='jpg'?'image/jpeg':'image/'+extension,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
});
app.onError((error,c)=>c.json({error:'The service is unavailable. Your changes have not been confirmed; please try again.'},503));
export default app;
