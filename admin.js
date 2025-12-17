// ==========================================
// CONFIGURACIÓN SUPABASE Y CONSTANTES
// ==========================================
const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";

// Cliente Supabase (Usamos 'sb' para evitar conflictos)
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let currentPetId = null; 
const HEARTBEAT_INTERVAL = 3000; 
const OFFLINE_THRESHOLD = 15000; 

let currentPetId = null; 
let listaResultadosBusqueda = []; // <--- NUEVA VARIABLE PARA GUARDAR LA LISTA

// Elementos del DOM (Referencias actualizadas)
const statusDiv = document.getElementById('espStatus');
const previewImg = document.getElementById('previewImg');
const fotoInput = document.getElementById('fotoInput');
// CORRECCIÓN: Ahora apuntamos al input, no al texto <b>
const shortLinkInput = document.getElementById('shortLinkInput'); 

// ==========================================
// 1. INICIALIZACIÓN (AL CARGAR LA PÁGINA)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 🔒 GUARDIA DE SEGURIDAD ---
    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
        console.warn("Acceso denegado: No hay sesión activa.");
        window.location.href = 'login.html';
        return; 
    }
    console.log("✅ Acceso Autorizado:", session.user.email);

    // Iniciar monitoreo del ESP32
    checkProgrammerStatus();
    setInterval(checkProgrammerStatus, HEARTBEAT_INTERVAL);
});

// ==========================================
// 2. LÓGICA DEL PROGRAMADOR (ESP32)
// ==========================================

async function checkProgrammerStatus() {
    try {
        const { data, error } = await sb
            .from('status_esp32')
            .select('updated_at')
            .eq('id', 1)
            .single();

        if (data) {
            const lastSeen = new Date(data.updated_at).getTime();
            const now = new Date().getTime();
            const isOnline = (now - lastSeen) < OFFLINE_THRESHOLD;
            updateStatusUI(isOnline);
        }
    } catch (err) {
        updateStatusUI(false);
    }
}

function updateStatusUI(isOnline) {
    if (isOnline) {
        statusDiv.className = 'status-badge connected';
        statusDiv.innerHTML = '🟢 Programador: Conectado y Listo';
    } else {
        statusDiv.className = 'status-badge disconnected';
        statusDiv.innerHTML = '🔴 Programador: Desconectado (Revise corriente)';
    }
}

async function enviarAProgramador() {
    // CORRECCIÓN: Leemos el valor de la cajita de texto (.value)
    const linkText = shortLinkInput.value;

    if (!linkText || !linkText.includes('http')) {
        return Swal.fire('Error', 'El link no es válido.', 'warning');
    }

    if (statusDiv.classList.contains('disconnected')) {
        return Swal.fire('Programador Desconectado', 'Conecta el PawLinker a la luz.', 'error');
    }

    try {
        Swal.fire({
            title: 'Enviando...',
            text: 'El LED del dispositivo se pondrá AZUL.',
            didOpen: () => Swal.showLoading()
        });

        const { error } = await sb
            .from('status_esp32')
            .update({ 
                pending_write: linkText,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1);

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: '¡Orden Enviada!',
            text: 'Acerca el dije al PawLinker ahora.',
            timer: 3000,
            showConfirmButton: false
        });

    } catch (err) {
        Swal.fire('Error', 'Fallo al comunicar con la nube.', 'error');
    }
}

// ==========================================
// 3. LÓGICA DE FOTOS
// ==========================================
function previewFile() {
    const file = fotoInput.files[0];
    const reader = new FileReader();

    reader.addEventListener("load", function () {
        previewImg.src = reader.result; 
    }, false);

    if (file) {
        reader.readAsDataURL(file);
    }
}

// ==========================================
// 4. LÓGICA DE DATOS (MASCOTAS)
// ==========================================

// BUSCAR
// BUSCAR (MEJORADO CON LISTA DE SELECCIÓN)
async function buscarMascota() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return Swal.fire('Ojo', 'Escribe un nombre para buscar', 'info');

    try {
        Swal.fire({ title: 'Buscando...', didOpen: () => Swal.showLoading() });

        const { data, error } = await sb
            .from('mascotas')
            .select('*')
            .ilike('nombre', `%${query}%`); 

        Swal.close();

        if (error) throw error;

        // CASO 0: NO SE ENCONTRÓ NADA
        if (!data || data.length === 0) {
            Swal.fire('No encontrado', 'No hay mascotas con ese nombre. Puedes registrarla nueva.', 'info');
            limpiarFormulario(); 
            document.getElementById('nombre').value = query;
            return;
        }

        // CASO 1: SOLO HAY UNO (Cargar directo)
        if (data.length === 1) {
            cargarDatosEnFormulario(data[0]);
            // Pequeña notificación visual (Toast) en lugar de alerta invasiva
            const Toast = Swal.mixin({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
            });
            Toast.fire({ icon: 'success', title: `Se cargó a ${data[0].nombre}` });
            return;
        }

        // CASO 2: HAY VARIOS (Mostrar lista "Slicer")
        if (data.length > 1) {
            listaResultadosBusqueda = data; // Guardamos los datos para usarlos al dar clic
            mostrarModalSeleccion(data);
        }

    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Fallo en la búsqueda', 'error');
    }
}

// GUARDAR / ACTUALIZAR
async function guardarMascota() {
    const nombre = document.getElementById('nombre').value;
    const raza = document.getElementById('raza').value;
    
    if(!nombre || !raza) return Swal.fire('Faltan datos', 'Nombre y Raza son obligatorios', 'warning');

    const datos = {
        nombre: nombre,
        raza: raza,
        sexo: document.getElementById('sexo').value,
        edad: document.getElementById('edad').value,
        duenio: document.getElementById('duenio').value,
        telefono: document.getElementById('telefono').value,
        email_duenio: document.getElementById('email').value,
        historial: document.getElementById('historial').value,
        notas_publicas: document.getElementById('notasPublicas').value,
        contacto_publico: document.getElementById('publicContact').checked
    };

    try {
        Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

        // Subir Foto
        const file = fotoInput.files[0];
        if (file) {
            const fileName = `foto_${Date.now()}.jpg`;
            const { data: uploadData, error: uploadError } = await sb.storage
                .from('mascotas-fotos') 
                .upload(fileName, file);
            
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = sb.storage
                .from('mascotas-fotos')
                .getPublicUrl(fileName);
            
            datos.foto_url = publicUrlData.publicUrl;
        }

        let resultData;

        // Guardar en BD
        if (currentPetId) {
            const { data, error } = await sb
                .from('mascotas')
                .update(datos)
                .eq('id', currentPetId)
                .select();
            if (error) throw error;
            resultData = data[0];
        } else {
            const { data, error } = await sb
                .from('mascotas')
                .insert([datos])
                .select();
            if (error) throw error;
            resultData = data[0];
        }

        cargarDatosEnFormulario(resultData); 
        Swal.fire('¡Guardado!', 'El expediente se actualizó correctamente.', 'success');

    } catch (err) {
        console.error(err);
        Swal.fire('Error al guardar', err.message, 'error');
    }
}

// ELIMINAR
async function eliminarMascota() {
    if (!currentPetId) return;

    const confirm = await Swal.fire({
        title: '¿Estás seguro?',
        text: "No podrás revertir esto.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar'
    });

    if (confirm.isConfirmed) {
        const { error } = await sb.from('mascotas').delete().eq('id', currentPetId);
        if (error) Swal.fire('Error', error.message, 'error');
        else {
            Swal.fire('Eliminado', 'El registro ha sido borrado.', 'success');
            limpiarFormulario();
        }
    }
}

// ==========================================
// 5. UTILIDADES (HELPERS)
// ==========================================

function cargarDatosEnFormulario(p) {
    currentPetId = p.id;
    
    // Rellenar campos
    document.getElementById('nombre').value = p.nombre || '';
    document.getElementById('raza').value = p.raza || '';
    document.getElementById('sexo').value = p.sexo || 'Macho';
    document.getElementById('edad').value = p.edad || '';
    document.getElementById('duenio').value = p.duenio || '';
    document.getElementById('telefono').value = p.telefono || '';
    document.getElementById('email').value = p.email_duenio || '';
    document.getElementById('historial').value = p.historial || '';
    document.getElementById('notasPublicas').value = p.notas_publicas || '';
    document.getElementById('publicContact').checked = p.contacto_publico || false;

    // Foto
    if (p.foto_url) {
        previewImg.src = p.foto_url;
    } else {
        previewImg.src = "https://via.placeholder.com/300x300?text=Sin+Foto";
    }

    // Mostrar botones extra
    document.getElementById('btnDelete').style.display = 'inline-block';
    document.getElementById('nfcSection').style.display = 'block';

    // --- CORRECCIÓN: GENERACIÓN DE LINK AUTOMÁTICA ---
    // Detectamos la ruta actual del navegador para construir el link
    const urlBase = window.location.origin; 
    const path = window.location.pathname.replace('admin.html', '');
    const linkFinal = `${urlBase}${path}perfil.html?id=${p.id}`;

    // Lo ponemos en el input
    if (shortLinkInput) {
        shortLinkInput.value = linkFinal;
    }
}

function limpiarFormulario() {
    currentPetId = null;
    document.querySelectorAll('input, textarea').forEach(i => i.value = '');
    document.getElementById('sexo').value = 'Macho';
    previewImg.src = "https://via.placeholder.com/300x300?text=Sin+Foto";
    fotoInput.value = ""; 
    
    document.getElementById('btnDelete').style.display = 'none';
    document.getElementById('nfcSection').style.display = 'none';
    
    // Limpiar input de link
    if (shortLinkInput) shortLinkInput.value = '';
}

// CERRAR SESIÓN
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}
// --- FUNCIONES AUXILIARES PARA BÚSQUEDA MÚLTIPLE ---

function mostrarModalSeleccion(mascotas) {
    // 1. Construimos el HTML de la lista
    let htmlLista = '<div class="search-results-list">';
    
    mascotas.forEach((p, index) => {
        // Si no tiene foto, usamos placeholder
        const img = p.foto_url || "https://via.placeholder.com/50?text=🐶";
        
        // Creamos la tarjeta clicable
        // Al hacer clic, llamamos a 'seleccionarDeLista' con el número de índice (0, 1, 2...)
        htmlLista += `
            <div class="pet-result-card" onclick="seleccionarDeLista(${index})">
                <img src="${img}" class="pet-result-img">
                <div class="pet-result-info">
                    <h4>${p.nombre}</h4>
                    <p>Dueño: ${p.duenio || 'No registrado'}</p>
                </div>
            </div>
        `;
    });

    htmlLista += '</div>';

    // 2. Mostramos la alerta con el HTML dentro
    Swal.fire({
        title: `Encontrados: ${mascotas.length}`,
        html: htmlLista,
        showConfirmButton: false, // No hace falta botón, se selecciona con clic en la tarjeta
        showCloseButton: true,
        width: '400px'
    });
}

// Esta función se ejecuta cuando das clic en una tarjetita
function seleccionarDeLista(index) {
    const perroSeleccionado = listaResultadosBusqueda[index];
    Swal.close(); // Cerramos el modal
    cargarDatosEnFormulario(perroSeleccionado); // Cargamos los datos
}

);