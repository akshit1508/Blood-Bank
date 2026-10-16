const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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
        let uri = match[1].trim();
        // Ensure database points to 'test' or specified DB
        if (uri.startsWith('mongodb+srv://') && !uri.includes('.mongodb.net/')) {
          uri = uri.replace('.mongodb.net', '.mongodb.net/test');
        } else if (uri.startsWith('mongodb+srv://') && uri.includes('.mongodb.net/?')) {
          uri = uri.replace('.mongodb.net/?', '.mongodb.net/test?');
        }
        return uri;
      }
    }
  }

  return process.env.MONGODB_URI || 'mongodb+srv://bhandariakshit137_db_user:akshitbhandari@cluster0.g3m2lth.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
}

async function purgeAllPlatformData() {
  const uri = getMongoUri();
  console.log('Connecting to MongoDB...');
  console.log('URI:', uri.replace(/:[^:]*@/, ':****@'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  console.log('Connected successfully to database:', db.databaseName);

  // Collections to completely wipe clean across all roles
  const collectionsToWipe = [
    // 1. Testing / Laboratory
    { name: 'blood_testing', role: 'Testing / Lab', label: 'Laboratory Blood Testing Records' },
    { name: 'blood_units', role: 'Testing / Lab & Inventory', label: 'Blood Units (Quarantine & Tested)' },

    // 2. Receptionist Portal
    { name: 'donors', role: 'Receptionist', label: 'Registered Blood Donors' },
    { name: 'donations', role: 'Receptionist', label: 'Donor Blood Donations' },
    { name: 'blood_requests', role: 'Receptionist & Admin', label: 'Hospital Blood Requests' },
    { name: 'reservations', role: 'Receptionist & Admin', label: 'Reserved Blood Units' },
    { name: 'blood_issues', role: 'Receptionist & Billing', label: 'Issued Blood Dispatches' },

    // 3. Admin & Inventory
    { name: 'inventory', role: 'Admin', label: 'Active Blood Inventory Units' },
    { name: 'inventory_history', role: 'Admin', label: 'Inventory Transaction Ledger History' },
    { name: 'blood_acquisitions', role: 'Admin', label: 'Blood Acquisition Batches' },
    { name: 'vendors', role: 'Admin & Finance', label: 'Suppliers & Vendors' },
    { name: 'campaigns', role: 'Admin', label: 'Donation Camps / Campaigns' },
    { name: 'campaign_budget_revisions', role: 'Admin', label: 'Campaign Budget Revisions' },
    { name: 'volunteers', role: 'Admin', label: 'Registered Volunteers' },
    { name: 'campaign_volunteers', role: 'Admin', label: 'Campaign Volunteer Assignments' },

    // 4. Super Admin & Finance / Payroll
    { name: 'expenses', role: 'Super Admin Finance', label: 'Expenditures & Bills' },
    { name: 'payments', role: 'Super Admin Finance', label: 'Disbursement Vouchers & Payments' },
    { name: 'blood_issue_invoices', role: 'Super Admin Finance', label: 'Patient / Hospital Billing Invoices' },
    { name: 'blood_issue_collections', role: 'Super Admin Finance', label: 'Billing Payment Collections' },
    { name: 'payroll_runs', role: 'Super Admin Payroll', label: 'Monthly Payroll Batch Runs' },
    { name: 'salary_slips', role: 'Super Admin Payroll', label: 'Employee Salary Slips' },
    { name: 'salary_disbursements', role: 'Super Admin Payroll', label: 'Salary Disbursements' },
    { name: 'employees', role: 'Super Admin Payroll', label: 'Registered Staff / Employees' },
    { name: 'salary_structures', role: 'Super Admin Payroll', label: 'Employee Salary Structures' },
    { name: 'notifications', role: 'System', label: 'System Notifications' },
  ];

  console.log('\n======================================================');
  console.log('PURGING ALL TEST/OPERATIONAL DATA ACROSS ALL ROLES');
  console.log('(Preserving user credentials in `admins` and pricing master)');
  console.log('======================================================\n');

  const results = [];

  for (const item of collectionsToWipe) {
    try {
      const col = db.collection(item.name);
      const countBefore = await col.countDocuments();
      const deleteResult = await col.deleteMany({});
      results.push({
        Role: item.role,
        Collection: item.name,
        'Before Count': countBefore,
        'Deleted Count': deleteResult.deletedCount,
        Status: 'CLEARED',
      });
      console.log(`[CLEARED] ${item.role} -> ${item.name}: Deleted ${deleteResult.deletedCount} of ${countBefore}`);
    } catch (err) {
      results.push({
        Role: item.role,
        Collection: item.name,
        'Before Count': 'ERR',
        'Deleted Count': 0,
        Status: err.message,
      });
      console.error(`[ERROR] Failed to purge ${item.name}:`, err.message);
    }
  }

  console.log('\n--- VERIFYING PRESERVED ACCOUNTS ---');
  const adminsCol = db.collection('admins');
  const adminUsers = await adminsCol.find({}).toArray();
  console.log(`Preserved ${adminUsers.length} Admin/User Accounts:`);
  for (const a of adminUsers) {
    console.log(`  - ${a.email} (${a.role})`);
  }

  console.log('\n--- PURGE REPORT ---');
  console.table(results);

  console.log('\n>>> All website data across Testing, Receptionist, Admin, and Super Admin has been COMPLETELY REMOVED! <<<');

  await mongoose.disconnect();
}

purgeAllPlatformData().catch((err) => {
  console.error('\nFatal error during purge:', err);
  process.exit(1);
});
