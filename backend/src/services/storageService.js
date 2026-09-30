const fileStore = require("./fileStore");

class StorageService {
  // Uploads are already stored by the upload middleware; this describes one.
  // `file.path` is its storage key ("uploads/<folder>/<file>").
  async uploadFile(file) {
    const key = fileStore.toKey(file.path);
    if (!key) {
      throw new Error("Uploaded file has no storage key.");
    }

    return {
      originalName: file.originalname,
      fileName: file.filename || key.split("/").pop(),
      filePath: key,
      mimeType: file.mimetype,
      fileSize: file.size,
      url: fileStore.publicUrl(key),
    };
  }

  async deleteFile(filePath) {
    return fileStore.remove(filePath);
  }
}

module.exports = new StorageService();
