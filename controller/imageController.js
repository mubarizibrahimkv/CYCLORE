const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadfile = path.join(process.cwd(),'uploads');

if (!fs.existsSync(uploadfile)) {
  fs.mkdirSync(uploadfile, { recursive: true });
}
  

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadfile); // specify the folder for file uploads
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // create a unique filename
    }
});

// File filter (optional)
const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Create the upload middleware
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: fileFilter
});

module.exports = upload;