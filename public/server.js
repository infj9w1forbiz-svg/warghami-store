// ==========================================
// 🚀 سيرفر متجر الورغمي - Node.js & Express
// ==========================================

const express = require('express');
const Database = require('better-sqlite3');
const session = require('express-session');
const path = require('path');

const app = express();
// إنشاء قاعدة بيانات محلية (بديل لـ SQLite في بايثون)
const db = new Database('warghami_store.db');

// --- 1. الإعدادات الأساسية للسيرفر ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// لتشغيل ملفات الـ CSS والصور اللي فصلناها
app.use(express.static('public')); 
// تحديد EJS كمحرك لقوالب الـ HTML
app.set('view engine', 'ejs'); 

// إعداد الجلسات (عشان تسجيل الدخول)
app.use(session({
    secret: 'warghami_ultra_luxury_secret_2026',
    resave: false,
    saveUninitialized: true
}));

// --- 2. إنشاء جداول قاعدة البيانات ---
db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
        barcode TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT,
        size TEXT, color TEXT, cost_price REAL, sale_price REAL,
        old_price REAL, quantity INTEGER, image_url TEXT,
        fabric TEXT, embroidery TEXT
    );
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, customer_code TEXT UNIQUE,
        name TEXT, phone TEXT UNIQUE, city TEXT, address TEXT,
        email TEXT, password TEXT, wallet REAL DEFAULT 0,
        coupon TEXT, coupon_used INTEGER DEFAULT 0,
        free_delivery_used INTEGER DEFAULT 0, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT UNIQUE,
        customer_code TEXT, customer_name TEXT, phone TEXT, city TEXT, address TEXT,
        subtotal REAL, shipping_cost REAL, shipping_label TEXT,
        discount REAL DEFAULT 0, total REAL, status TEXT DEFAULT 'معلق',
        notes TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT,
        barcode TEXT, product_name TEXT, sale_price REAL, cost_price REAL
    );
    CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY, text TEXT);
`);

// إضافة الإعلان الافتراضي إذا كانت القاعدة جديدة
const count = db.prepare("SELECT COUNT(*) AS count FROM announcements").get();
if (count.count === 0) {
    db.prepare("INSERT INTO announcements (id, text) VALUES (1, '✨ تشكيلات حصرية فاخرة من بوتيك الورغمي - متوفر شحن فوري لجميع مدن ليبيا خلال 36 ساعة 🚀 ✨')").run();
}

// --- 3. الدوال المساعدة (نفس منطق البايثون) ---
function calcShipping(city, total) {
    if (city.includes('طرابلس')) {
        if (total >= 500) return { cost: 0, label: "توصيل مجاني (فوق 500 د.ل)" };
        if (city.includes('بوسليم') || city.includes('أبوسليم')) return { cost: 10, label: "داخل بوسليم" };
        return { cost: 15, label: "داخل طرابلس" };
    }
    const eastCities = ['سرت','بنغازي','أجدابيا','البيضاء','درنة','طبرق','الجفرة'];
    if (eastCities.some(c => city.includes(c))) return { cost: 30, label: "شرق ليبيا" };
    
    const southCities = ['بني وليد','سبها','مرزق','أوباري','تراغن'];
    if (southCities.some(c => city.includes(c))) return { cost: 30, label: "جنوب ليبيا" };
    
    return { cost: 25, label: "توصيل عام" };
}

function generateOrderCode() {
    return 'WRG-' + Math.floor(100000 + Math.random() * 900000);
}

// --- 4. مسارات الـ API (العمليات اللي تصير بالخلفية) ---

// حساب الشحن
app.get('/api/shipping', (req, res) => {
    const city = req.query.city || '';
    const total = parseFloat(req.query.total || 0);
    const shipping = calcShipping(city, total);
    res.json(shipping);
});

// تسجيل طلب جديد
app.post('/api/order', (req, res) => {
    const { name, phone, city, address, items } = req.body;
    if (!name || !phone || !city || !items || items.length === 0) {
        return res.json({ success: false, message: "بيانات ناقصة" });
    }

    let customer_code = 'CUST-' + Math.floor(1000 + Math.random() * 9000);
    let subtotal = items.reduce((sum, item) => sum + item.price, 0);
    let { cost, label } = calcShipping(city, subtotal);
    let total = subtotal + cost;
    let order_code = generateOrderCode();
    let dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    // إدخال الطلب
    db.prepare(`INSERT INTO orders (order_code, customer_code, customer_name, phone, city, address, subtotal, shipping_cost, shipping_label, total, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'معلق', ?)`).run(order_code, customer_code, name, phone, city, address, subtotal, cost, label, total, dateStr);

    // خصم الكمية من المخزون
    const insertItem = db.prepare("INSERT INTO order_items (order_code, barcode, product_name, sale_price) VALUES (?, ?, ?, ?)");
    const updateStock = db.prepare("UPDATE inventory SET quantity = MAX(0, quantity - 1) WHERE barcode = ?");
    
    db.transaction(() => {
        for (let item of items) {
            insertItem.run(order_code, item.barcode, item.name, item.price);
            updateStock.run(item.barcode);
        }
    })();

    // تجهيز رسالة الواتساب
    const waMsg = encodeURIComponent(`مرحباً بوتيك الورغمي ✨\n📦 كود الطلب: ${order_code}\n👤 الاسم: ${name}\n💰 الإجمالي: ${total} د.ل`);
    const waUrl = `https://wa.me/218910084664?text=${waMsg}`;

    res.json({ success: true, order_code, whatsapp_url: waUrl });
});

// --- 5. مسارات الصفحات (الواجهة الأمامية) ---
app.get('/', (req, res) => {
    const cat = req.query.cat || 'all';
    let items;
    
    // فلترة المنتجات
    if (cat === 'moroccan') items = db.prepare("SELECT * FROM inventory WHERE category='قفاطين مغربية'").all();
    else if (cat === 'modern') items = db.prepare("SELECT * FROM inventory WHERE category='تصاميم عصرية'").all();
    else if (cat === 'eid') items = db.prepare("SELECT * FROM inventory WHERE category='مجموعات العيد'").all();
    else items = db.prepare("SELECT * FROM inventory").all();

    // إرسال رسالة نجاح مؤقتة (لحين تجهيز ملفات الـ HTML)
res.render('index', { items: items });
});

// تشغيل السيرفر
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n✅ السيرفر شغال بنجاح!`);
    console.log(`🌐 اضغط على الرابط لفتح الموقع: http://localhost:${PORT}\n`);
});