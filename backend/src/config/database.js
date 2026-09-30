// MongoDB Atlas connection. MONGODB_URI is the only source of the address and
// credentials; there is no default database. MongoDB Compass is only a tool
// for looking at the same database, it is never configured here.
//
// connectDatabase() is idempotent: concurrent and repeated calls share one
// connection. The driver reconnects on its own after network blips; the
// events below only log them.
//
// Connection pool and index behaviour are controlled by config/db.js, which
// reads from environment variables (no hardcoded production values).

const mongoose = require("mongoose");
const { required } = require("./env");
const dbConfig = require("./db");

let connecting = null;

// Where we are connected, for logs. Never includes the username or password.
function describe(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)\/([^?]*)/i.exec(uri);
  return match ? { host: match[1], database: decodeURIComponent(match[2]) } : { host: "?", database: "" };
}

function readUri() {
  const uri = required("MONGODB_URI");
  if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
    throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://.");
  }
  // Without a database name the driver silently uses "test"; require it so
  // each environment names its own database explicitly.
  if (!describe(uri).database) {
    throw new Error(
      "MONGODB_URI must name the database, e.g. mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority."
    );
  }
  return uri;
}

let listenersAttached = false;
function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  const { connection } = mongoose;
  connection.on("disconnected", () => console.warn("[database] disconnected from MongoDB"));
  connection.on("reconnected", () => console.log("[database] reconnected to MongoDB"));
  connection.on("error", (error) => console.error("[database] MongoDB error:", error.message));
}

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connecting) {
    const uri = readUri();
    const { host, database } = describe(uri);
    // Keep filter conditions on paths outside a schema instead of dropping
    // them: dropping would widen the query (and an access check with it).
    mongoose.set("strictQuery", false);
    attachListeners();
    connecting = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: dbConfig.serverSelectionTimeoutMS,
        autoIndex: dbConfig.autoIndex,
        maxPoolSize: dbConfig.maxPoolSize,
        minPoolSize: dbConfig.minPoolSize,
        maxIdleTimeMS: dbConfig.maxIdleTimeMS,
        socketTimeoutMS: dbConfig.socketTimeoutMS,
      })
      .then(async () => {
        // Make unique indexes exist before the first request relies on them.
        await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
        console.log(`✅ MongoDB connected (${host}/${database})`);
        return mongoose.connection;
      })
      .catch((error) => {
        connecting = null;
        throw error;
      });
  }
  return connecting;
}

async function disconnectDatabase() {
  connecting = null;
  await mongoose.disconnect();
}

// Round trip to the server, for the readiness check.
async function pingDatabase() {
  if (mongoose.connection.readyState !== 1) throw new Error("not connected");
  await mongoose.connection.db.admin().command({ ping: 1 });
}

const isDatabaseConnected = () => mongoose.connection.readyState === 1;

module.exports = { connectDatabase, disconnectDatabase, pingDatabase, isDatabaseConnected, describe };
