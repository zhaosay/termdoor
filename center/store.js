const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

const dataDir = process.env.TERMDOOR_CENTER_DATA || path.resolve(__dirname, '../../data/termdoor-center');
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const file = path.join(dataDir, 'store.json');
const db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { users: [], devices: [], invites: [] };
function save() {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const random = () => crypto.randomBytes(32).toString('hex');
const scrypt = promisify(crypto.scrypt);
async function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
async function passwordMatches(password, hash) {
  const result = await passwordHash(password, hash.split(':')[0]);
  return crypto.timingSafeEqual(Buffer.from(result), Buffer.from(hash));
}
function secretMatches(candidate, hash) {
  return typeof candidate === 'string' && digest(candidate) === hash;
}
module.exports = { db, save, digest, random, passwordHash, passwordMatches, secretMatches, dataDir };
