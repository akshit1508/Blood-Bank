const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

let mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  const envPath = path.resolve(__dirname, '../apps/api/.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^MONGODB_URI=(.*)$/m);
    if (match) mongoUri = match[1].trim();
  }
}

if (!mongoUri) {
  console.error('Error: MONGODB_URI not found in apps/api/.env');
  process.exit(1);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

const AdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    fullName: { type: String, required: true },
    designation: { type: String, default: 'Blood Bank Officer' },
    role: { type: String, default: 'ADMIN' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { collection: 'admins', timestamps: true }
);

const AdminModel = mongoose.model('Admin', AdminSchema);

async function main() {
  await mongoose.connect(mongoUri);

  const command = process.argv[2] || 'list';

  if (command === 'list') {
    const admins = await AdminModel.find({}).lean();
    console.log('\n--- Current Registered Admins in MongoDB (admins collection) ---');
    if (admins.length === 0) {
      console.log('No admins found in database. You can add one using: node scripts/manage-admin.js set <email> <password> <name>');
    } else {
      admins.forEach((a, idx) => {
        console.log((idx + 1) + '. [' + a.role + '] ' + a.fullName + ' <' + a.email + '> (' + a.designation + ') - Active: ' + a.isActive);
      });
    }
    console.log('----------------------------------------------------------------\n');
  } else if (command === 'set') {
    const email = process.argv[3];
    const password = process.argv[4];
    const fullName = process.argv[5] || 'Blood Bank Administrator';
    const designation = process.argv[6] || 'Chief Administrator';

    if (!email || !password) {
      console.error('Usage: node scripts/manage-admin.js set <email> <password> [fullName] [designation]');
      process.exit(1);
    }

    const { hash, salt } = hashPassword(password);
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await AdminModel.findOne({ email: normalizedEmail });
    if (existing) {
      existing.passwordHash = hash;
      existing.passwordSalt = salt;
      existing.fullName = fullName;
      existing.designation = designation;
      existing.isActive = true;
      await existing.save();
      console.log('\nSUCCESS: Admin ' + normalizedEmail + ' updated directly in MongoDB database.');
    } else {
      await AdminModel.create({
        email: normalizedEmail,
        passwordHash: hash,
        passwordSalt: salt,
        fullName,
        designation,
        role: 'SUPER_ADMIN',
        isActive: true,
      });
      console.log('\nSUCCESS: New Admin ' + normalizedEmail + ' created directly in MongoDB database.');
    }
  } else {
    console.log('Unknown command. Use list or set.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Database operation failed:', err.message);
  process.exit(1);
});
