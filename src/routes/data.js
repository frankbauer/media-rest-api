const express = require('express');
const { getAll, getById, create, update, deleteById } = require('../controllers/dataController');

const router = express.Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', deleteById);

module.exports = router;
