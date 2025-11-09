import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { hashPassword, comparePassword, signToken, verifyToken } from '../lib/auth';
import * as kv from './kv_store';

const app = express();
app.use(express.json());

// uploads -> local storage
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// --- Auth endpoints ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'User already exists' });
    const hashed = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, password: hashed, name } });
    const token = signToken({ sub: String(user.id), email: user.email });
    return res.json({ accessToken: token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await comparePassword(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = signToken({ sub: String(user.id), email: user.email });
    return res.json({ accessToken: token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const auth = req.headers.authorization?.split(' ')[1];
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const payload: any = verifyToken(auth);
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

// --- File uploads ---
app.post('/api/upload-avatar', upload.single('file'), async (req, res) => {
  try {
    const auth = req.headers.authorization?.split(' ')[1];
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const payload: any = verifyToken(auth);
    const userId = Number(payload.sub);
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file' });

    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    const profile = (await kv.get(`user:${userId}`)) || {};
    profile.avatarUrl = url;
    profile.avatarPath = file.filename;
    profile.updatedAt = new Date().toISOString();
    await kv.set(`user:${userId}`, profile);

    await prisma.user.update({ where: { id: userId }, data: {} });

    return res.json({ success: true, avatarUrl: url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/upload-attachment', upload.single('file'), async (req, res) => {
  try {
    const auth = req.headers.authorization?.split(' ')[1];
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const payload: any = verifyToken(auth);
    const userId = Number(payload.sub);
    const file = req.file;
    const { taskId } = req.body;
    if (!file || !taskId) return res.status(400).json({ error: 'Missing file or taskId' });

    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    const attachment = {
      id: `attachment-${Date.now()}`,
      name: file.originalname,
      url,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      path: file.filename,
    };

    const key = `task:${taskId}`;
    const task = (await kv.get(key)) || {};
    task.attachments = [...(task.attachments || []), attachment];
    task.updatedAt = new Date().toISOString();
    await kv.set(key, task);

    return res.json({ success: true, attachment });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// serve uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// --- KV endpoints (optional) ---
app.get('/api/kv/:key', async (req, res) => {
  const val = await kv.get(req.params.key);
  return res.json({ value: val });
});

app.post('/api/kv/:key', async (req, res) => {
  await kv.set(req.params.key, req.body.value);
  return res.json({ success: true });
});

// Start
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => console.log(`API server listening on ${port}`));

export default app;