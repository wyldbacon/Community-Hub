// public/group.js - updated with live API endpoints for Capacitor/mobile compatibility
const API_BASE = 'https://community-hub-j9na.onrender.com';

const raw = window.location.pathname.split('/').pop();
const slug = raw.endsWith('.html') ? raw.slice(0, -5) : raw;

let currentUser = null;
let resourcesCache = [];

// helpers
const $ = id => document.getElementById(id);
const escapeHtml = (s = '') => { const d = document.createElement('div'); d.innerText = s; return d.innerHTML; };

async function fetchJSON(url, opts = {}) {
  opts = Object.assign({}, opts);
  opts.credentials = 'include';
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  }
  
  // Prefix relative endpoint paths with the backend base URL
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;

  try {
    const r = await fetch(fullUrl, opts);
    if (!r.ok) {
      const txt = await r.text().catch(() => r.statusText || 'error');
      const err = new Error(`HTTP ${r.status}: ${txt}`);
      err.status = r.status;
      throw err;
    }
    return await r.json().catch(() => null);
  } catch (err) {
    console.error('fetchJSON error for', fullUrl, err);
    throw err;
  }
}

// fetch wrappers
async function fetchCurrentUser() {
  try { return await fetchJSON('/me'); } catch (err) { return null; }
}
async function fetchGroupData() {
  try { return await fetchJSON(`/api/group/${slug}`); } catch (err) { return null; }
}
async function fetchResources() {
  try { return await fetchJSON(`/api/group/${slug}/resources`) || []; } catch (err) { return []; }
}

// ---------- UI helpers ----------
function setGroupHeaderLoading() {
  const gn = $('group-name');
  if (gn) gn.textContent = 'Loading …';
  const body = $('resources-list-body');
  if (body) body.innerHTML = '<div class="muted">Loading resources…</div>';
}

function showMainError(msg) {
  // keep page chrome, show clear message in header area and hide posts
  const gn = $('group-name'); if (gn) gn.textContent = msg;
  $('group-description') && ($('group-description').textContent = '');
  $('group-creator') && ($('group-creator').textContent = '');
  if ($('post-section')) $('post-section').style.display = 'none';
  const body = $('resources-list-body');
  if (body) body.innerHTML = `<div class="muted">${escapeHtml(msg)}</div>`;
}

function renderReplies(container, replies) {
  container.innerHTML = '';
  if (!replies || replies.length === 0) {
    container.innerHTML = '<div class="muted">No replies yet</div>';
    return;
  }
  replies.forEach(rep => {
    const d = document.createElement('div');
    d.style.borderTop = '1px solid #eee';
    d.style.paddingTop = '6px';
    d.innerHTML = `
      <strong>${escapeHtml(rep.authorName || rep.author)}</strong>
      <div class="muted small">${rep.createdAt ? new Date(rep.createdAt).toLocaleString() : ''}</div>
      <div>${escapeHtml(rep.content)}</div>`;
    container.appendChild(d);
  });
}

// ---------- Posts ----------
function displayPosts(posts) {
  const postList = $('post-list');
  if (!postList) return;
  postList.innerHTML = '';
  if (!posts || posts.length === 0) {
    postList.innerHTML = '<p>No posts yet.</p>';
    return;
  }
  posts.forEach(post => {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `<small>${escapeHtml(post.author)} • ${post.createdAt ? new Date(post.createdAt).toLocaleString() : ''}</small>
                     <div>${escapeHtml(post.content)}</div>`;
    postList.appendChild(div);
  });
}

// --- add near other helpers (before init) ---
async function displayJoinRequestButton(group) {
  const sec = $('request-section');
  if (!sec) return;

  // if no user, invite to log in
  if (!currentUser) {
    sec.style.display = 'block';
    sec.innerHTML = `<p>Please <a href="/login.html">log in</a> to request to join this group.</p>`;
    return;
  }

  // don't show for creator or members
  if (group.creator === currentUser.email || group.isMember) {
    sec.style.display = 'none';
    return;
  }

  // show pending or button
  sec.style.display = 'block';
  const pending = group.pendingRequests || [];
  const isPending = pending.includes(currentUser.email);

  if (isPending) {
    sec.innerHTML = `<p>Your join request is pending approval.</p>`;
    return;
  }

  sec.innerHTML = `<button id="join-request-btn" class="add-resource-btn">Request to Join Group</button>`;
  const btn = $('join-request-btn');
  btn.addEventListener('click', async () => {
    try {
      const r = await fetch(`${API_BASE}/api/group/${slug}/join-request`, {
        method: 'POST',
        credentials: 'include'
      });
      if (r.ok) {
        sec.innerHTML = '<p>Your join request was sent.</p>';
      } else {
        const text = await r.text();
        sec.innerHTML = `<p>Error: ${escapeHtml(text)}</p>`;
      }
    } catch (err) {
      sec.innerHTML = `<p>Error sending request</p>`;
      console.error(err);
    }
  });
}

function displayApproveRequests(group) {
  const sec = $('request-section');
  if (!sec) return;

  // only group creator sees approve UI
  if (!group.isCreator) return;

  const pending = group.pendingRequests || [];
  if (!pending.length) return;

  sec.style.display = 'block';
  sec.innerHTML = `
    <h3>Pending Join Requests</h3>
    <ul>
      ${pending.map(u => `
        <li>
          ${escapeHtml(u)}
          <button data-user="${escapeHtml(u)}" class="approve-btn">Approve</button>
        </li>
      `).join('')}.
    </ul>
  `;
  sec.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const emailTo = btn.getAttribute('data-user');
      try {
        const r = await fetch(`${API_BASE}/api/group/${slug}/approve`, {
          method: 'POST',
          credentials: 'include',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ emailToApprove: emailTo })
        });
        if (r.ok) {
          btn.parentElement.remove();
        } else {
          alert('Failed to approve: ' + await r.text());
        }
      } catch (err) {
        alert('Approve failed');
        console.error(err);
      }
    });
  });
}

// ---------- Init ----------
async function init() {
  setGroupHeaderLoading();

  try {
    currentUser = await fetchCurrentUser();
  } catch (err) {
    console.warn('fetchCurrentUser failed', err);
    currentUser = null;
  }

  let group = null;
  try {
    group = await fetchGroupData();
  } catch (err) {
    console.error('fetchGroupData unexpected error', err);
    group = null;
  }

  if (!group || !group.name) {
    console.warn('Group not available for slug:', slug);
    showMainError('Group not found or you are not authorized');
    return;
  }

  // populate header
  $('group-name') && ($('group-name').textContent = group.name);
  $('group-description') && ($('group-description').textContent = group.description || '');
  $('group-creator') && ($('group-creator').textContent = group.creator || '');
  $('sidebar-group-name') && ($('sidebar-group-name').textContent = group.name);
  if (group.imageUrl && $('group-image')) $('group-image').src = group.imageUrl;

  const registryBtn = $('open-registry-btn');
  if (registryBtn) {
    registryBtn.style.display = 'block';
    registryBtn.textContent = 'Resources';
    registryBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const encoded = encodeURIComponent(group.name || slug);
      window.location.href = `/resource_registry.html?group=${encoded}`;
    });
  }

  displayJoinRequestButton(group);
  displayApproveRequests(group);

  if (group.isMember) {
    $('post-section') && ($('post-section').style.display = 'block');
    displayPosts(group.posts || []);
  } else {
    $('post-section') && ($('post-section').style.display = 'none');
  }
}

// start
init();

// ---------- Post submission handler ----------
$('post-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const content = $('post-content')?.value?.trim();
  if (!content) return;
  try {
    const r = await fetch(`${API_BASE}/api/group/${slug}/posts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (r.ok) {
      $('post-content').value = '';
      const upd = await fetchGroupData();
      displayPosts(upd?.posts || []);
    } else {
      const txt = await r.text().catch(() => 'Failed to post');
      alert(txt);
    }
  } catch (err) {
    alert('Failed to post: ' + (err.message || err));
  }
});