const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const port = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 连接本地 MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',          // 改成 root
  password: 'haifahaidiao', // 改成你自己的 MySQL root 密码
  database: 'seafishing'
});

db.connect((err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err);
    return;
  }
  console.log('✅ 数据库连接成功！');
});

// 示例接口：获取所有钓点
app.get('/api/spots', (req, res) => {
  db.query('SELECT * FROM fishing_spots', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.listen(port, () => {
  console.log(`🚀 后端服务运行在 http://localhost:${port}`);
});