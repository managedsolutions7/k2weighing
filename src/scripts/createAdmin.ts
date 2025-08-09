// scripts/createAdmin.ts
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/user.model';

dotenv.config();

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DATABASE_URL as string);
    console.log('✅ Connected to MongoDB');

    const username = 'bhupesh003';
    const plainPassword = 'Bhupesh@2003'; // Change this before production!
    const name = 'System Admin';
    const empId = 'EMP-ADMIN-001';
    const role = 'admin';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ username });
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists.');
      process.exit(0);
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Create the admin
    const admin = await User.create({
      username,
      password: hashedPassword,
      name,
      empId,
      role,
      isActive: true,
      plantId: null, // admin may not be bound to a plant
    });

    console.log('✅ Admin created successfully:', admin);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();
