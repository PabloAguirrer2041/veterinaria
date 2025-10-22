// ===================================
// main.js (¡EL CORREGIDO!)
// ===================================
// Este archivo NO tiene el bucle infinito de "getSession"
// dentro de "onAuthStateChange".

const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";

let supa = null;         // cliente compartido
let supaMod = null;      // módulo ESM
let creating = null;     // promesa en curso
const listeners = new Set();
let authBound = false;

export function ready(fn){
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn, { once:true });
}

async function tryImport(url){ try{ return await import(/* @vite-ignore */ url); }catch{ return null; } }
async function loadUMD(){
  if (globalThis.supabase) return globalThis.supabase;
  const urls = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.6/dist/umd/supabase.min.js",
    "https://unpkg.com/@supabase/supabase-js@2.45.6/dist/umd/supabase.min.js"
  ];
  for (const u of urls){
    const ok = await new Promise(res=>{
      const s=document.createElement("script"); s.src=u; s.defer=true;
      s.onload=()=>res(true); s.onerror=()=>res(false); document.head.appendChild(s);
    });
    if (ok && globalThis.supabase) return globalThis.supabase;
  }
  throw new Error("No se pudo cargar supabase-js (UMD).");
}

export async function getSupa(){
  if (supa) return supa;
  if (creating) return creating;

  creating = (async ()=>{
    // ESM por CDN (con fallback a 3 orígenes) y si falla, UMD
    supaMod = await tryImport("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.6/+esm")
           || await tryImport("https://unpkg.com/@supabase/supabase-js@2.45.6/+esm")
           || await tryImport("https://esm.sh/@supabase/supabase-js@2.45.6");
    let createClient;

    if (supaMod?.createClient) {
      createClient = supaMod.createClient;
    } else {
      const umd = await loadUMD();           // window.supabase
      createClient = umd.createClient.bind(umd);
    }

    supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });

    if (!authBound){
      // ¡ESTA ES LA CORRECCIÓN!
      // Usamos (event, session) que nos da el listener.
      // NO volvemos a llamar a supa.auth.getSession().
      supa.auth.onAuthStateChange((event, session)=>{
        const user = session?.user || null;
        for (const cb of [...listeners]) try{ cb(user); }catch{}
      });
      authBound = true;
    }

    // Se eliminó el "primer emit" redundante.

    return supa;
  })();

  return creating;
}

export function onSession(cb){
  // Se eliminó la llamada redundante a getSession()
  listeners.add(cb);
  return ()=>listeners.delete(cb);
}

export const idToEmail = (id)=>`${String(id||"").trim().toLowerCase()}@doctores.local`;