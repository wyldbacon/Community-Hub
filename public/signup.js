const API_BASE = 'https://community-hub-j9na.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const nameInput = form.querySelector('input[name="name"]') || form.querySelector('input[type="text"]');
    const emailInput = form.querySelector('input[name="email"]') || form.querySelector('input[type="email"]');
    const passwordInput = form.querySelector('input[name="password"]') || form.querySelector('input[type="password"]');

    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!name || !email || !password) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password })
      });

      if (res.ok) {
        window.location.href = 'home.html';
      } else {
        const msg = await res.text().catch(() => 'Signup failed');
        alert(msg || 'Error signing up');
      }
    } catch (err) {
      console.error('Signup error:', err);
      alert('Network error connecting to Render.');
    }
  });
});