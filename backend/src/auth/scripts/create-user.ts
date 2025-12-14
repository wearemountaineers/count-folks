import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

// This script can be run to create an initial user
// Usage: ts-node src/auth/scripts/create-user.ts <username> <password>

async function createUser() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error('Usage: ts-node create-user.ts <username> <password>');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'countfolks',
    entities: [User],
    synchronize: false,
  });

  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);

  // Check if user exists
  const existingUser = await userRepository.findOne({ where: { username } });
  if (existingUser) {
    console.error(`User "${username}" already exists!`);
    await dataSource.destroy();
    process.exit(1);
  }

  // Create user
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = userRepository.create({
    username,
    password: hashedPassword,
  });

  await userRepository.save(user);
  console.log(`User "${username}" created successfully!`);

  await dataSource.destroy();
}

createUser().catch((error) => {
  console.error('Error creating user:', error);
  process.exit(1);
});

