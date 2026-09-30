// Stores the listed string paths encrypted (utils/cryptoUtil, "enc:" prefix)
// and hands them to the application decrypted, for documents and lean results
// alike. Encryption is randomised, so values are compared and validated in
// plain text and only encrypted on their way to the database.
//
//   schema.plugin(encryptedPaths, { paths: ["upiId", "bankDetails.accountNumber"] });

const { encrypt, decrypt } = require("../../utils/cryptoUtil");

const getPath = (object, path) =>
  path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), object);

function setPath(object, path, value) {
  const keys = path.split(".");
  let target = object;
  for (const key of keys.slice(0, -1)) {
    if (target[key] === null || typeof target[key] !== "object") return;
    target = target[key];
  }
  target[keys[keys.length - 1]] = value;
}

function transform(object, paths, fn) {
  if (!object || typeof object !== "object") return;
  for (const path of paths) {
    const current = getPath(object, path);
    if (typeof current === "string" && current) setPath(object, path, fn(current));
  }
}

// Applies `fn` to the encrypted paths wherever an update can set them:
// top level or under $set / $setOnInsert, as a full path ("bankDetails.accountNumber")
// or inside a parent object ({ bankDetails: { accountNumber } }).
function transformUpdate(update, paths, fn) {
  if (!update || typeof update !== "object" || Array.isArray(update)) return;
  const targets = [update, update.$set, update.$setOnInsert].filter((t) => t && typeof t === "object");
  for (const target of targets) {
    for (const path of paths) {
      if (typeof target[path] === "string" && target[path]) {
        target[path] = fn(target[path]);
        continue;
      }
      const [head, ...rest] = path.split(".");
      if (rest.length && target[head] && typeof target[head] === "object") {
        transform(target[head], [rest.join(".")], fn);
      }
    }
  }
}

function encryptedPaths(schema, { paths = [] } = {}) {
  if (!paths.length) return;

  const decryptDoc = (doc) => {
    if (!doc) return;
    if (typeof doc.get === "function" && typeof doc.set === "function" && doc.$__) {
      for (const path of paths) {
        const value = doc.get(path);
        if (typeof value === "string" && value.startsWith("enc:")) {
          doc.set(path, decrypt(value), { strict: false });
          // Reading a stored value is not a change to save.
          doc.unmarkModified(path);
        }
      }
    } else {
      transform(doc, paths, decrypt);
    }
  };

  schema.pre("save", function encryptOnSave() {
    for (const path of paths) {
      const value = this.get(path);
      if (typeof value === "string" && value) this.set(path, encrypt(value));
    }
  });
  schema.post("save", function decryptAfterSave(doc) {
    decryptDoc(doc);
  });

  schema.pre("insertMany", function encryptOnInsertMany(next, docs) {
    for (const doc of Array.isArray(docs) ? docs : [docs]) {
      if (doc && typeof doc.get === "function") {
        for (const path of paths) {
          const value = doc.get(path);
          if (typeof value === "string" && value) doc.set(path, encrypt(value));
        }
      } else {
        transform(doc, paths, encrypt);
      }
    }
    next();
  });
  schema.post("insertMany", function decryptAfterInsertMany(docs) {
    for (const doc of docs || []) decryptDoc(doc);
  });

  for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
    schema.pre(op, function encryptUpdate() {
      transformUpdate(this.getUpdate(), paths, encrypt);
    });
  }

  for (const op of ["find", "findOne", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace"]) {
    schema.post(op, function decryptResult(result) {
      for (const doc of Array.isArray(result) ? result : [result]) decryptDoc(doc);
    });
  }
}

module.exports = encryptedPaths;
