const { pool } = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM data_records';
    let countQuery = 'SELECT COUNT(*) FROM data_records';
    let queryParams = [];
    
    if (search) {
      query += ' WHERE name ILIKE $1 OR description ILIKE $1';
      countQuery += ' WHERE name ILIKE $1 OR description ILIKE $1';
      queryParams.push(`%${search}%`);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);
    queryParams.push(limit, offset);
    
    const [dataResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, search ? [`%${search}%`] : [])
    ]);
    
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      data: dataResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching data records:', error);
    res.status(500).json({ error: 'Failed to fetch data records' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM data_records WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching data record:', error);
    res.status(500).json({ error: 'Failed to fetch data record' });
  }
};

const create = async (req, res) => {
  try {
    const { name, description, data } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const result = await pool.query(
      'INSERT INTO data_records (name, description, data) VALUES ($1, $2, $3) RETURNING *',
      [name, description, data ? JSON.stringify(data) : null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating data record:', error);
    res.status(500).json({ error: 'Failed to create data record' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, data } = req.body;
    
    const result = await pool.query(
      'UPDATE data_records SET name = COALESCE($1, name), description = COALESCE($2, description), data = COALESCE($3, data), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [name, description, data ? JSON.stringify(data) : null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating data record:', error);
    res.status(500).json({ error: 'Failed to update data record' });
  }
};

const deleteById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM data_records WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data record not found' });
    }
    
    res.json({ message: 'Data record deleted successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error deleting data record:', error);
    res.status(500).json({ error: 'Failed to delete data record' });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteById
};
