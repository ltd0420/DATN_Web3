const multer = require('multer');
const path = require('path');

// Memory storage for JSON files (we'll parse them directly)
const jsonUpload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit for JSON files
  },
  fileFilter: (req, file, cb) => {
    // Only accept JSON files
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  }
});

module.exports = {
  jsonUpload
};

