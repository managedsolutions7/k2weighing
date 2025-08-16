import mongoose from 'mongoose';
import Entry from '../../models/entry.model';

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/k2weigh';
  await mongoose.connect(uri);
  const bulk = Entry.collection.initializeUnorderedBulkOp();
  const filter = {
    $or: [
      { isReviewed: { $exists: false } },
      { reviewedBy: { $exists: false } },
      { reviewedAt: { $exists: false } },
      { reviewNotes: { $exists: false } },
      { flagged: { $exists: false } },
      { flagReason: { $exists: false } },
      { manualWeight: { $exists: false } },
    ],
  } as any;
  const cursor = Entry.find(filter).cursor();
  let count = 0;
  for await (const doc of cursor) {
    bulk.find({ _id: doc._id }).updateOne({
      $set: {
        isReviewed: false,
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        flagged: false,
        flagReason: null,
        manualWeight: false,
      },
    });
    count++;
    if (count % 1000 === 0) {
      await bulk.execute();
    }
  }
  if (count % 1000 !== 0) {
    await bulk.execute();
  }
  console.log(`Migration complete. Updated ${count} entries.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
