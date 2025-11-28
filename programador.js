// programador.js (VERSIÓN MAESTRA FINAL)

// =========================================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE SUPABASE
// =========================================================
const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";

let supa = null;
const listeners = new Set();
let authBound = false;
let supaPromise = null;

// Función Singleton para obtener el cliente
async function getSupa(){
  if (supa) return supa;
  if (supaPromise) return supaPromise;

  supaPromise = (async () => {
    // Esperar a que la librería cargue desde el CDN
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

// =========================================================
// 2. LÓGICA DE INTERFAZ (UI)
// =========================================================

const $ = (s)=>document.querySelector(s);
const uuid = ()=> (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36)+Math.random().toString(36).slice(2)));

let user = null;
let current = null;

// Oculta/Muestra inputs de login según el estado
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
  el.classList.remove("hide"); 
  el.textContent += m + "\n"; 
  el.scrollTop = el.scrollHeight; 
}

// Muestra el Link y habilita el botón de enviar a ESP32
function showLink(id) {
  const fullUrl = window.location.origin + `/perfil.html?id=${id}`;
  
  $("#newLink").innerHTML = `
    <label style="font-size:12px; color:#5b6b83; display:block; margin-bottom:4px;">URL del Perfil Público:</label>
    <input id="currentUrlInput" type="text" value="${fullUrl}" readonly onclick="this.select()" style="width:100%; padding:10px; border:2px solid #0ea5a0; border-radius:8px; background:#f0fdfd; color:#0f172a; font-weight:bold; font-family: monospace;">
  `;
  
  // Mostrar controles IOT si existen
  const iotControls = $("#iotControls");
  if(iotControls) iotControls.classList.remove("hide");
}

function fillForm(p){
  $("#f_nombre").value = p?.nombre || "";
  $("#f_raza").value   = p?.raza   || "";
  $("#f_edad").value   = p?.edad   ?? "";
  $("#f_sexo").value   = p?.sexo   || "";
  $("#f_duenio").value = p?.duenio || "";
  $("#f_tel").value    = p?.telefono || "";
  $("#f_email").value  = p?.email || "";
  $("#f_hist").value   = p?.historial || "";
  $("#f_notas_publicas").value = p?.notas_publicas || "";
  $("#f_contacto_publico").checked = !!p?.contacto_publico;

  if (p?.id) {
    showLink(p.id);
  } else {
    $("#newLink").innerHTML = "";
    const iotControls = $("#iotControls");
    if(iotControls) iotControls.classList.add("hide");
  }
}

/* --------- Autenticación --------- */
async function doLogin(){
  try{
    const supa = await getSupa();
    const email = ($("#docId").value || "").trim();
    const pwd = ($("#docPwd").value || "").trim();
    
    if (!email || !pwd) return alert("Escribe Correo y contraseña");
    
    const { error } = await supa.auth.signInWithPassword({ email, password: pwd });
    if (error) return alert(`Error: ${error.message}`);
    
    $("#docPwd").value = "";
  }catch(e){ console.error("[login]", e); alert("No se pudo iniciar sesión."); }
}

async function doLogout(){
  try{
    const supa = await getSupa();
    await supa.auth.signOut();
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

  const file = $("#f_foto")?.files?.[0];
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
    showLink(data.id); 
    window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'});
  }
  $("#btnSave").disabled = false;
}

async function updateCurrent(){
  if(!user || !current) return;
  const supa = await getSupa();
  $("#btnUpdate").disabled = true;

  let foto_url = current.foto_url || null;
  const file = $("#f_foto")?.files?.[0];
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
    showLink(current.id); 
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
  $("#results").innerHTML = "";
  fillForm({});
}

async function search(){
  const supa = await getSupa();
  const q = $("#q").value.trim();
  const results = $("#results");
  results.innerHTML = "";
  if(!q){ results.innerHTML = `<div class="muted">Escribe un nombre o ID.</div>`; return; }

  let query = supa
    .from("mascotas")
    .select("id,nombre,raza,edad,sexo,duenio,telefono,email,historial,foto_url,notas_publicas,contacto_publico")
    .order("id",{ascending:false}).limit(20);

  const n = Number(q);
  query = (Number.isFinite(n) && String(n)===q)
    ? query.or(`id.eq.${n},nombre.ilike.%${q}%`)
    : query.ilike("nombre", `%${q}%`);

  const { data, error } = await query;
  if(error){ results.innerHTML = `<div class="muted">Error: ${error.message}</div>`; return; }
  if(!data?.length){ results.innerHTML = `<div class="muted">Sin resultados.</div>`; return; }

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
    results.appendChild(card);
  });
}

// =========================================================
// 3. LÓGICA DEL ESP32 (IOT & HEARTBEAT)
// =========================================================
let espTimer = null;

function updateEspStatus(online) {
  const el = $("#espStatus");
  if(!el) return;
  const dot = el.querySelector("div");
  const text = el.querySelector("span");

  if (online) {
    el.style.background = "#dcfce7";
    el.style.color = "#15803d";
    el.style.borderColor = "#86efac";
    dot.style.background = "#15803d";
    dot.style.boxShadow = "0 0 0 2px #dcfce7";
    text.textContent = "Programador: Conectado";
  } else {
    el.style.background = "#fee2e2";
    el.style.color = "#b91c1c";
    el.style.borderColor = "#fecaca";
    dot.style.background = "#b91c1c";
    dot.style.boxShadow = "none";
    text.textContent = "Programador: Desconectado";
  }
}

async function initEspMonitor() {
  const supa = await getSupa();
  
  // Escuchar Latidos
  supa.channel('public:status_esp32')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'status_esp32' }, (payload) => {
      // Ignoramos si es un 'pending_write', solo nos interesa 'updated_at' para el latido
      updateEspStatus(true);
      clearTimeout(espTimer);
      espTimer = setTimeout(() => updateEspStatus(false), 15000); 
    })
    .subscribe();

  // Chequeo inicial
  const { data } = await supa.from('status_esp32').select('updated_at').eq('id', 1).single();
  if (data) {
    const lastSeen = new Date(data.updated_at).getTime();
    if (new Date().getTime() - lastSeen < 15000) {
      updateEspStatus(true);
      espTimer = setTimeout(() => updateEspStatus(false), 15000);
    }
  }
}

// --- FUNCIÓN PARA ENVIAR LINK AL ESP32 ---
async function sendToDevice() {
  const urlInput = $("#currentUrlInput");
  if (!urlInput || !urlInput.value) return alert("No hay una URL generada para enviar.");
  
  const urlToSend = urlInput.value;
  const statusMsg = $("#iotStatusMsg");
  const btn = $("#btnSendToEsp");

  btn.disabled = true;
  btn.textContent = "Enviando...";
  statusMsg.style.display = "block";
  statusMsg.textContent = "⏳ Enviando orden al dispositivo...";

  try {
    const supa = await getSupa();
    
    // Subir la URL a la columna 'pending_write'
    const { error } = await supa
      .from('status_esp32')
      .update({ pending_write: urlToSend })
      .eq('id', 1);

    if (error) throw error;

    statusMsg.textContent = "✅ ¡Enviado! Acerca la etiqueta al dispositivo ahora.";
    statusMsg.style.color = "green";
    
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Enviar código al Programador";
      statusMsg.textContent = "";
    }, 5000);

  } catch (e) {
    console.error(e);
    statusMsg.textContent = "❌ Error al enviar: " + e.message;
    statusMsg.style.color = "red";
    btn.disabled = false;
    btn.textContent = "Reintentar";
  }
}

// =========================================================
// 4. ARRANQUE
// =========================================================
ready(async ()=>{
  try { 
    await getSupa(); 
  } catch(e){ 
    console.error(e);
    setOnline(false);
    return;
  }
  
  // Listeners
  $("#btnLogin").addEventListener("click", doLogin);
  $("#btnLogout").addEventListener("click", doLogout);
  $("#btnSearch").addEventListener("click", search);
  $("#q").addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); search(); }});
  $("#btnSave").addEventListener("click", saveNew);
  $("#btnUpdate").addEventListener("click", updateCurrent);
  $("#btnDelete").addEventListener("click", deleteCurrent);
  
  // Listener del Botón IOT (¡Importante!)
  // Usamos verificación opcional por si el elemento aún no se ha inyectado en el DOM
  document.body.addEventListener('click', (e) => {
    if(e.target && e.target.id == 'btnSendToEsp'){
        sendToDevice();
    }
  });

  $("#y").textContent = new Date().getFullYear();

  initEspMonitor();

  onSession(u=>{
    user = u;
    const sEl = $("#sessionState");
    if (user){
      sEl.textContent = "Sesión: " + (user.email || user.id);
      updateAuthUI(true);
      setOnline(true);
    } else {
      sEl.textContent = "Sesión: desconectado";
      updateAuthUI(false);
      setOnline(false);
    }
  });
});