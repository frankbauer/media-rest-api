const multer = require('multer');
const { Client } = require('minio');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { pool } = require('../config/database');

const fileSizeLimit = (parseInt(process.env.MAX_MEDIA_SIZE) || 100) * 1024 * 1024; // 100MB

// Configure MinIO client
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: false,
  accessKey: process.env.MINIO_USER || 'weaver_admin',
  secretKey: process.env.MINIO_SECRET_PASSWORD || 'weaver_admin_password'
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'media-files';

// Initialize MinIO bucket
async function initMinIO() {
  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME);
      console.log(`MinIO bucket '${BUCKET_NAME}' created`);
    }
  } catch (error) {
    console.error('MinIO initialization error:', error);
  }
}

// Initialize on module load
initMinIO();

// Configure multer for memory storage. 
// For larger deployments this should go to a temp folder
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: fileSizeLimit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos based on file extension only
    // TODO: !!! Proper file content validation should be implemented before the files are
    // uploaded to the MinIO bucket
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|mp4|avi|mov|wmv|flv|webm|mkv)$/i;
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const extname = allowedExtensions.test(fileExtension);
    
    if (extname) {
      return cb(null, true);
    } else {
      console.log('File extension not allowed:', file.originalname);
      console.log('File extension:', fileExtension);
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileId = uuidv4();
    const fileExtension = path.extname(req.file.originalname);
    const objectKey = `${fileId}${fileExtension}`;

    // The mime type is sent from the client and could be maliciously set
    // TODO: Implement proper file content validation and derive the
    // corect MIME type from the file content

    // Send to MinIO
    await minioClient.putObject(
      BUCKET_NAME,
      objectKey,
      req.file.buffer,
      req.file.size,
      {
        'Content-Type': req.file.mimetype,
        'X-Original-Name': req.file.originalname
      }
    );
    
    // Save metadata to database
    const result = await pool.query(
      `INSERT INTO media_files (id, filename, original_name, mime_type, size, bucket, object_key) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [fileId, objectKey, req.file.originalname, req.file.mimetype, req.file.size, BUCKET_NAME, objectKey]
    );

    //There could be orphaned data in MinIO if the database could not be updated
    //TODO: delete file from storage bucket in case the insert failed
    
    res.status(201).json({
      message: 'File uploaded successfully',
      file: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

const getMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find file in Database
    const result = await pool.query('SELECT * FROM media_files WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    const fileData = result.rows[0];
    
    // Read the file contents from MinIO
    const stream = await minioClient.getObject(BUCKET_NAME, fileData.object_key);
    
    // The Mime type is stored in the database as it was set during upload
    // this means it could be malicious (as there are no checks in place)
    res.set({
      'Content-Type': fileData.mime_type,
      'Content-Disposition': `inline; filename="${fileData.original_name}"`,
      'Cache-Control': 'public, max-age=31536000'
    });
    
    stream.pipe(res);
  } catch (error) {
    console.error('Error retrieving file:', error);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

const listMedia = async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM media_files';
    let countQuery = 'SELECT COUNT(*) FROM media_files';
    let queryParams = [];
    
    if (type) {
      const typeFilter = type === 'image' ? 'image/%' : type === 'video' ? 'video/%' : null;
      if (typeFilter) {
        query += ' WHERE mime_type LIKE $1';
        countQuery += ' WHERE mime_type LIKE $1';
        queryParams.push(typeFilter);
      }
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);
    queryParams.push(limit, offset);
    
    const [dataResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, type ? [queryParams[0]] : [])
    ]);
    
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      files: dataResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error listing media files:', error);
    res.status(500).json({ error: 'Failed to list media files' });
  }
};

const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
     // Find file in Database
    const result = await pool.query('SELECT * FROM media_files WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const fileData = result.rows[0];
    
    // Delete from MinIO
    await minioClient.removeObject(BUCKET_NAME, fileData.object_key);
    
    // Delete from database
    await pool.query('DELETE FROM media_files WHERE id = $1', [id]);

    // There could be orphaned data in the Database if the delete fails    
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

module.exports = {
  upload,
  uploadMedia,
  getMedia,
  listMedia,
  deleteMedia
};
