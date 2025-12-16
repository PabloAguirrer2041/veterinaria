// ==========================================
// CONFIGURACIÓN SUPABASE Y CONSTANTES
// ==========================================
const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let currentPetId = null; // Para saber si estamos editando o creando
const HEARTBEAT_INTERVAL = 3000; // Revisar ESP32 cada 3s
const OFFLINE_THRESHOLD = 15000; // Tiempo para considerar desconectado

// Elementos del DOM (Cacheamos para no buscarlos a cada rato)
const statusDiv = document.getElementById('espStatus');
const previewImg = document.getElementById('previewImg');
const fotoInput = document.getElementById('fotoInput');
const shortLinkDisplay = document.getElementById('shortLinkDisplay');

// ==========================================
// 1. INICIALIZACIÓN (AL CARGAR LA PÁGINA)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay sesión de doctor (Opcional, si implementaste login web)
    // checkSession(); 

    // Iniciar monitoreo del ESP32
    checkProgrammerStatus();
    setInterval(checkProgrammerStatus, HEARTBEAT_INTERVAL);

    console.log("Sistema Doctor Cargado Correctamente");
});

// ==========================================
// 2. LÓGICA DEL PROGRAMADOR (ESP32 / PAWLINKER)
// ==========================================

// Revisa si el ESP32 está vivo
async function checkProgrammerStatus() {
    try {
        const { data, error } = await supabase
            .from('status_esp32')
            .select('updated_at')
            .eq('id', 1)
            .single();

        if (data) {
            const lastSeen = new Date(data.updated_at).getTime();
            const now = new Date().getTime();
            // Si la última señal fue hace menos de 15s, está ONLINE
            const isOnline = (now - lastSeen) < OFFLINE_THRESHOLD;
            updateStatusUI(isOnline);
        }
    } catch (err) {
        console.error("Error monitor:", err);
        updateStatusUI(false);
    }
}

// Actualiza el letrero verde/rojo
function updateStatusUI(isOnline) {
    if (isOnline) {
        statusDiv.className = 'status-badge connected';
        statusDiv.innerHTML = '🟢 Programador: Conectado y Listo';
    } else {
        statusDiv.className = 'status-badge disconnected';
        statusDiv.innerHTML = '🔴 Programador: Desconectado (Revise corriente)';
    }
}

// Envía la orden de grabar al ESP32
async function enviarAProgramador() {
    const linkText = shortLinkDisplay.innerText;

    if (!linkText || linkText === '...' || !linkText.includes('http')) {
        return Swal.fire('Error', 'Primero busca o guarda una mascota para generar el link.', 'warning');
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

        const { error } = await supabase
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
// 3. LÓGICA DE FOTOS (PREVISUALIZACIÓN)
// ==========================================
function previewFile() {
    const file = fotoInput.files[0];
    const reader = new FileReader();

    reader.addEventListener("load", function () {
        previewImg.src = reader.result; // Muestra la foto inmediatamente
    }, false);

    if (file) {
        reader.readAsDataURL(file);
    }
}

// ==========================================
// 4. LÓGICA DE DATOS (MASCOTAS)
// ==========================================

// BUSCAR
async function buscarMascota() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return Swal.fire('Ojo', 'Escribe un nombre para buscar', 'info');

    try {
        Swal.fire({ title: 'Buscando...', didOpen: () => Swal.showLoading() });

        const { data, error } = await supabase
            .from('mascotas')
            .select('*')
            .ilike('nombre', `%${query}%`); // Búsqueda flexible

        Swal.close();

        if (error) throw error;

        if (data && data.length > 0) {
            cargarDatosEnFormulario(data[0]);
            Swal.fire('Encontrado', `Se cargó a ${data[0].nombre}`, 'success');
        } else {
            Swal.fire('No encontrado', 'No hay mascotas con ese nombre. Puedes registrarla nueva.', 'info');
            limpiarFormulario(); // Limpia para que escribas uno nuevo
            document.getElementById('nombre').value = query; // Deja el nombre que escribiste
        }

    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Fallo en la búsqueda', 'error');
    }
}

// GUARDAR O ACTUALIZAR
async function guardarMascota() {
    // Recolectar datos
    const nombre = document.getElementById('nombre').value;
    const raza = document.getElementById('raza').value;
    // ... validaciones básicas ...
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
        // El checkbox de público/privado
        contacto_publico: document.getElementById('publicContact').checked
    };

    try {
        Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });

        // 1. Subir Foto (Si hay una nueva seleccionada)
        const file = fotoInput.files[0];
        if (file) {
            const fileName = `foto_${Date.now()}.jpg`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('mascotas-fotos') // Asegúrate de crear este bucket en Supabase
                .upload(fileName, file);
            
            if (uploadError) throw uploadError;

            // Obtener URL pública
            const { data: publicUrlData } = supabase.storage
                .from('mascotas-fotos')
                .getPublicUrl(fileName);
            
            datos.foto_url = publicUrlData.publicUrl;
        }

        let resultData;

        // 2. Insertar o Actualizar
        if (currentPetId) {
            // ACTUALIZAR (UPDATE)
            const { data, error } = await supabase
                .from('mascotas')
                .update(datos)
                .eq('id', currentPetId)
                .select();
            if (error) throw error;
            resultData = data[0];
        } else {
            // CREAR NUEVO (INSERT)
            const { data, error } = await supabase
                .from('mascotas')
                .insert([datos])
                .select();
            if (error) throw error;
            resultData = data[0];
        }

        cargarDatosEnFormulario(resultData); // Recargar para mostrar ID y Link
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
        const { error } = await supabase.from('mascotas').delete().eq('id', currentPetId);
        if (error) Swal.fire('Error', error.message, 'error');
        else {
            Swal.fire('Eliminado', 'El registro ha sido borrado.', 'success');
            limpiarFormulario();
        }
    }
}

// ==========================================
// 5. UTILIDADES (Helpers)
// ==========================================

function cargarDatosEnFormulario(p) {
    currentPetId = p.id;
    
    // Textos
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

    // Mostrar cosas extra
    document.getElementById('btnDelete').style.display = 'inline-block';
    document.getElementById('nfcSection').style.display = 'block';

    // Link para grabar (Aquí usamos un acortador falso por ahora, o el ID directo)
    // En producción usarías un servicio real o tu propio dominio
    const linkFinal = `https://tuapp.com/p?id=${p.id}`; 
    shortLinkDisplay.innerText = linkFinal;
}

function limpiarFormulario() {
    currentPetId = null;
    document.querySelectorAll('input, textarea').forEach(i => i.value = '');
    document.getElementById('sexo').value = 'Macho';
    previewImg.src = "https://via.placeholder.com/300x300?text=Sin+Foto";
    
    document.getElementById('btnDelete').style.display = 'none';
    document.getElementById('nfcSection').style.display = 'none';
    shortLinkDisplay.innerText = '...';
}

// Botón de salir (opcional)
document.getElementById('logoutBtn').addEventListener('click', () => {
    // Lógica de logout si la tienes
    window.location.href = 'index.html';
});