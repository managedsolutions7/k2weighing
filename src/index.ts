import express from "express";
import dotenv from "dotenv";
import { connectMongo } from "./config/mongo";
import { redisClient } from "./config/redis";
import swaggerUi from "swagger-ui-express";
import { swaggerDocs } from "./swagger";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Connect MongoDB and Redis at the start of your server:
connectMongo(process.env.MONGO_URI as string);
redisClient.connect(); // redisClient.connect() returns a promise in recent versions

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
