const API_BASE = 'https://community-hub-j9na.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const email = form.querySelector('input[type="email"]')?.value.trim();
    const password = form.querySelector('input[type="password"]')?.value;

    if (!email || !password) {
      alert('Please fill in both email and password.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        window.location.href = 'home.html';
      } else {
        const msg = await res.text().catch(() => 'Login failed');
        alert(msg || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Network error connecting to Render. Make sure the server is awake!');
    }
  });
});