const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  findUserByEmail,
  findUserById,
  createUser,
  readUserData,
  writeUserData,
} = require('./lib/store');
const {
  signToken,
  hashPassword,
  comparePassword,
  newUserId,
  authMiddleware,
} = require('./lib/auth');
const { mergeSyncData } = require('./lib/merge');
const { fetchOpinet } = require('./lib/opinet');

const app = express();
const PORT = process.env.PORT || 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');

if (!fs.existsSync(INDEX_FILE)) {
  console.error('FATAL: index.html 없음 →', INDEX_FILE);
  process.exit(1);
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));

function resolveOpinetKey(queryKey) {
  return queryKey || process.env.OPINET_API_KEY || '';
}

// --- Auth ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: '올바른 이메일을 입력해주세요.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
    }
    if (findUserByEmail(email)) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    }

    const user = {
      id: newUserId(),
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    createUser(user);
    writeUserData(user.id, { entries: [], settings: { apiKey: '' }, deletedIds: [] });

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message || '회원가입 실패' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = findUserByEmail(email);

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message || '로그인 실패' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = findUserById(req.user.sub);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  res.json({ user: { id: user.id, email: user.email } });
});

// --- Sync ---

app.get('/api/sync', authMiddleware, (req, res) => {
  const data = readUserData(req.user.sub);
  res.json({ data });
});

app.post('/api/sync', authMiddleware, (req, res) => {
  try {
    const client = req.body.data || req.body;
    const server = readUserData(req.user.sub);
    const merged = mergeSyncData(
      {
        entries: client.entries || [],
        settings: client.settings || {},
        deletedIds: client.deletedIds || [],
        settingsUpdatedAt: client.settingsUpdatedAt || null,
      },
      {
        entries: server.entries || [],
        settings: server.settings || {},
        deletedIds: server.deletedIds || [],
        settingsUpdatedAt: server.settingsUpdatedAt || null,
      }
    );

    writeUserData(req.user.sub, merged);
    res.json({ data: merged, merged: true });
  } catch (err) {
    res.status(500).json({ error: err.message || '동기화 실패' });
  }
});

// --- Opinet proxy ---

app.get('/api/opinet/status', (_req, res) => {
  res.json({
    configured: Boolean(process.env.OPINET_API_KEY),
    message: process.env.OPINET_API_KEY
      ? '서버에 오피넷 키가 설정되어 있습니다.'
      : '설정 탭에서 오피넷 API 키를 입력해주세요.',
  });
});

app.get('/api/opinet/:endpoint', async (req, res) => {
  const { endpoint } = req.params;
  const certkey = resolveOpinetKey(req.query.certkey);

  if (!certkey) {
    return res.status(400).json({
      error: '오피넷 API 인증키가 필요합니다. 설정에서 키를 입력하거나 Render에 OPINET_API_KEY를 등록하세요.',
    });
  }

  const allowed = ['aroundAll', 'detailById', 'avgAllPrice', 'areaCode', 'lowTop10'];
  if (!allowed.includes(endpoint)) {
    return res.status(400).json({ error: '지원하지 않는 API입니다.' });
  }

  try {
    const { certkey: _ck, ...rest } = req.query;
    const data = await fetchOpinet(endpoint, { ...rest, certkey });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message || 'API 요청 실패' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'car-ledger', dataDir: process.env.DATA_DIR || 'default' });
});

app.get('/', (_req, res) => {
  res.sendFile(INDEX_FILE);
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API not found' });
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.sendFile(INDEX_FILE, (err) => {
      if (err) next(err);
    });
  }
  return res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send('Server error');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`차계부 서버 실행 중 (port ${PORT}, env=${process.env.NODE_ENV || 'dev'})`);
});