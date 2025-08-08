import mongoose from 'mongoose';

export const connectMongo = async (uri: string) => {
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};
