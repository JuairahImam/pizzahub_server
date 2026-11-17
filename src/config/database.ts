
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined");
}

const client = new MongoClient(MONGODB_URI);

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return client.db("pizzahub");
  }

  await client.connect();

  isConnected = true;

  console.log("MongoDB connected successfully!");

  return client.db("pizzahub");
};

export default connectDB;
