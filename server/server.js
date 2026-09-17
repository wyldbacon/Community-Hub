// server/server.js

const express    = require('express');
const session    = require('express-session');
const path       = require('path');
const bodyParser = require('body-parser');
const mongoose   = require('mongoose');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MONGOOSE CONNECTION ───────────────────────────────────────────────────────
const MONGO_URI = 'mongodb+srv://merlinbacon101_db_user:TupWdKCxo369LDzT@cluster0.4hgjefk.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected successfully to MongoDB Atlas!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ─── MONGOOSE SCHEMAS & MODELS ───────────────────────────────────────────────

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  groups: [{ type: String }] // Array of group slugs
});
const User = mongoose.model('User', userSchema);

// Group Schema
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  creator: { type: String, required: true },
  members: [{ type: String }],
  joinRequests: [{ type: String }],
  posts: [{
    author: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
  }]
});
const Group = mongoose.model('Group', groupSchema);

// Resource Schema
const resourceSchema = new mongoose.Schema({
  groupSlug: { type: String, required: true },
  title: { type: String, required: true },
  address: { type: String, default: '' },
  type: { type: String, required: true },
  description: { type: String, default: '' },
  kind: { type: String, default: 'offer' },
  fulfil: { type: String, default: 'free' },
  tradeDesc: { type: String, default: '' },
  responses: [{
    author: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
  }],
  closed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true }
});
const Resource = mongoose.model('Resource', resourceSchema);

// — Utility to slugify names
function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
}

// — Session + body-parsing + static-serve
app.use(session({
  secret: 'community-hub-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────────

// Sign up
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('Email already in use');
    }

    const newUser = new User({ name, email, password, groups: [] });
    await newUser.save();

    req.session.user = { name, email };
    res.redirect('/home.html');
  } catch (err) {
    res.status(500).send('Error creating user');
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(401).send('Invalid credentials');
    }

    req.session.user = { name: user.name, email: user.email };
    res.redirect('/home.html');
  } catch (err) {
    res.status(500).send('Error logging in');
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// ─── GROUP CREATION ────────────────────────────────────────────────────────────

// Create a new group
app.post('/create-group', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required');
  try {
    const { groupName, description, imageUrl } = req.body;
    const slug = slugify(groupName);

    const existingGroup = await Group.findOne({ slug });
    if (existingGroup) {
      return res.status(400).send('Group already exists');
    }

    const newGroup = new Group({
      name: groupName,
      slug,
      description,
      imageUrl: imageUrl || '',
      creator: req.session.user.email,
      members: [req.session.user.email],
      joinRequests: [],
      posts: []
    });
    await newGroup.save();

    // Add to user's membership
    await User.updateOne(
      { email: req.session.user.email },
      { $addToSet: { groups: slug } }
    );

    res.redirect(`/group/${slug}.html`);
  } catch (err) {
    res.status(500).send('Error creating group');
  }
});

// ─── PUBLIC APIs ────────────────────────────────────────────────────────────────

// List all groups
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Group.find({}, 'name slug description creator');
    res.json(groups);
  } catch (err) {
    res.status(500).send('Error fetching groups');
  }
});

// Current user data: profile + feed + pending join requests
app.get('/me', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Not logged in');
  try {
    const me = await User.findOne({ email: req.session.user.email });
    if (!me) return res.status(404).send('User not found');

    const myGroups = await Group.find({ slug: { $in: me.groups || [] } });

    // Build feed
    const feed = [];
    myGroups.forEach(g => {
      (g.posts || []).forEach(p => {
        feed.push({
          group: g.name,
          content: p.content,
          author: p.author,
          createdAt: p.createdAt
        });
      });
    });

    // Collect pending join-requests for groups created by me
    const createdGroups = await Group.find({ creator: me.email, 'joinRequests.0': { $exists: true } });
    const joins = [];
    createdGroups.forEach(g => {
      g.joinRequests.forEach(requester => {
        joins.push({
          groupName: g.name,
          groupSlug: g.slug,
          userEmail: requester
        });
      });
    });

    res.json({
      name: me.name,
      email: me.email,
      groups: me.groups,
      posts: feed,
      joinRequests: joins
    });
  } catch (err) {
    res.status(500).send('Error fetching profile');
  }
});

// Single‐group data
app.get('/api/group/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const meEmail = req.session.user?.email;
    const g = await Group.findOne({ slug });
    if (!g) return res.status(404).send('Group not found');

    const isCreator = (g.creator === meEmail);
    const isMember = (g.members || []).includes(meEmail);

    res.json({
      name: g.name,
      description: g.description,
      imageUrl: g.imageUrl,
      creator: g.creator,
      isCreator,
      isMember,
      posts: isMember ? g.posts : [],
      pendingRequests: isCreator ? g.joinRequests : []
    });
  } catch (err) {
    res.status(500).send('Error fetching group');
  }
});

// Request to join
app.post('/api/group/:slug/join-request', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required');
  try {
    const slug = req.params.slug;
    const me = req.session.user.email;
    const g = await Group.findOne({ slug });
    
    if (!g) return res.status(404).send('Group not found');
    if (g.members.includes(me)) return res.status(400).send('Already a member');
    if (g.joinRequests.includes(me)) return res.status(400).send('Already requested');

    g.joinRequests.push(me);
    await g.save();
    res.send('Join request sent');
  } catch (err) {
    res.status(500).send('Error requesting to join');
  }
});

// Approve a join request
app.post('/api/group/:slug/approve', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required');
  try {
    const { slug } = req.params;
    const { emailToApprove } = req.body;
    const me = req.session.user.email;

    const g = await Group.findOne({ slug });
    if (!g || g.creator !== me) return res.status(403).send('Not authorized');

    // Remove from requests, add to members
    g.joinRequests = g.joinRequests.filter(e => e !== emailToApprove);
    if (!g.members.includes(emailToApprove)) g.members.push(emailToApprove);
    await g.save();

    // Add slug to user membership
    await User.updateOne(
      { email: emailToApprove },
      { $addToSet: { groups: slug } }
    );

    res.send('User approved');
  } catch (err) {
    res.status(500).send('Error approving request');
  }
});

// Post into group
app.post('/api/group/:slug/posts', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required');
  try {
    const { slug } = req.params;
    const { content } = req.body;
    const me = req.session.user.email;

    const g = await Group.findOne({ slug });
    if (!g) return res.status(404).send('Group not found');
    if (!g.members.includes(me)) return res.status(403).send('Not a member');

    g.posts.unshift({ author: me, content });
    await g.save();
    res.status(201).json({ status: 'ok' });
  } catch (err) {
    res.status(500).send('Error posting message');
  }
});

// ─── RESOURCE ROUTES ──────────────────────────────────────────────────────────

app.get('/api/group/:slug/resources', async (req, res) => {
  try {
    const forGroup = await Resource.find({ groupSlug: req.params.slug });
    res.json(forGroup);
  } catch (err) {
    res.status(500).send('Error fetching group resources');
  }
});

app.get('/api/resources', async (req, res) => {
  try {
    const allResources = await Resource.find({});
    res.json(allResources);
  } catch (err) {
    res.status(500).send('Error fetching resources');
  }
});

app.post('/api/group/:slug/resources', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required');
  try {
    const slug = req.params.slug;
    const { title, address, type, description, kind = 'offer', fulfil = 'free', tradeDesc = '' } = req.body || {};

    if (!title || !type) return res.status(400).send('Missing title or type');

    const group = await Group.findOne({ slug });
    if (!group) return res.status(404).send('Group not found');

    const newRes = new Resource({
      groupSlug: slug,
      title: String(title).slice(0, 300),
      address: String(address || ''),
      type: String(type),
      description: String(description || ''),
      kind: String(kind),
      fulfil: String(fulfil),
      tradeDesc: String(tradeDesc || ''),
      createdBy: req.session.user.email
    });

    await newRes.save();
    res.status(201).json(newRes);
  } catch (err) {
    res.status(500).send('Error adding resource');
  }
});

app.post('/api/group/:slug/resources/:id/respond', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required');
  try {
    const { id } = req.params;
    const { message } = req.body || {};
    if (!message) return res.status(400).send('Missing message');

    const r = await Resource.findById(id);
    if (!r) return res.status(404).send('Resource not found');

    r.responses.push({
      author: req.session.user.email,
      content: String(message)
    });
    await r.save();
    res.status(201).json({ status: 'ok' });
  } catch (err) {
    res.status(500).send('Error responding to resource');
  }
});

app.post('/api/group/:slug/resources/:id/close', async (req, res) => {
  if (!req.session.user) return res.status(401).send('Login required');
  try {
    const { slug, id } = req.params;
    const user = req.session.user.email;

    const g = await Group.findOne({ slug });
    if (!g) return res.status(404).send('Group not found');
    if (!(g.members || []).includes(user)) {
      return res.status(403).send('Only group members can close resources');
    }

    const r = await Resource.findById(id);
    if (!r) return res.status(404).send('Resource not found');

    r.closed = true;
    await r.save();
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).send('Error closing resource');
  }
});

// ─── HTML ROUTES ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/home.html', (req, res) => res.sendFile(path.join(__dirname, '../public/home.html')));
app.get('/profile.html', (req, res) => res.sendFile(path.join(__dirname, '../public/profile.html')));
app.get('/group/:slug.html', (req, res) => res.sendFile(path.join(__dirname, '../public/group.html')));

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});