const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const path = require('path');

const app = express();
const db = new sqlite3.Database('warghami_store.db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 
app.set('view engine', 'ejs'); 

app.use(session({
    secret: 'warghami_ultra_luxury_secret_2026',
    resave: false,
    saveUninitialized: true
}));

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
            barcode TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT,
            size TEXT, color TEXT, cost_price REAL, sale_price REAL,
            old_price REAL, quantity INTEGER, image_url TEXT,
            fabric TEXT, embroidery TEXT
        )
    `);
    db.run(`CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY, text TEXT)`);

    db.get("SELECT COUNT(*) AS count FROM announcements", (err, row) => {
        if (!err && row && row.count === 0) {
            db.run("INSERT INTO announcements (id, text) VALUES (1, '✨ تشكيلات حصرية فاخرة من بوتيك الورغمي - متوفر شحن فوري لجميع مدن ليبيا خلال 36 ساعة 🚀 ✨')");
        }
    });

    db.get("SELECT COUNT(*) AS count FROM inventory", (err, row) => {
        if (!err && row && row.count === 0) {
            const insertProd = db.prepare(`INSERT INTO inventory (barcode, name, category, size, color, cost_price, sale_price, old_price, quantity, image_url, fabric, embroidery) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            insertProd.run('BAR-001', 'قفطان ملكي مغربي فاخر بلون زمردي', 'قفاطين مغربية', 'M / L', 'أخضر زمردي', 150, 350, 450, 5, '', 'حرير طبيعي', 'سفيفة وتطريز يدوي معلم');
            insertProd.run('BAR-002', 'فستان مخمل عصري بتصميم فريد', 'تصاميم عصرية', 'S / M', 'أسود ملكي', 100, 240, 290, 8, '', 'مخمل ناعم', 'تطريز خفيف عالي الجودة');
            insertProd.run('BAR-003', 'طقم العيد الحصري من بوتيك الورغمي', 'مجموعات العيد', 'متنوع', 'أبيض كريمي', 200, 420, 500, 3, '', 'كتان إيطالي فاخر', 'شغل يدوي خاص بقاجوم');
            insertProd.finalize();
        }
    });
});

app.get('/', (req, res) => {
    const cat = req.query.cat || 'all';
    let query = "SELECT * FROM inventory";
    let params = [];
    if (cat === 'moroccan') { query = "SELECT * FROM inventory WHERE category=?"; params = ['قفاطين مغربية']; }
    else if (cat === 'modern') { query = "SELECT * FROM inventory WHERE category=?"; params = ['تصاميم عصرية']; }
    else if (cat === 'eid') { query = "SELECT * FROM inventory WHERE category=?"; params = ['مجموعات العيد']; }

    db.all(query, params, (err, rows) => {
        if (err) { res.send("حدث خطأ في قراءة البيانات"); } 
        else { res.render('index', { items: rows || [] }); }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n✅ السيرفر شغال بنجاح!`);
});
