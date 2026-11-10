// A fixed project endpoint prevents Host headers from redirecting session credentials.
const identityUserURL='https://aaramtola-bhimodi-safari.netlify.app/.netlify/identity/user';
export async function requireAdmin(c,next) {
  if (c.req.method !== 'GET' && c.req.header('origin') !== new URL(c.req.url).origin) return c.json({error:'Request origin rejected.'},403);
  const cookie=c.req.header('cookie')?.match(/(?:^|;\s*)nf_jwt=([^;]+)/)?.[1];
  if (!cookie) return c.json({error:'Please sign in.'},401);
  let token;
  try { token=decodeURIComponent(cookie); } catch { return c.json({error:'Invalid session. Please sign in again.'},401); }
  let result;
  try {
    result=await fetch(identityUserURL,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000),redirect:'error'});
  } catch { return c.json({error:'Identity is temporarily unavailable. Please retry.'},503); }
  if (!result.ok) return c.json({error:'Session expired. Please sign in again.'},401);
  const user=await result.json();
  if (!user.id || !Array.isArray(user.app_metadata?.roles) || !user.app_metadata.roles.includes('admin')) return c.json({error:'An administrator role is required. Contact the site owner.'},403);
  c.set('user',user);
  await next();
}
