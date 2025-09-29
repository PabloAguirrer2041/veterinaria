// main.js — inicializa Supabase una sola vez con multi-fallback
const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";

let supa = null;
let supaMod = null;
let creating = null;
const listeners = new Set();
let authBound = false;

function ready(fn){
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn, { once:true });
}
export { ready };

// ------- import con múltiples rutas + fallback UMD -------
async function tryImport(url){
  try { return await import(/* @vite-ignore */ url); } catch { return null; }
}
async function loadUMD(){
  if (globalThis.supabase) return globalThis.supabase;
  const urls = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.6/dist/umd/supabase.min.js",
    "https://unpkg.com/@supabase/supabase-js@2.45.6/dist/umd/supabase.min.js"
  ];
  for (const u of urls){
    const ok = await new Promise(res=>{
      const s=document.createElement("script");
      s.src=u; s.defer=true;
      s.onload=()=>res(true); s.onerror=()=>res(false);
      document.head.appendChild(s);
    });
    if (ok && globalThis.supabase) return globalThis.supabase;
  }
  throw new Error("No se pudo cargar supabase-js (UMD).");
}

// ------- crea cliente una única vez -------
export async function getSupa(){
  if (supa) return supa;
  if (creating) return creating;
  creating = (async()=>{
    // 1) ESM por CDN
    supaMod =
      await tryImport("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.6/+esm")
      || await tryImport("https://unpkg.com/@supabase/supabase-js@2.45.6/+esm")
      || await tryImport("https://esm.sh/@supabase/supabase-js@2.45.6")
      ;

    let createClient;
    if (supaMod?.createClient) {
      createClient = supaMod.createClient;
    } else {
      // 2) Fallback UMD → tomar createClient de window.supabase
      const umd = await loadUMD();
      createClient = umd.createClient.bind(umd);
    }

    supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });

    if (!authBound){
      supa.auth.onAuthStateChange(async ()=>{
        const { data:{ session } } = await supa.auth.getSession();
        const user = session?.user || null;
        for (const cb of [...listeners]) { try{ cb(user); }catch{} }
      });
      authBound = true;
    }

    // primer “emit”
    const { data:{ session } } = await supa.auth.getSession();
    const user = session?.user || null;
    for (const cb of [...listeners]) { try{ cb(user); }catch{} }

    return supa;
  })();
  return creating;
}

export function onSession(cb){
  listeners.add(cb);
  if (supa) supa.auth.getSession().then(({data:{session}})=>cb(session?.user||null)).catch(()=>{});
  return ()=>listeners.delete(cb);
}

export const idToEmail = (id)=>`${String(id||"").trim().toLowerCase()}@doctores.local`;
