const mongoose = require('mongoose');
const DanhMucPhongBan = require('../models/DanhMucPhongBan');
require('dotenv').config();

// truong_phong_did should be a Manager, not Department Head
const defaultDepartments = [
  {
    phong_ban_id: '3d868e1f-2f53-4819-8ef6-b4af62fbb7b2', // Existing department
    ten_phong_ban: 'Phòng Kinh Doanh',
    mo_ta: 'Phòng kinh doanh và marketing',
    truong_phong_did: '01926d2c-a8d1-4c3e-8f2a-1b3c4d5e6f7b' // Manager user as department head
  }
];

async function seedDepartments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://nguyenhuy4435:nhathuy812@clusterweb3.5tqfgfq.mongodb.net/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');
    console.log('Database name:', mongoose.connection.db.databaseName);

    // Clear existing departments
    await DanhMucPhongBan.deleteMany({});
    console.log('Cleared existing departments');

    // Insert default departments
    const insertedDepartments = await DanhMucPhongBan.insertMany(defaultDepartments);
    console.log(`Seeded ${insertedDepartments.length} departments successfully`);

    // Display inserted departments
    console.log('\nInserted Departments:');
    insertedDepartments.forEach(dept => {
      console.log(`- ${dept.ten_phong_ban} (${dept.phong_ban_id})`);
    });

    console.log('\nSeeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding departments:', error);
    process.exit(1);
  }
}

// Run the seeder
seedDepartments();
