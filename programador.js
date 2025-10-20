// programador.js — lógica de la página del doctor
import { getSupa, onSession, idToEmail, ready } from "./main.js";

const $ = (s)=>document.querySelector(s);
const uuid = ()=> (crypto.randomUUID ? crypto.randomUUID()
  : (Date.now().toString(36)+Math.random().toString(36).slice(2)));

let user = null;
let current = null;

function setOnline(on){
  const pill = $("#state");
  pill.textContent = on ? "online" : "offline";
  pill.style.background = on ? "#e8fbfb" : "#ffeaea";
  pill.style.color = on ? "#075e59" : "#8b1a1a";
  $("#btnSave").disabled   = !on;
  $("#btnUpdate").disabled = !on || !current;
  $("#btnDelete").disabled = !on || !current;
  $("#docId").disabled  = on;
  $("#docPwd").disabled = on;
}
function logMsg(m){ const el=$("#log"); el.classList.remove("hide"); el.textContent += m + "\n"; el.scrollTop = el.scrollHeight; }
function fillForm(p){
  $("#f_nombre").value = p?.nombre || "";
  $("#f_raza").value   = p?.raza   || "";
  $("#f_edad").value   = p?.edad   ?? "";
  $("#f_sexo").value   = p?.sexo   || "";
  $("#f_duenio").value = p?.duenio || "";
  $("#f_tel").value    = p?.telefono || "";
  $("#f_email").value  = p?.email || "";
  $("#f_hist").value   = p?.historial || "";
}

/* --------- Auth (CORREGIDO) --------- */
async function doLogin(){
  try{
    const supa = await getSupa();
    // CORRECCIÓN: Lee el email directamente, no el 'raw id'
    const email = ($("#docId").value || "").trim();
    const pwd = $("#docPwd").value || "";
    
    // CORRECCIÓN: Mensaje de alerta actualizado
    if (!email || !pwd) return alert("Escribe Correo y contraseña");
    
    // CORRECCIÓN: Se eliminó la línea "const email = idToEmail(raw);"

    const { error } = await supa.auth.signInWithPassword({ email, password: pwd });
    if (error) return alert(`Error al iniciar sesión: ${error.message}`);
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
    foto_url,
    owner_id: user.id
  };
  if(!payload.nombre){ alert("Nombre es obligatorio"); $("#btnSave").disabled=false; return; }

  const { data, error } = await supa.from("mascotas").insert(payload).select("id").single();
  if(error){ logMsg("✖ Insert: " + error.message); }
  else { logMsg("✅ Guardado ID " + data.id); current = { id:data.id, ...payload }; $("#btnUpdate").disabled=false; $("#btnDelete").disabled=false; }
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
    foto_url
  };

  const { error } = await supa.from("mascotas").update(payload).eq("id", current.id);
  if(error){ logMsg("✖ Update: " + error.message); }
  else { logMsg("✅ Actualizado ID " + current.id); }
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
}

async function search(){
  const supa = await getSupa();
  const q = $("#q").value.trim();
  const results = $("#results");
  results.innerHTML = "";
  if(!q){ results.innerHTML = `<div class="muted">Escribe un nombre o ID.</div>`; return; }

  let query = supa
    .from("mascotas")
    .select("id,nombre,raza,edad,sexo,duenio,telefono,email,historial,foto_url")
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
    card.style.cursor = "pointer";
    card.onclick = ()=>{ current = p; fillForm(p); $("#btnUpdate").disabled=false; $("#btnDelete").disabled=false; window.scrollTo({top:0,behavior:'smooth'}); };
    results.appendChild(card);
  });
}

/* --------- Arranque --------- */
ready(async ()=>{
  $("#btnLogin").addEventListener("click", doLogin);
  $("#btnLogout").addEventListener("click", doLogout);
  $("#btnSearch").addEventListener("click", search);
  $("#q").addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); search(); }});
  $("#btnSave").addEventListener("click", saveNew);
  $("#btnUpdate").addEventListener("click", updateCurrent);
  $("#btnDelete").addEventListener("click", deleteCurrent);
  $("#y").textContent = new Date().getFullYear();

  onSession(u=>{
    user = u;
    const sEl = $("#sessionState");
    if (user){
      sEl.textContent = "Sesión: " + (user.email || user.id);
      $("#btnLogin").classList.add("hide");
      $("#btnLogout").classList.remove("hide");
      setOnline(true);
    } else {
      sEl.textContent = "Sesión: desconectado";
      $("#btnLogin").classList.remove("hide");
      $("#btnLogout").classList.add("hide");
      setOnline(false);
    }
  });

  try { await getSupa(); } catch(e){ console.warn("[getSupa] fallback/espera", e); }
});