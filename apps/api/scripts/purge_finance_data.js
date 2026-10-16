const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Read MONGODB_URI from apps/api/.env or .env
function getMongoUri() {
  const envPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^MONGODB_URI=(.+)$/m);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }

  return process.env.MONGODB_URI || 'mongodb+srv://bhandariakshit137_db_user:akshitbhandari@cluster0.g3m2lth.mongodb.net/blood_bank?retryWrites=true&w=majority&appName=Cluster0';
}

async function purgeFinanceData() {
  const uri = getMongoUri();
  console.log('Connecting to MongoDB...');
  console.log('URI:', uri.replace(/:[^:]*@/, ':****@'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected successfully to database:', mongoose.connection.name || 'default');

  const db = mongoose.connection.db;

  const collectionsToPurge = [
    { name: 'expenses', label: 'Expenses (Expenditure Management)' },
    { name: 'payments', label: 'Disbursement Vouchers & Payments' },
    { name: 'blood_issue_invoices', label: 'Blood Issue Invoices' },
    { name: 'blood_issue_collections', label: 'Blood Issue Payment Collections' },
    { name: 'payroll_runs', label: 'Monthly Payroll Batch Runs' },
    { name: 'salary_slips', label: 'Employee Salary Slips' },
    { name: 'salary_disbursements', label: 'Salary Disbursements' },
  ];

  console.log('\n--- PURGING FINANCE DATA ---');
  const results = [];

  for (const item of collectionsToPurge) {
    try {
      const col = db.collection(item.name);
      const countBefore = await col.countDocuments();
      const deleteResult = await col.deleteMany({});
      results.push({
        collection: item.name,
        label: item.label,
        countBefore,
        deletedCount: deleteResult.deletedCount,
      });
      console.log(`[OK] ${item.label} (${item.name}): Deleted ${deleteResult.deletedCount} of ${countBefore} records.`);
    } catch (err) {
      console.error(`[ERROR] Failed to purge ${item.name}:`, err.message);
      results.push({
        collection: item.name,
        label: item.label,
        error: err.message,
      });
    }
  }

  console.log('\n--- PURGE SUMMARY ---');
  console.table(results);
  console.log('\nAll finance data has been successfully cleared for fresh testing!');

  await mongoose.disconnect();
}

purgeFinanceData().catch((err) => {
  console.error('\nFatal error during purge:', err.message);
  process.exit(1);
});
