// ==========================================
// CONFIGURACIÓN (CLIENTE PÚBLICO)
// ==========================================
const SUPABASE_URL = "https://uqtnllwlyxzfvxukvxrb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdG5sbHdseXh6ZnZ4dWt2eHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTc3MjUsImV4cCI6MjA3NDQzMzcyNX0.nHfPuc-LCwGymKqhSRSIp9lmpQLKK53M6eqUP7QepUU";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', cargarPerfil);

async function cargarPerfil() {
    // 1. Obtener ID de la URL (?id=5)
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px;'>⚠️ ID no especificado</h2>";
        return;
    }

    try {
        // 2. Buscar Perro + Veterinaria (JOIN)
        // Pedimos los datos del perro Y los datos de la tabla 'veterinarias' conectada
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
        const vet = p.veterinarias;
        
        // Colores Dinámicos
        document.documentElement.style.setProperty('--color-vet', vet.color_tema || '#000');
        
        // Header
        if (vet.logo_url) {
            document.getElementById('logoVet').src = vet.logo_url;
            document.getElementById('headerVet').style.display = 'flex';
        }
        document.getElementById('nombreVet').innerText = vet.nombre;
        
        // Footer y Links
        document.getElementById('footerVetName').innerText = vet.nombre;
        if (vet.sitio_web) {
            document.getElementById('linkVetSite').href = vet.sitio_web;
        }

        // 4. --- PINTAR AL PERRO ---
        document.getElementById('petName').innerText = p.nombre;
        document.getElementById('petBreed').innerText = `${p.raza} · ${p.sexo} · ${p.edad} años`;
        
        if (p.foto_url) {
            document.getElementById('petPhoto').src = p.foto_url;
        } else {
            document.getElementById('petPhoto').src = "https://via.placeholder.com/500?text=Sin+Foto";
        }

        // Notas
        document.getElementById('petNotes').innerText = p.notas_publicas || "Sin información adicional.";

        // 5. --- BOTONES DE CONTACTO (SEGURIDAD) ---
        // Solo mostramos botones si el dueño autorizó (contacto_publico)
        if (p.contacto_publico) {
            document.getElementById('contactButtons').style.display = 'block';
            
            // Botón Llamar
            const btnCall = document.getElementById('btnCallOwner');
            btnCall.href = `tel:${p.telefono}`;
            btnCall.innerText = `📞 Llamar a ${p.duenio.split(' ')[0]}`;

            // Botón WhatsApp (Opcional, generamos link directo)
            // Limpiamos el numero de espacios o guiones
            const cleanPhone = p.telefono.replace(/\D/g,'');
            if (cleanPhone.length >= 10) {
                const btnWsp = document.getElementById('btnWhatsapp');
                btnWsp.style.display = 'block';
                btnWsp.href = `https://wa.me/${cleanPhone}?text=Hola, encontré a tu mascota ${p.nombre}`;
            }
        } else {
            // Si es privado, mostrar mensaje de "Llevar al refugio"
            document.getElementById('petNotes').innerText += "\n\n⚠️ Datos de contacto privados. Por favor escanea en una clínica veterinaria o lleva al refugio más cercano.";
        }

        // Quitar pantalla de carga
        document.getElementById('loadingScreen').style.display = 'none';

    } catch (err) {
        console.error(err);
        document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px;'>❌ Perfil no encontrado o inactivo</h2>";
        document.getElementById('loadingScreen').style.display = 'none';
    }
}