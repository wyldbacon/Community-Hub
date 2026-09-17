/* resource_registry.js
   Client for Resource Registry using server APIs (with localStorage fallback).
   - Expects server endpoints:
       GET  /api/group/:slug/resources
       POST /api/group/:slug/resources
       POST /api/group/:slug/resources/:id/respond
       POST /api/group/:slug/resources/:id/close
*/
(function(){
  // ---------- helpers ----------
  const params = new URLSearchParams(location.search);
  const groupName = params.get('group') || 'My Group';

  // client-side slugify to match server slug format
  function slugify(text = '') {
    return String(text).toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '');
  }

  const slug = slugify(groupName);
  const API_BASE = `/api/group/${encodeURIComponent(slug)}`;
  const KEY = 'registry_' + slug; // localStorage fallback key

  const $ = sel => document.getElementById(sel);
  const el = (tag, attrs = {}) => { const d = document.createElement(tag); Object.assign(d, attrs); return d; };

  document.getElementById('page-heading').textContent = groupName + ' Registry';

  const addMenuBtns = document.querySelectorAll('.add-menu button');
  const formArea = document.getElementById('formArea');
  const resourceForm = document.getElementById('resourceForm');
  const kindInput = document.getElementById('kind');
  const tradeBox = document.getElementById('tradeBox');
  const registryList = document.getElementById('registryList');
  const isMemberCheckbox = document.getElementById('isMember');

  let resources = [];

  // ---------- API calls ----------
  async function fetchResourcesAPI(){
    try {
      const r = await fetch(`${API_BASE}/resources`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch resources: ' + r.status);
      const data = await r.json();
      return data || [];
    } catch (err) {
      console.warn('fetchResourcesAPI failed, falling back to localStorage', err);
      return null; // signal fallback
    }
  }

  async function createResourceAPI(payload){
    try {
      const r = await fetch(`${API_BASE}/resources`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const txt = await r.text().catch(()=>r.statusText);
        throw new Error(txt || 'Failed to create resource');
      }
      const data = await r.json();
      return data;
    } catch (err) {
      console.error('createResourceAPI error', err);
      return null;
    }
  }

  async function respondResourceAPI(id, message){
    try {
      const r = await fetch(`${API_BASE}/resources/${encodeURIComponent(id)}/respond`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!r.ok) {
        const txt = await r.text().catch(()=>r.statusText);
        throw new Error(txt || 'Failed to respond');
      }
      return true;
    } catch (err) {
      console.error('respondResourceAPI error', err);
      return false;
    }
  }

  async function closeResourceAPI(id){
    try {
      const r = await fetch(`${API_BASE}/resources/${encodeURIComponent(id)}/close`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!r.ok) {
        const txt = await r.text().catch(()=>r.statusText);
        throw new Error(txt || 'Failed to close resource');
      }
      return true;
    } catch (err) {
      console.error('closeResourceAPI error', err);
      return false;
    }
  }

  // ---------- localStorage fallback ----------
  function loadFromLocal(){
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('localStorage parse failed', err);
      return [];
    }
  }
  function saveToLocal(items){
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (err){ console.warn('localStorage save failed', err); }
  }

  // ---------- rendering ----------
  function render(){
    registryList.innerHTML = '';
    if(!resources || resources.length === 0){
      const p = el('div'); p.className = 'muted'; p.textContent = 'No resources yet — use "Add resource" to create one.';
      registryList.appendChild(p);
      return;
    }

    resources.forEach((r, idx) => {
      const bar = el('div'); bar.className='resource-bar';
      if(r.closed) bar.classList.add('closed');

      const meta = el('div'); meta.className='resource-meta';
      const title = el('div'); title.className='resource-title'; title.title = r.title; title.textContent = r.title;
      const type = el('div'); type.className='resource-type'; type.textContent = r.type;
      const address = el('div'); address.className='resource-address'; address.textContent = r.address;
      const tag = el('div'); tag.className='resource-tag'; tag.textContent = (r.kind||'offer') + (r.fulfil ? ' • ' + r.fulfil : '');

      meta.appendChild(title); meta.appendChild(address); meta.appendChild(type); meta.appendChild(tag);

      const actions = el('div'); actions.className='resource-actions';
      const arrow = el('button'); arrow.className='arrow-btn'; arrow.innerHTML = r.open ? '▾' : '▸';
      arrow.addEventListener('click', async ()=>{
        // toggle locally then reflect server state if available
        r.open = !r.open;
        render();
      });

      const respondBtn = el('button'); respondBtn.className='btn-ghost'; respondBtn.textContent='Respond';
      respondBtn.addEventListener('click', ()=>{ openRespond(idx); });

      const closeBtn = el('button'); closeBtn.className='btn-ghost'; closeBtn.textContent='Close';
      closeBtn.addEventListener('click', async ()=>{
        if(!confirm('Close this resource?')) return;
        // attempt API close; fallback to local close
        const ok = await closeResourceAPI(r.id);
        if(ok){
          await reloadResources(); // refresh from server
        } else {
          r.closed = true;
          saveToLocal(resources);
          render();
        }
      });

      actions.appendChild(respondBtn);
      if(isMemberCheckbox.checked) actions.appendChild(closeBtn);
      actions.appendChild(arrow);

      bar.appendChild(meta); bar.appendChild(actions);
      registryList.appendChild(bar);

      // details
      const details = el('div'); details.className='collapsed-details';
      if(r.open) bar.classList.add('open');

      const desc = el('div'); desc.className='detail-row';
      desc.innerHTML = `<div style="flex:1 1 60%"><strong>Description</strong><div class="muted">${escapeHtml(r.description||'—')}</div></div>`;
      details.appendChild(desc);

      if(r.fulfil === 'trade' && r.tradeDesc){
        const trade = el('div'); trade.className='detail-row';
        trade.innerHTML = `<div style="flex:1 1 60%"><strong>Trade terms</strong><div class="muted">${escapeHtml(r.tradeDesc||'—')}</div></div>`;
        details.appendChild(trade);
      }

      // responses
      const respWrap = el('div'); respWrap.className='detail-row';
      const respList = el('div'); respList.style.width='100%';
      respList.innerHTML = '<strong>Responses</strong>';
      if(Array.isArray(r.responses) && r.responses.length){
        // support both string-style responses (old localStorage) and object-style from server
        r.responses.forEach(m=>{
          const mdiv = el('div'); mdiv.className='muted'; mdiv.style.marginTop='6px';
          if (typeof m === 'string') {
            mdiv.textContent = m;
          } else if (m.content) {
            const who = m.author || m.authorName || 'Someone';
            const when = m.createdAt ? ' • ' + (new Date(m.createdAt).toLocaleString()) : '';
            mdiv.innerHTML = `<strong>${escapeHtml(who)}</strong><div class="muted small">${when}</div><div>${escapeHtml(m.content)}</div>`;
          } else {
            mdiv.textContent = JSON.stringify(m);
          }
          respList.appendChild(mdiv);
        });
      } else {
        const empty = el('div'); empty.className='muted'; empty.style.marginTop='6px'; empty.textContent='No responses yet.';
        respList.appendChild(empty);
      }
      details.appendChild(respList);

      // respond area
      const respondArea = el('div'); respondArea.className='respond-area';
      const ta = el('textarea'); ta.placeholder='Write a short message to the resource owner...'; ta.style.flex='1';
      const send = el('button'); send.className='btn'; send.textContent='Send';
      send.addEventListener('click', async ()=>{
        const text = ta.value.trim();
        if(!text) return alert('Please write a message');
        // try API first
        const ok = await respondResourceAPI(r.id, text);
        if(ok){
          await reloadResources();
        } else {
          // fallback: append locally (author unknown)
          r.responses = r.responses || [];
          r.responses.push({ author: 'You', content: text, createdAt: new Date().toISOString() });
          saveToLocal(resources);
          ta.value = '';
          render();
        }
      });
      respondArea.appendChild(ta); respondArea.appendChild(send);
      details.appendChild(respondArea);

      registryList.appendChild(details);
    });
  }

  function openRespond(idx){
    resources[idx].open = true;
    saveToLocal(resources);
    render();
    setTimeout(()=>{ const ta = document.querySelectorAll('.respond-area textarea')[idx]; if(ta) ta.focus(); },100);
  }

  // ---------- form & controls ----------
  addMenuBtns.forEach(btn => btn.addEventListener('click', (ev)=>{
    const kind = ev.currentTarget.dataset.kind; kindInput.value = kind; formArea.style.display='block'; formArea.setAttribute('aria-hidden','false');
    document.querySelector('#sub').textContent = kind === 'offer' ? 'Offering — fill the details below' : 'Request — fill the details below';
    resourceForm.reset(); tradeBox.style.display='none';
  }));

  resourceForm.addEventListener('change',(e)=>{
    const r = resourceForm.querySelector('input[name="fulfil"]:checked');
    if(r && r.value === 'trade') tradeBox.style.display='block'; else tradeBox.style.display='none';
  });

  document.getElementById('cancelForm').addEventListener('click',()=>{ formArea.style.display='none'; formArea.setAttribute('aria-hidden','true'); });

  document.getElementById('addResourceBtn').addEventListener('click', async ()=>{
    const title = document.getElementById('title').value.trim();
    const address = document.getElementById('address').value;
    const type = document.getElementById('type').value;
    const description = document.getElementById('description').value.trim();
    const kind = document.getElementById('kind').value;
    const fulfil = resourceForm.querySelector('input[name="fulfil"]:checked')?.value || 'free';
    const tradeDesc = document.getElementById('tradeDesc').value.trim();
    if(!title){ return alert('Please enter a resource name'); }

    const payload = { title, address, type, description, kind, fulfil, tradeDesc };

    // disable button while creating
    const addBtn = document.getElementById('addResourceBtn');
    addBtn.disabled = true;
    addBtn.textContent = 'Adding…';

    const created = await createResourceAPI(payload);
    if(created){
      // refresh full list from server (authoritative)
      await reloadResources();
    } else {
      // fallback: add locally
      const newR = { id: Date.now().toString(), ...payload, responses: [], closed:false, open:true, createdAt: new Date().toISOString(), createdBy: 'local' };
      resources.unshift(newR);
      saveToLocal(resources);
      render();
    }

    addBtn.disabled = false;
    addBtn.textContent = 'Add resource';
    formArea.style.display='none';
  });

  isMemberCheckbox.addEventListener('change', ()=> render());

  // ---------- load / reload ----------
  async function reloadResources(){
    const apiList = await fetchResourcesAPI();
    if(Array.isArray(apiList)){
      // ensure responses arrays and ids are normalized
      resources = apiList.map(r => Object.assign({
        id: String(r.id || r._id || Date.now()),
        title: r.title || '',
        address: r.address || '',
        type: r.type || '',
        description: r.description || '',
        kind: r.kind || 'offer',
        fulfil: r.fulfil || r.fulfill || 'free',
        tradeDesc: r.tradeDesc || '',
        responses: r.responses || [],
        closed: !!r.closed,
        open: !!r.open,
        createdAt: r.createdAt || r.createdAt,
        createdBy: r.createdBy || r.createdBy
      }, r));
      saveToLocal(resources); // keep local copy
      render();
      return;
    }

    // fallback to local if API failed
    resources = loadFromLocal();
    render();
  }

  // initial load
  reloadResources();

  // expose for debugging & manual reload
  window._REG = {
    read: () => resources,
    saveLocal: () => saveToLocal(resources),
    reload: reloadResources
  };

  // ---------- small util ----------
  function escapeHtml(s = '') {
    const d = document.createElement('div'); d.innerText = s; return d.innerHTML;
  }

  function goHome() {
  window.location.href = '/home.html';
  }

  function goBack() {
    // Go back to the group page you came from
    window.history.back();
  }

})();
