import vehicleModel from '../../models/vehicle.model';
import mongoose from 'mongoose';

// Replace with your MongoDB connection string
const MONGO_URI = '';

async function fixVehicleDuplicates() {
  await mongoose.connect(MONGO_URI);

  // Drop old unique index on vehicleNumber if it exists
  try {
    await vehicleModel.collection.dropIndex('vehicleNumber_1');
    console.log('Dropped old unique index: vehicleNumber_1');
  } catch (err: any) {
    if (err.code === 27) {
      console.log('Index vehicleNumber_1 does not exist, skipping drop.');
    } else {
      console.error('Error dropping index:', err);
    }
  }

  // Ensure compound unique index on { vehicleNumber, vehicleType }
  try {
    await vehicleModel.collection.createIndex(
      { vehicleNumber: 1, vehicleType: 1 },
      { unique: true },
    );
    console.log('Created compound unique index: { vehicleNumber, vehicleType }');
  } catch (err) {
    console.error('Error creating compound index:', err);
  }

  // Find all vehicles grouped by vehicleNumber and collect duplicates
  const vehicles = await vehicleModel.aggregate([
    {
      $group: {
        _id: '$vehicleNumber',
        types: { $addToSet: '$vehicleType' },
        docs: {
          $push: { _id: '$_id', vehicleType: '$vehicleType', vehicleNumber: '$vehicleNumber' },
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 }, _id: { $ne: null } } },
  ]);

  let updatedCount = 0;
  for (const group of vehicles) {
    const typeMap = new Map<string, boolean>();
    for (const doc of group.docs) {
      const key = `${doc.vehicleType}`;
      if (typeMap.has(key)) {
        // Duplicate found, update vehicleNumber to make it unique
        const newVehicleNumber = `${doc.vehicleNumber}-${doc.vehicleType}`;
        await vehicleModel.updateOne(
          { _id: doc._id },
          { $set: { vehicleNumber: newVehicleNumber } },
        );
        updatedCount++;
        console.log(`Updated vehicle ${doc._id}: vehicleNumber -> ${newVehicleNumber}`);
      } else {
        typeMap.set(key, true);
      }
    }
  }

  console.log(`Vehicle duplicates fixed. Total updated: ${updatedCount}`);
  await mongoose.disconnect();
}

fixVehicleDuplicates().catch((err) => {
  console.error('Error fixing vehicle duplicates:', err);
  process.exit(1);
});
