// home.js - updated with live API endpoints for Capacitor/mobile compatibility
const API_BASE = 'https://community-hub-j9na.onrender.com';

window.addEventListener('DOMContentLoaded', () => {
  const newBtn    = document.getElementById('new-community-btn');
  const form      = document.getElementById('new-community-form');
  const cancelBtn = document.getElementById('cancel-community-btn');
  const list      = document.getElementById('communities-list');
  const feed      = document.getElementById('feed');
  const searchIn  = document.getElementById('group-search');
  const results   = document.getElementById('search-results');
  const jrBtn     = document.getElementById('show-join-requests');
  const jrCont    = document.getElementById('join-requests-container');
  const jrList    = document.getElementById('join-requests-list');
  const logoutBtn = document.getElementById('logout-btn');

  if (!newBtn || !form || !cancelBtn || !list || !feed || !searchIn || !results || !jrBtn || !jrCont || !jrList) {
    console.error('❌ One or more required DOM elements are missing in home.html');
    return;
  }

  // --- Global Resource Registry UI ---
  const resourcesToggleBtn = document.createElement('button');
  resourcesToggleBtn.id = 'show-resources-btn';
  resourcesToggleBtn.textContent = 'View All Resources';
  resourcesToggleBtn.style.margin = '12px 0';
  resourcesToggleBtn.style.padding = '8px 12px';
  resourcesToggleBtn.style.border = 'none';
  resourcesToggleBtn.style.borderRadius = '8px';
  resourcesToggleBtn.style.background = '#66bb6a';
  resourcesToggleBtn.style.color = '#fff';
  resourcesToggleBtn.style.cursor = 'pointer';

  feed.parentElement.insertBefore(resourcesToggleBtn, feed);

  const registrySection = document.getElementById('global-resource-registry');
  const globalList      = document.getElementById('global-resources-list');

  let allResources = [];

  resourcesToggleBtn.addEventListener('click', async () => {
    if (!registrySection) return;
    if (registrySection.style.display === 'none' || !registrySection.style.display) {
      registrySection.style.display = 'block';
      resourcesToggleBtn.textContent = 'Hide All Resources';
      await loadGlobalResources();
    } else {
      registrySection.style.display = 'none';
      resourcesToggleBtn.textContent = 'View All Resources';
    }
  });

  async function loadGlobalResources() {
    try {
      const res = await fetch(`${API_BASE}/api/resources`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load resources');
      allResources = await res.json();
      renderGlobalResources(allResources);
    } catch (err) {
      console.error('Error loading resources:', err);
      if (globalList) globalList.innerHTML = '<p class="muted">Failed to load resources.</p>';
    }
  }

  function renderGlobalResources(list) {
    if (!globalList) return;
    globalList.innerHTML = '';
    if (!list || !list.length) {
      globalList.innerHTML = '<p class="muted">No resources yet.</p>';
      return;
    }

    list.forEach(r => {
      const title = r.title || r.name || 'Untitled';
      const address = r.address || r.name || 'Untitled';
      const type = r.type || 'unknown';
      const kind = (r.kind || r.requestType || 'offer');
      const location = r.groupName || r.groupSlug || r.location || r.group || 'Unknown';
      const desc = r.description || '';
      const tradeDesc = r.tradeDesc || r.tradeDescription || '';

      const item = document.createElement('div');
      item.className = 'resource-item';
      item.style.marginBottom = '8px';

      item.innerHTML = `
        <div class="resource-bar" style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:10px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.04)">
          <div class="resource-meta" style="display:flex;gap:12px;align-items:center;min-width:0">
            <div class="resource-title" style="font-weight:700;color:#2a7a4d;max-width:460px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(title)}</div>
            <div class="resource-address" style="font-size:0.85rem;padding:6px 8px;border-radius:8px;background:#f1fbf1;border:1px solid #e3f4e6">${escapeHtml(address)}</div>
            <div class="resource-type" style="font-size:0.85rem;padding:6px 8px;border-radius:8px;background:#f1fbf1;border:1px solid #e3f4e6">${escapeHtml(type)}</div>
            <div class="resource-tag" style="font-size:0.82rem;padding:5px 8px;border-radius:999px;background:#fafdfb;border:1px solid #e7f6ea">${escapeHtml(kind)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <div style="font-size:0.85rem;color:#666">${escapeHtml(location)}</div>
            <button class="expand-btn" style="background:transparent;border:none;font-size:18px;cursor:pointer">▸</button>
          </div>
        </div>
        <div class="resource-details" style="display:none;background:#fbfff9;padding:10px;border-radius:8px;border:1px solid #eef9ee;margin-top:6px">
          <div><strong>Description</strong><div class="muted" style="margin-top:6px">${escapeHtml(desc || '—')}</div></div>
          ${tradeDesc ? `<div style="margin-top:8px"><strong>Trade</strong><div class="muted" style="margin-top:6px">${escapeHtml(tradeDesc)}</div></div>` : ''}
        </div>
      `;

      const expand = item.querySelector('.expand-btn');
      expand.addEventListener('click', () => {
        const details = item.querySelector('.resource-details');
        const isHidden = details.style.display === 'none';
        details.style.display = isHidden ? 'block' : 'none';
        expand.textContent = isHidden ? '▾' : '▸';
      });

      globalList.appendChild(item);
    });
  }

  // --- Filters ---
  const filterType = document.getElementById('filter-type');
  const filterCategory = document.getElementById('filter-category');
  const filterLocation = document.getElementById('filter-location');
  const clearFiltersBtn = document.getElementById('clear-filters');

  function applyGlobalFilters() {
    if (!allResources.length) return;
    const t = filterType?.value || '';
    const c = filterCategory?.value || '';
    const l = (filterLocation?.value || '').toLowerCase();

    const filtered = allResources.filter(r => {
      const kind = (r.kind || r.requestType || '').toString().toLowerCase();
      const type = (r.type || '').toString().toLowerCase();
      const loc = (r.groupName || r.groupSlug || r.location || r.group || '').toString().toLowerCase();
      if (t && kind !== t) return false;
      if (c && type !== c) return false;
      if (l && !loc.includes(l)) return false;
      return true;
    });

    renderGlobalResources(filtered);
  }

  filterType?.addEventListener('change', applyGlobalFilters);
  filterCategory?.addEventListener('change', applyGlobalFilters);
  filterLocation?.addEventListener('input', applyGlobalFilters);
  clearFiltersBtn?.addEventListener('click', () => {
    if (filterType) filterType.value = '';
    if (filterCategory) filterCategory.value = '';
    if (filterLocation) filterLocation.value = '';
    renderGlobalResources(allResources);
  });

  // --- Utilities ---
  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  // --- Group form toggle ---
  newBtn.onclick = () => { form.style.display='block'; newBtn.style.display='none'; };
  cancelBtn.onclick = () => { form.style.display='none'; newBtn.style.display='inline-block'; };

  function slugify(t) { return String(t).toLowerCase().trim().replace(/\s+/g,'-').replace(/[^\w\-]+/g,''); }

  // --- Create group ---
  form.onsubmit = async e => {
    e.preventDefault();
    const data = {
      groupName: form.groupName.value.trim(),
      description: form.description.value.trim(),
      imageUrl: form.imageUrl.value.trim()
    };
    if (!data.groupName || !data.description) { alert('Please fill all required fields'); return; }

    try {
      const res = await fetch(`${API_BASE}/create-group`, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify(data)
      });
      if (res.ok) {
        const slug = slugify(data.groupName);
        window.location.href = `/group/${slug}.html`;
      } else {
        const msg = await res.text().catch(()=>res.statusText||'Error');
        alert('Error creating group: ' + msg);
      }
    } catch(err) {
      console.error('Create group failed', err);
      alert('Network error creating group');
    }
  };

  // --- Load user data ---
  async function loadUserData() {
    const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include' });
    if (!meRes.ok) { console.error('/me failed'); return; }
    const me = await meRes.json();

    // --- Communities ---
    list.querySelectorAll('a.group-link').forEach(el=>el.remove());
    list.querySelectorAll('.no-communities').forEach(el=>el.remove());
    if (me.groups?.length) {
      const allGroupsRes = await fetch(`${API_BASE}/api/groups`, { credentials:'include' });
      const allGroups = allGroupsRes.ok ? await allGroupsRes.json() : [];
      me.groups.forEach(slug => {
        const grp = allGroups.find(g=>g.slug===slug);
        if (!grp) return;
        const a = document.createElement('a');
        a.href = `/group/${grp.slug}.html`;
        a.textContent = grp.name;
        a.className = 'group-link';
        list.insertBefore(a, newBtn);
      });
    } else {
      const div = document.createElement('div');
      div.textContent = 'No communities yet.';
      div.className = 'no-communities';
      div.style.padding = '8px';
      list.insertBefore(div, newBtn);
    }

    // --- Feed ---
    feed.innerHTML='';
    if (me.posts?.length) {
      const postsByGroup = {};
      me.posts.forEach(p => { if(!postsByGroup[p.group]) postsByGroup[p.group]=[]; postsByGroup[p.group].push(p); });
      Object.keys(postsByGroup).sort().forEach(groupName => {
        const groupPosts = postsByGroup[groupName].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        const container = document.createElement('div'); container.style.marginBottom='12px';
        const header = document.createElement('div'); header.style.cursor='pointer'; header.style.fontWeight='700';
        header.style.background='#e7f3e7'; header.style.padding='8px 12px'; header.style.borderRadius='6px';
        header.textContent = `▸ ${groupName}`; container.appendChild(header);

        const postsDiv = document.createElement('div'); postsDiv.style.display='none'; postsDiv.style.marginLeft='12px';
        groupPosts.forEach(p=>{
          const d = document.createElement('div'); d.className='post'; d.style.marginBottom='8px';
          d.innerHTML=`<p>${p.content}</p><small>Posted on ${new Date(p.createdAt).toLocaleString()}</small>`;
          postsDiv.appendChild(d);
        });
        container.appendChild(postsDiv);
        header.addEventListener('click', ()=>{ const hidden = postsDiv.style.display==='none'; postsDiv.style.display=hidden?'block':'none'; header.textContent=(hidden?'▾ ':'▸ ')+groupName; });
        feed.appendChild(container);
      });
    } else {
      const no = document.createElement('div'); no.textContent='No posts yet.'; no.style.padding='16px'; feed.appendChild(no);
    }
  }

  // --- Join requests ---
  jrBtn.onclick = async () => {
    const meRes = await fetch(`${API_BASE}/me`,{credentials:'include'}); if(!meRes.ok) return;
    const me = await meRes.json();
    const reqs = me.joinRequests||[];
    jrList.innerHTML=''; jrCont.style.display='block';
    if(!reqs.length){ jrList.innerHTML='<p>No join requests.</p>'; return; }
    reqs.forEach(r=>{
      const d = document.createElement('div'); d.className='join-request';
      d.innerHTML=`<strong>${r.userEmail}</strong> → <em>${r.groupName}</em>
        <button data-user="${r.userEmail}" data-group="${r.groupSlug}" class="jr-approve">Approve</button>`;
      jrList.appendChild(d);
    });
    jrList.querySelectorAll('.jr-approve').forEach(btn=>{
      btn.onclick = async ()=>{
        try {
          const res = await fetch(`${API_BASE}/api/group/${btn.dataset.group}/approve`, {
            method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({emailToApprove:btn.dataset.user})
          });
          if(res.ok) btn.parentElement.remove(); else { const err=await res.text(); alert('Approval failed: '+err); }
        } catch(err){ console.error('Approve failed',err); alert('Approval failed (network)'); }
      };
    });
  };

  // --- Logout ---
  if (logoutBtn) logoutBtn.addEventListener('click', async ()=>{
    const r = await fetch(`${API_BASE}/logout`,{method:'POST',credentials:'include'}); if(r.ok) window.location.href='/login.html'; else alert('Logout failed');
  });

  // --- Search ---
  searchIn.oninput = async ()=>{
    const q = searchIn.value.trim().toLowerCase();
    if(!q){ results.innerHTML=''; return; }
    const all = await fetch(`${API_BASE}/api/groups`,{credentials:'include'}).then(r=>r.json());
    results.innerHTML='';
    all.filter(g=>g.name.toLowerCase().includes(q)).forEach(g=>{
      const d=document.createElement('div'); d.textContent=g.name; d.onclick=()=>window.location.href=`/group/${g.slug}.html`; results.appendChild(d);
    });
  };
  document.addEventListener('click', e=>{ if(!searchIn.contains(e.target) && !results.contains(e.target)) results.innerHTML=''; });

  // --- Initial load ---
  loadUserData();
});