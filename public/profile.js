// profile.js - updated with live API endpoints for Capacitor/mobile compatibility
const API_BASE = 'https://community-hub-j9na.onrender.com';

window.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    // Fetch your user data
    const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include' });
    if (!meRes.ok) throw new Error('Not logged in');
    const me = await meRes.json();

    document.getElementById('profile-name').textContent =
      `Welcome, ${me.name}`;

    // Fetch all groups (we'll filter)
    const groupsRes = await fetch(`${API_BASE}/api/groups`, { credentials: 'include' });
    const allGroups = groupsRes.ok ? await groupsRes.json() : [];

    // Separate created vs joined
    const createdList = document.getElementById('created-groups');
    const joinedList  = document.getElementById('joined-groups');
    createdList.innerHTML = joinedList.innerHTML = '';

    // me.groups is array of slugs
    const myGroups = allGroups.filter(g => me.groups.includes(g.slug));
    const created  = myGroups.filter(g => g.creator === me.email);
    const joined   = myGroups.filter(g => g.creator !== me.email);

    renderGroupLinks(created, createdList);
    renderGroupLinks(joined,  joinedList);

    // Pending join requests (only groups you created)
    const pendingList = document.getElementById('pending-requests');
    pendingList.innerHTML = '';
    if (me.joinRequests?.length) {
      me.joinRequests.forEach(req => {
        const li = document.createElement('li');
        li.textContent = `${req.userEmail} → ${req.groupName}`;
        pendingList.appendChild(li);
      });
    } else {
      pendingList.innerHTML = '<li>No pending requests.</li>';
    }

    // My posts
    const postsContainer = document.getElementById('posts-container');
    postsContainer.innerHTML = '';
    if (me.posts?.length) {
      me.posts.forEach(p => {
        const d = document.createElement('div');
        d.className = 'post';
        d.innerHTML = `
          <small>${new Date(p.createdAt).toLocaleString()} in ${p.group}</small>
          <p>${escapeHtml(p.content)}</p>
        `;
        postsContainer.appendChild(d);
      });
    } else {
      postsContainer.textContent = 'No posts yet.';
    }

  } catch (err) {
    console.error(err);
    window.location.href = '/';
  }
}

function renderGroupLinks(list, container) {
  if (!list.length) {
    container.innerHTML = '<li>None</li>';
    return;
  }
  list.forEach(g => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href = `/group/${g.slug}.html`;
    a.textContent = g.name;
    li.appendChild(a);
    container.appendChild(li);
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}