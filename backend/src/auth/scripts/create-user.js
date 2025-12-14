// JavaScript version of create-user script
// Can be run with: node src/auth/scripts/create-user.js <username> <password>

const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');

// Import the User entity (we'll need to compile it or use a workaround)
// For now, we'll define it inline
const { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } = require('typeorm');

// Define User entity inline
class User {
  constructor() {
    this.id = undefined;
    this.username = undefined;
    this.password = undefined;
    this.createdAt = undefined;
  }
}

async function createUser() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error('Usage: node create-user.js <username> <password>');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'countfolks',
    entities: [],
    synchronize: false,
  });

  await dataSource.initialize();

  // Use raw SQL to create user
  const userRepository = dataSource.manager;

  // Check if user exists
  const existingUser = await userRepository.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );

  if (existingUser.length > 0) {
    console.error(`User "${username}" already exists!`);
    await dataSource.destroy();
    process.exit(1);
  }

  // Create user
  const hashedPassword = await bcrypt.hash(password, 10);
  await userRepository.query(
    'INSERT INTO users (username, password, "createdAt") VALUES ($1, $2, NOW())',
    [username, hashedPassword]
  );

  console.log(`User "${username}" created successfully!`);

  await dataSource.destroy();
}

createUser().catch((error) => {
  console.error('Error creating user:', error);
  process.exit(1);
});

