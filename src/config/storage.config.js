const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// Base upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Create upload directories if they don't exist
const directories = {
  scripts: path.join(UPLOAD_DIR, 'scripts'),
  avatars: path.join(UPLOAD_DIR, 'avatars'),
  exports: path.join(UPLOAD_DIR, 'exports'),
  temp: path.join(UPLOAD_DIR, 'temp')
};

// Initialize directories
async function initializeDirectories() {
  for (const [key, dir] of Object.entries(directories)) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Directory created: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error.message);
    }
  }
}

initializeDirectories();

// Multer storage configuration for scripts
const scriptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, directories.scripts);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  }
});

// File filter for scripts
const scriptFileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'text/plain', 'application/octet-stream'];
  const allowedExts = ['.pdf', '.fdx', '.fountain', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, FDX, Fountain, and TXT files are allowed.'), false);
  }
};

// Multer upload for scripts
const uploadScript = multer({
  storage: scriptStorage,
  fileFilter: scriptFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

// Avatar storage configuration
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, directories.avatars);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueId}${ext}`);
  }
});

// Avatar file filter
const avatarFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// Multer upload for avatars
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * Get file URL (for serving files)
 */
function getFileUrl(filename, type = 'scripts') {
  return `${process.env.API_URL}/uploads/${type}/${filename}`;
}

/**
 * Delete file from local storage
 */
async function deleteFile(filename, type = 'scripts') {
  try {
    const filePath = path.join(directories[type], filename);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error(`Error deleting file: ${error.message}`);
    return false;
  }
}

/**
 * Get file path
 */
function getFilePath(filename, type = 'scripts') {
  return path.join(directories[type], filename);
}

/**
 * Check if file exists
 */
async function fileExists(filename, type = 'scripts') {
  try {
    const filePath = path.join(directories[type], filename);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  uploadScript,
  uploadAvatar,
  directories,
  getFileUrl,
  deleteFile,
  getFilePath,
  fileExists
};
