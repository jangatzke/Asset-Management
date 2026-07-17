import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function testDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export default prisma;
