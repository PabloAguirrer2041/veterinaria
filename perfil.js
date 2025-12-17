// ==========================================
// CONFIGURACIÓN (CLIENTE PÚBLICO)
// ==========================================
const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', cargarPerfil);

async function cargarPerfil() {
    // 1. Obtener ID de la URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        mostrarError("⚠️ ID no especificado en el enlace.");
        return;
    }

    try {
        // 2. Buscar Perro + Veterinaria (JOIN)
        const { data: p, error } = await sb
            .from('mascotas')
            .select(`
                *,
                veterinarias ( nombre, logo_url, color_tema, sitio_web )
            `)
            .eq('id', id)
            .single();

        if (error || !p) throw new Error("Mascota no encontrada");

        // 3. --- PINTAR LA VETERINARIA (CAMALEÓN) ---
        const vet = p.veterinarias || {}; // Evita error si no tiene vet asignada

        // Color del Tema
        if (vet.color_tema) {
            document.documentElement.style.setProperty('--color-vet', vet.color_tema);
        }

        // Header (Logo y Nombre) - IDs ACTUALIZADOS
        if (vet.logo_url) {
            const logoImg = document.getElementById('vetLogo');
            if(logoImg) logoImg.src = vet.logo_url;
            
            const badge = document.getElementById('vetBadge');
            if(badge) badge.style.display = 'flex';
        }
        
        const vetNameSpan = document.getElementById('vetName');
        if(vetNameSpan) vetNameSpan.innerText = vet.nombre || 'Veterinaria';

        // Footer (Link al sitio)
        const footerVet = document.getElementById('footerVet');
        if(footerVet) footerVet.innerText = vet.nombre || 'TuVet';
        
        const linkVet = document.getElementById('linkVet');
        if (linkVet && vet.sitio_web) {
            linkVet.href = vet.sitio_web;
        }

        // 4. --- PINTAR AL PERRO ---
        document.getElementById('petName').innerText = p.nombre || 'Sin Nombre';
        
        // Detalles combinados (Raza + Sexo + Edad)
        const detalles = `${p.raza || ''} · ${p.sexo || ''} · ${p.edad || '?'} años`;
        document.getElementById('petDetails').innerText = detalles;
        
        // Foto
        const fotoElement = document.getElementById('petPhoto');
        if (p.foto_url) {
            fotoElement.src = p.foto_url;
        } else {
            fotoElement.src = "https://via.placeholder.com/300?text=Sin+Foto";
        }

        // Notas Públicas
        const notasElement = document.getElementById('petNotes');
        if(notasElement) notasElement.innerText = p.notas_publicas || "Sin información adicional.";

        // 5. --- BOTONES DE CONTACTO ---
        if (p.contacto_publico) {
            const contactActions = document.getElementById('contactActions');
            if(contactActions) contactActions.style.display = 'block';
            
            // Botón Llamar
            const btnCall = document.getElementById('btnCall');
            if(btnCall) {
                btnCall.href = `tel:${p.telefono}`;
                // Intentamos sacar el nombre corto del dueño
                const nombreDuenio = (p.duenio || 'Dueño').split(' ')[0];
                btnCall.innerHTML = `<i class="fas fa-phone"></i> Llamar a ${nombreDuenio}`;
            }

            // Botón WhatsApp
            const cleanPhone = (p.telefono || '').replace(/\D/g,'');
            const btnWsp = document.getElementById('btnWsp');
            if (cleanPhone.length >= 10 && btnWsp) {
                btnWsp.href = `https://wa.me/${cleanPhone}?text=Hola, encontré a tu mascota ${p.nombre}`;
            } else if(btnWsp) {
                btnWsp.style.display = 'none'; // Ocultar si no hay número válido
            }
        } else {
            // Si es privado
            if(notasElement) notasElement.innerText += "\n\n⚠️ Datos de contacto privados. Por favor escanea en una clínica veterinaria o lleva al refugio más cercano.";
        }

        // OCULTAR CARGA (Usando el ID correcto 'loading')
        const loading = document.getElementById('loading');
        if(loading) loading.style.display = 'none';

    } catch (err) {
        console.error(err);
        mostrarError("❌ Perfil no encontrado o inactivo");
    }
}

function mostrarError(mensaje) {
    document.body.innerHTML = `<div style='text-align:center; margin-top:50px; color:#444;'><h2>${mensaje}</h2></div>`;
    const loading = document.getElementById('loading');
    if(loading) loading.style.display = 'none';
}