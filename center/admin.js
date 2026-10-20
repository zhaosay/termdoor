const fs = require('fs');
const path = require('path');
const { db, save, random, passwordHash, dataDir } = require('./store');

async function main() {
  const [action, username] = process.argv.slice(2);
  if (action !== 'create-user' || !/^[a-zA-Z0-9_-]{3,40}$/.test(username || '')) {
    throw new Error('Usage: node center/admin.js create-user USERNAME');
  }
  if (db.users.some((u) => u.username === username)) throw new Error('User already exists');
  const password = random().slice(0, 24);
  db.users.push({ id: random().slice(0, 24), username, password: await passwordHash(password) });
  save();
  const credentials = path.join(dataDir, `${username}-credentials.txt`);
  fs.writeFileSync(credentials, `URL: ${process.env.TERMDOOR_CENTER_URL || 'https://center.example.com'}\nUsername: ${username}\nPassword: ${password}\n`, { mode: 0o600 });
  console.log(`Created user. Credentials saved to ${credentials}`);
}
main().catch((err) => { console.error(err.message); process.exitCode = 1; });
