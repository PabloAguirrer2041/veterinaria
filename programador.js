// programador.js — control del login y sesión
document.addEventListener('DOMContentLoaded', async ()=>{
  const supa = await getSupa();

  // Callback global de sesión
  window.onAppSession = (user)=>{
    const btnLogin = document.querySelector('#btnLogin');
    const btnLogout = document.querySelector('#btnLogout');

    if (user){
      console.log("Usuario activo:", user.email);
      btnLogin.style.display = 'none';
      btnLogout.style.display = 'inline-block';
    } else {
      console.log("Sin sesión activa");
      btnLogin.style.display = 'inline-block';
      btnLogout.style.display = 'none';
    }
  };

  // Login
  document.querySelector('#loginForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.querySelector('#docEmail').value.trim();
    const password = document.querySelector('#docPwd').value.trim();

    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) alert("Error de inicio de sesión: " + error.message);
  });

  // Logout
  document.querySelector('#btnLogout')?.addEventListener('click', async ()=>{
    await supa.auth.signOut();
  });

  // Al cargar la página, intenta restaurar sesión
  try {
    const { data:{ session } } = await supa.auth.getSession();
    window.onAppSession?.(session?.user || null);
  } catch {}
});
