// programador.js (VERSIÓN FINAL OPTIMIZADA)

const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";

let supa = null;
const listeners = new Set();
let authBound = false;
let supaPromise = null;

// --- 1. CONEXIÓN ---
async function getSupa(){
  if (supa) return supa;
  if (supaPromise) return supaPromise;

  supaPromise = (async () => {
    while (!window.supabase) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    if (!authBound){
      supa.auth.onAuthStateChange((event, session)=>{
        const user = session?.user || null;
        for (const cb of [...listeners]) try{ cb(user); }catch{}
      });
      authBound = true;
    }
    const { data:{ session } } = await supa.auth.getSession();
    const user = session?.user || null;
    for (const cb of [...listeners]) try{ cb(user); }catch{}
    return supa;
  })();
  return supaPromise;
}

function onSession(cb){
  listeners.add(cb);
  if (supa) {
      supa.auth.getSession().then(({ data: { session } }) => {
          cb(session?.user || null);
      }).catch(err => console.error(err));
  }
  return ()=>listeners.delete(cb);
}

function ready(fn){
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn, { once:true });
}

// --- 2. LÓGICA UI ---
const $ = (s)=>document.querySelector(s);
const uuid = ()=> (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36)+Math.random().toString(36).slice(2)));

let user = null;
let current = null;

function updateAuthUI(isLoggedIn) {
  const authFields = document.querySelectorAll('.auth-field');
  const logoutBtn = $("#btnLogout");
  if (isLoggedIn) {
    authFields.forEach(el => el.classList.add('hide'));
    logoutBtn.classList.remove('hide');
  } else {
    authFields.forEach(el => el.classList.remove('hide'));
    logoutBtn.classList.add('hide');
  }
}

function setOnline(on){
  $("#btnSave").disabled   = !on;
  $("#btnUpdate").disabled = !on || !current;
  $("#btnDelete").disabled = !on || !current;
}

function logMsg(m){ 
  const el=$("#log"); 
  if(el) {
    el.classList.remove("hide"); 
    el.textContent += m + "\n"; 
    el.scrollTop = el.scrollHeight; 
  }
}

// --- GENERACIÓN DE LINK CORTO (AUTOMÁTICA) ---
async function showLink(id) {
  const longUrl = window.location.origin + `/perfil.html?id=${id}`;
  const container = $("#newLink");
  const btnSend = $("#btnSendToEsp");
  const iotControls = $("#iotControls");

  // 1. Mostrar estado de carga y bloquear botón
  if(btnSend) {
    btnSend.disabled = true;
    btnSend.textContent = "Generando link corto...";
  }
  
  if(iotControls) iotControls.classList.remove("hide");

  if(container) {
    container.innerHTML = `
      <label style="font-size:12px; color:#5b6b83;">Conectando con acortador...</label>
      <div style="height:4px; width:100%; background:#e0f2f1; overflow:hidden; border-radius:2px;">
        <div style="height:100%; width:50%; background:#0ea5a0; animation:loading 1s infinite;"></div>
      </div>
      <style>@keyframes loading {0%{margin-left:-50%} 100%{margin-left:100%}}</style>
    `;
  }

  try {
    // 2. Acortar el link (API Fetch)
    const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
    let finalUrl = longUrl;
    
    if (response.ok) {
      finalUrl = await response.text();
    }

    // 3. Mostrar el resultado final
    if(container) {
      container.innerHTML = `
        <label style="font-size:12px; color:#5b6b83; display:block; margin-bottom:4px;">Link Corto (Listo para grabar):</label>
        <input id="currentUrlInput" type="text" value="${finalUrl}" readonly onclick="this.select()" style="width:100%; padding:10px; border:2px solid #0ea5a0; border-radius:8px; background:#f0fdfd; color:#0f172a; font-weight:bold; font-family: monospace;">
      `;
    }

    // 4. Habilitar botón de envío
    if(btnSend) {
      btnSend.disabled = false;
      btnSend.textContent = "Enviar código al Programador";
    }

  } catch (error) {
    console.error("Error acortando link:", error);
    // Fallback: Mostrar link largo si falla el acortador
    if(container) container.innerHTML = `<input id="currentUrlInput" type="text" value="${longUrl}" readonly style="width:100%;">`;
    if(btnSend) {
      btnSend.disabled = false;
      btnSend.textContent = "Enviar código (Largo)";
    }
  }
}

function fillForm(p){
  if($("#f_nombre")) $("#f_nombre").value = p?.nombre || "";
  if($("#f_raza")) $("#f_raza").value   = p?.raza   || "";
  if($("#f_edad")) $("#f_edad").value   = p?.edad   ?? "";
  if($("#f_sexo")) $("#f_sexo").value   = p?.sexo   || "";
  if($("#f_duenio")) $("#f_duenio").value = p?.duenio || "";
  if($("#f_tel")) $("#f_tel").value    = p?.telefono || "";
  if($("#f_email")) $("#f_email").value  = p?.email || "";
  if($("#f_hist")) $("#f_hist").value   = p?.historial || "";
  if($("#f_notas_publicas")) $("#f_notas_publicas").value = p?.notas_publicas || "";
  if($("#f_contacto_publico")) $("#f_contacto_publico").checked = !!p?.contacto_publico;

  if (p?.id) {
    showLink(p.id); // <-- Aquí se dispara la generación automática
  } else {
    if($("#newLink")) $("#newLink").innerHTML = "";
    const iotControls = $("#iotControls");
    if(iotControls) iotControls.classList.add("hide");
  }
}

/* --------- Autenticación --------- */
async function doLogin(){
  try{
    const supa = await getSupa();
    const emailEl = $("#docId");
    const pwdEl = $("#docPwd");
    
    if(!emailEl || !pwdEl) return;

    const email = emailEl.value.trim();
    const pwd = pwdEl.value.trim();
    
    if (!email || !pwd) return alert("Escribe Correo y contraseña");
    
    const { error } = await supa.auth.signInWithPassword({ email, password: pwd });
    if (error) return alert(`Error: ${error.message}`);
    
    pwdEl.value = "";
  }catch(e){ console.error("[login]", e); alert("No se pudo iniciar sesión."); }
}

async function doLogout(){
  try{
    const supa = await getSupa();
    await supa.auth.signOut();
    location.reload(); 
  }catch(e){ console.warn("[logout]", e); }
}

/* --------- Storage --------- */
async function uploadPhoto(file){
  if(!file) return null;
  const supa = await getSupa();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `mascotas/${uuid()}.${ext}`;
  const { error } = await supa.storage.from("fotos").upload(path, file, { upsert:false });
  if (error){ logMsg("⚠️ Upload: " + error.message); return null; }
  const { data } = supa.storage.from("fotos").getPublicUrl(path);
  return data.publicUrl || null;
}

/* --------- CRUD --------- */
async function saveNew(){
  if(!user) return alert("Inicia sesión para guardar.");
  const supa = await getSupa();
  $("#btnSave").disabled = true;

  const fileInput = $("#f_foto");
  const file = fileInput?.files?.[0];
  const foto_url = file ? await uploadPhoto(file) : null;

  const payload = {
    nombre:   $("#f_nombre").value.trim(),
    raza:     $("#f_raza").value.trim(),
    edad:     $("#f_edad").value ? Number($("#f_edad").value) : null,
    sexo:     $("#f_sexo").value,
    duenio:   $("#f_duenio").value.trim(),
    telefono: $("#f_tel").value.trim(),
    email:    $("#f_email").value.trim(),
    historial:$("#f_hist").value.trim(),
    notas_publicas: $("#f_notas_publicas").value.trim(),
    contacto_publico: $("#f_contacto_publico").checked,
    foto_url,
    owner_id: user.id
  };

  if(!payload.nombre){ alert("Nombre es obligatorio"); $("#btnSave").disabled=false; return; }

  const { data, error } = await supa.from("mascotas").insert(payload).select("id").single();
  if(error){ logMsg("✖ Insert: " + error.message); }
  else { 
    logMsg("✅ Guardado ID " + data.id); 
    current = { id:data.id, ...payload }; 
    $("#btnUpdate").disabled=false; 
    $("#btnDelete").disabled=false;
    showLink(data.id); // <-- Generar link al guardar
    window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'});
  }
  $("#btnSave").disabled = false;
}

async function updateCurrent(){
  if(!user || !current) return;
  const supa = await getSupa();
  $("#btnUpdate").disabled = true;

  let foto_url = current.foto_url || null;
  const fileInput = $("#f_foto");
  const file = fileInput?.files?.[0];
  if (file){ const up = await uploadPhoto(file); if(up) foto_url = up; }

  const payload = {
    nombre:   $("#f_nombre").value.trim(),
    raza:     $("#f_raza").value.trim(),
    edad:     $("#f_edad").value ? Number($("#f_edad").value) : null,
    sexo:     $("#f_sexo").value,
    duenio:   $("#f_duenio").value.trim(),
    telefono: $("#f_tel").value.trim(),
    email:    $("#f_email").value.trim(),
    historial:$("#f_hist").value.trim(),
    notas_publicas: $("#f_notas_publicas").value.trim(),
    contacto_publico: $("#f_contacto_publico").checked,
    foto_url
  };

  const { error } = await supa.from("mascotas").update(payload).eq("id", current.id);
  if(error){ logMsg("✖ Update: " + error.message); }
  else { 
    logMsg("✅ Actualizado ID " + current.id); 
    showLink(current.id); // <-- Generar link al actualizar
  }
  $("#btnUpdate").disabled = false;
}

async function deleteCurrent(){
  if(!user || !current) return;
  if(!confirm(`¿Eliminar registro ID ${current.id}?`)) return;
  const supa = await getSupa();
  $("#btnDelete").disabled = true;
  const { error } = await supa.from("mascotas").delete().eq("id", current.id);
  if(error){ logMsg("✖ Delete: " + error.message); $("#btnDelete").disabled=false; return; }
  logMsg("🗑️ Eliminado ID " + current.id);
  current = null;
  $("#btnUpdate").disabled = true;
  $("#btnDelete").disabled = true;
  if($("#results")) $("#results").innerHTML = "";
  fillForm({});
}

async function search(){
  const supa = await getSupa();
  const qEl = $("#q");
  const q = qEl ? qEl.value.trim() : "";
  const results = $("#results");
  if(results) results.innerHTML = "";
  
  if(!q){ if(results) results.innerHTML = `<div class="muted">Escribe un nombre o ID.</div>`; return; }

  let query = supa
    .from("mascotas")
    .select("id,nombre,raza,edad,sexo,duenio,telefono,email,historial,foto_url,notas_publicas,contacto_publico")
    .order("id",{ascending:false}).limit(20);

  const n = Number(q);
  query = (Number.isFinite(n) && String(n)===q)
    ? query.or(`id.eq.${n},nombre.ilike.%${q}%`)
    : query.ilike("nombre", `%${q}%`);

  const { data, error } = await query;
  if(error){ if(results) results.innerHTML = `<div class="muted">Error: ${error.message}</div>`; return; }
  if(!data?.length){ if(results) results.innerHTML = `<div class="muted">Sin resultados.</div>`; return; }

  data.forEach(p=>{
    const card = document.createElement("div");
    card.className = "item";
    const foto = p.foto_url || "img/perrito.jpg";
    card.innerHTML = `
      <img src="${foto}" alt="${p.nombre}">
      <div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${p.nombre}</strong>
          <span class="pill">ID: ${p.id}</span>
          <span class="muted">${p.raza || ""} ${p.sexo?(" · "+p.sexo):""}</span>
        </div>
        <div class="muted">Dueño: ${p.duenio || "—"}</div>
      </div>`;
    card.onclick = ()=>{ current = p; fillForm(p); $("#btnUpdate").disabled=false; $("#btnDelete").disabled=false; window.scrollTo({top:0,behavior:'smooth'}); };
    if(results) results.appendChild(card);
  });
}

// --- IOT & HEARTBEAT ---
let espTimer = null;
function updateEspStatus(online) {
  const el = $("#espStatus");
  if(!el) return;
  const dot = el.querySelector("div");
  const text = el.querySelector("span");
  if (online) {
    el.style.background = "#dcfce7"; el.style.color = "#15803d"; el.style.borderColor = "#86efac";
    dot.style.background = "#15803d"; dot.style.boxShadow = "0 0 0 2px #dcfce7";
    text.textContent = "Programador: Conectado";
  } else {
    el.style.background = "#fee2e2"; el.style.color = "#b91c1c"; el.style.borderColor = "#fecaca";
    dot.style.background = "#b91c1c"; dot.style.boxShadow = "none";
    text.textContent = "Programador: Desconectado";
  }
}

async function initEspMonitor() {
  const supa = await getSupa();
  const checkHeartbeat = async () => {
    try {
      const { data } = await supa.from('status_esp32').select('updated_at').eq('id', 1).single();
      if (data) {
        const lastSeen = new Date(data.updated_at).getTime();
        const diff = Math.abs(new Date().getTime() - lastSeen);
        if (diff < 60000) updateEspStatus(true);
        else updateEspStatus(false);
      }
    } catch (err) {}
  };
  checkHeartbeat();
  setInterval(checkHeartbeat, 5000);
}

// --- FUNCIÓN DE ENVÍO INSTANTÁNEO ---
async function sendToDevice() {
  const urlInput = $("#currentUrlInput");
  // Aquí tomamos lo que YA está en la caja (el link corto)
  const urlToSend = urlInput ? urlInput.value : "";
  
  if (!urlToSend) return alert("No hay URL lista. Espera a que se genere.");
  
  const statusMsg = $("#iotStatusMsg");
  const btn = $("#btnSendToEsp");

  if(btn) { btn.disabled = true; btn.textContent = "Enviando..."; }
  if(statusMsg) { statusMsg.style.display = "block"; statusMsg.textContent = "⏳ Enviando orden..."; }

  try {
    const supa = await getSupa();
    const { error } = await supa.from('status_esp32').update({ pending_write: urlToSend }).eq('id', 1);
    if (error) throw error;

    if(statusMsg) { 
        statusMsg.textContent = "✅ ¡Enviado! Acerca la etiqueta ahora."; 
        statusMsg.style.color = "green"; 
    }
    
    setTimeout(() => {
      if(btn) { btn.disabled = false; btn.textContent = "Enviar código al Programador"; }
      if(statusMsg) statusMsg.textContent = "";
    }, 5000);
  } catch (e) {
    console.error(e);
    if(statusMsg) { statusMsg.textContent = "❌ Error: " + e.message; statusMsg.style.color = "red"; }
    if(btn) { btn.disabled = false; btn.textContent = "Reintentar"; }
  }
}

/* --------- ARRANQUE --------- */
ready(async ()=>{
  try { await getSupa(); } catch(e){ console.error(e); setOnline(false); return; }
  
  const loginForm = $("#loginForm");
  if (loginForm) loginForm.addEventListener("submit", (e) => { e.preventDefault(); doLogin(); });
  else { const btn = $("#btnLogin"); if(btn) btn.addEventListener("click", doLogin); }

  if($("#btnLogout")) $("#btnLogout").addEventListener("click", doLogout);
  if($("#btnSearch")) $("#btnSearch").addEventListener("click", search);
  if($("#q")) $("#q").addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); search(); }});
  
  if($("#btnSave")) $("#btnSave").addEventListener("click", saveNew);
  if($("#btnUpdate")) $("#btnUpdate").addEventListener("click", updateCurrent);
  if($("#btnDelete")) $("#btnDelete").addEventListener("click", deleteCurrent);
  
  document.body.addEventListener('click', (e) => {
    if(e.target && e.target.id == 'btnSendToEsp') sendToDevice();
  });

  if($("#y")) $("#y").textContent = new Date().getFullYear();

  initEspMonitor();

  onSession(u=>{
    user = u;
    const sEl = $("#sessionState");
    if (user){
      if(sEl) sEl.textContent = "Sesión: " + (user.email || user.id);
      updateAuthUI(true);
      setOnline(true);
    } else {
      if(sEl) sEl.textContent = "Sesión: desconectado";
      updateAuthUI(false);
      setOnline(false);
    }
  });
});