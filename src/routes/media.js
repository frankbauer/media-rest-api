const express = require('express');
const { upload, uploadMedia, getMedia, deleteMedia, listMedia } = require('../controllers/mediaController');

const router = express.Router();

router.post('/upload', upload.single('file'), uploadMedia);
router.get('/', listMedia);
router.get('/:id', getMedia);
router.delete('/:id', deleteMedia);

module.exports = router;
