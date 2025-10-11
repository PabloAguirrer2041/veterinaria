// main.js — singleton Supabase + rehidratación sólida
(function(){
  // ===== TUS CREDENCIALES REALES =====
  const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";
  // ===================================

  let client = null;
  let creating = null;

  // Devuelve la instancia única
  window.getSupa = async function(){
    if (client) return client;
    if (creating) return creating;

    creating = (async ()=>{
      // Espera a que cargue la librería UMD
      let tries = 0;
      while (!window.supabase && tries < 100) { await new Promise(r=>setTimeout(r,50)); tries++; }
      if (!window.supabase) throw new Error("No se pudo cargar @supabase/supabase-js");

      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "vetapp-auth-v1"
        }
      });

      // Hidrata sesión al arrancar
      try {
        const { data:{ session } } = await client.auth.getSession();
        if (window.onAppSession) window.onAppSession(session?.user || null);
      } catch {}

      // Cambios de auth
      client.auth.onAuthStateChange((_evt, sess)=>{
        if (window.onAppSession) window.onAppSession(sess?.user || null);
      });

      // Rehidratar al volver (BFCache / pestaña visible)
      window.addEventListener("pageshow", async ()=>{
        try {
          const { data:{ session } } = await client.auth.getSession();
          if (window.onAppSession) window.onAppSession(session?.user || null);
        } catch {}
      });
      document.addEventListener("visibilitychange", async ()=>{
        if (!document.hidden){
          try {
            const { data:{ session } } = await client.auth.getSession();
            if (window.onAppSession) window.onAppSession(session?.user || null);
          } catch {}
        }
      });

      return client;
    })();

    return creating;
  };
})();
