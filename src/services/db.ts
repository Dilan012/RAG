import dns from "node:dns";
import mongoose from "mongoose";

// Some Windows setups have an IPv6-only DNS server configured at the OS level. Node's
// resolver can fail SRV lookups (used by mongodb+srv:// URIs) against those even though
// the OS's own resolver handles them fine.

dns.setServers(["8.8.8.8", "1.1.1.1"]);

let connectionPromise: Promise<typeof mongoose> | null = null;

export function connectToDatabase(): Promise<typeof mongoose> {
  if (!connectionPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    connectionPromise = mongoose.connect(uri);
  }
  return connectionPromise;
}
