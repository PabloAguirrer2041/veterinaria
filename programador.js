// programador.js — Login + Buscador + CRUD perros
document.addEventListener('DOMContentLoaded', async () => {
  const supa = await getSupa();

  // Config: ajusta a tu tabla/columnas reales
  const TABLE_PERROS = 'perros'; // ← CAMBIA si tu tabla tiene otro nombre
  const COLS = { id: 'id', nombre: 'nombre', raza: 'raza', edad: 'edad' }; // ← ajusta si tus columnas difieren

  // UI refs
  const statusEl = qs('#status');
  const cardLogin = qs('#cardLogin');
  const cardSession = qs('#cardSession');
  const cardSearch = qs('#cardSearch');
  const cardForm = qs('#cardForm');
  const sessionEmail = qs('#sessionEmail');

  const loginForm = qs('#loginForm');
  const btnLogout = qs('#btnLogout');
  const btnReload = qs('#btnReload');

  const qNombre = qs('#qNombre');
  const qRaza = qs('#qRaza');
  const btnBuscar = qs('#btnBuscar');
  const countEl = qs('#count');
  const tbody = qs('#tablaPerros tbody');

  const perroForm = qs('#perroForm');
  const formTitle = qs('#formTitle');
  const perroId = qs('#perroId');
  const perroNombre = qs('#perroNombre');
  const perroRaza = qs('#perroRaza');
  const perroEdad = qs('#perroEdad');
  const btnCancelar = qs('#btnCancelar');

  // Helpers
  function qs(s){ return document.querySelector(s); }
  function show(el, on=true){ el?.classList[on?'remove':'add']('hidden'); }
  function setStatus(msg){ statusEl.textContent = msg; }

  // ==== SESIÓN ====
  window.onAppSession = (user) => {
    if (user){
      setStatus(`Sesión activa: ${user.email || 'sin email'}`);
      sessionEmail.textContent = user.email || 'Sin email';
      show(cardLogin, false);
      show(cardSession, true);
      show(cardSearch, true);
      show(cardForm, true);
      // Carga inicial
      buscar();
    } else {
      setStatus('Sin sesión');
      sessionEmail.textContent = 'Sin sesión';
      show(cardLogin, true);
      show(cardSession, false);
      show(cardSearch, false);
      show(cardForm, false);
      // Limpia tabla
      tbody.innerHTML = '';
      countEl.textContent = '';
    }
  };

  // Login
  loginForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = qs('#docEmail').value.trim();
    const password = qs('#docPwd').value.trim();
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) alert('Error: ' + error.message);
  });

  // Logout
  btnLogout?.addEventListener('click', async ()=>{
    await supa.auth.signOut();
  });

  // Forzar rehidratación
  btnReload?.addEventListener('click', async ()=>{
    const { data:{ session } } = await supa.auth.getSession();
    window.onAppSession?.(session?.user || null);
  });

  // ==== BUSCADOR ====
  btnBuscar?.addEventListener('click', buscar);
  qNombre?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') buscar(); });

  async function buscar(){
    try {
      let query = supa.from(TABLE_PERROS).select('*').order(COLS.nombre, { ascending: true });

      const nombre = (qNombre?.value || '').trim();
      const raza = (qRaza?.value || '').trim();

      if (nombre) query = query.ilike(COLS.nombre, `%${nombre}%`);
      if (raza)   query = query.eq(COLS.raza, raza);

      const { data, error } = await query;
      if (error) throw error;

      renderTabla(data || []);
      countEl.textContent = `${(data||[]).length} resultado(s)`;
    } catch (err){
      alert('Error al buscar: ' + err.message);
    }
  }

  function renderTabla(rows){
    tbody.innerHTML = '';
    if (!rows.length){
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Sin resultados</td></tr>`;
      return;
    }
    for (const r of rows){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(r[COLS.nombre])}</td>
        <td>${esc(r[COLS.raza] ?? '')}</td>
        <td>${esc(r[COLS.edad] ?? '')}</td>
        <td class="muted">${esc(r[COLS.id])}</td>
        <td>
          <div class="row-actions">
            <button data-act="edit" data-id="${r[COLS.id]}">Editar</button>
            <button class="btn-danger" data-act="del" data-id="${r[COLS.id]}">Borrar</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

  // Acciones tabla (editar / borrar)
  tbody.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;

    if (act === 'edit'){
      // Cargar registro y pasar al formulario
      const { data, error } = await supa.from(TABLE_PERROS).select('*').eq(COLS.id, id).single();
      if (error){ alert('No se pudo cargar: ' + error.message); return; }
      formTitle.textContent = 'Editar perro';
      perroId.value = data[COLS.id];
      perroNombre.value = data[COLS.nombre] ?? '';
      perroRaza.value = data[COLS.raza] ?? '';
      perroEdad.value = data[COLS.edad] ?? '';
      perroNombre.focus();
    }

    if (act === 'del'){
      if (!confirm('¿Borrar este perro?')) return;
      const { error } = await supa.from(TABLE_PERROS).delete().eq(COLS.id, id);
      if (error){ alert('No se pudo borrar: ' + error.message); return; }
      buscar();
    }
  });

  // Guardar (alta/edición)
  perroForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      [COLS.nombre]: perroNombre.value.trim(),
      [COLS.raza]: perroRaza.value.trim() || null,
      [COLS.edad]: perroEdad.value ? Number(perroEdad.value) : null,
    };

    try {
      if (perroId.value){
        const { error } = await supa.from(TABLE_PERROS).update(payload).eq(COLS.id, perroId.value);
        if (error) throw error;
      } else {
        const { error } = await supa.from(TABLE_PERROS).insert(payload);
        if (error) throw error;
      }
      limpiarForm();
      buscar();
    } catch (err){
      alert('No se pudo guardar: ' + err.message);
    }
  });

  btnCancelar?.addEventListener('click', limpiarForm);
  function limpiarForm(){
    formTitle.textContent = 'Agregar perro';
    perroId.value = '';
    perroNombre.value = '';
    perroRaza.value = '';
    perroEdad.value = '';
  }

  // Intento inicial de rehidratación (por si llegas logueado)
  try {
    const { data:{ session } } = await supa.auth.getSession();
    window.onAppSession?.(session?.user || null);
  } catch {
    setStatus('No se pudo recuperar la sesión');
  }
});
