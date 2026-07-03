const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SYNC_DIR = path.join(DATA_DIR, 'sync');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SYNC_DIR)) fs.mkdirSync(SYNC_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDirs();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function readUsers() {
  return readJson(USERS_FILE, { users: [] });
}

function writeUsers(data) {
  writeJson(USERS_FILE, data);
}

function findUserByEmail(email) {
  const { users } = readUsers();
  return users.find((u) => u.email === email.toLowerCase()) || null;
}

function findUserById(id) {
  const { users } = readUsers();
  return users.find((u) => u.id === id) || null;
}

function createUser(user) {
  const data = readUsers();
  data.users.push(user);
  writeUsers(data);
  return user;
}

function defaultSyncData() {
  return {
    entries: [],
    settings: { apiKey: '' },
    deletedIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function readUserData(userId) {
  const file = path.join(SYNC_DIR, `${userId}.json`);
  return readJson(file, defaultSyncData());
}

function writeUserData(userId, payload) {
  const file = path.join(SYNC_DIR, `${userId}.json`);
  writeJson(file, {
    ...payload,
    updatedAt: new Date().toISOString(),
  });
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  readUserData,
  writeUserData,
  defaultSyncData,
};