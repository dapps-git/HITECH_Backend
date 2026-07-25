const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend domain & local testing
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const dbPath = path.join(__dirname, 'data', 'db.json');

// Helper to read database JSON
function getDbData() {
  try {
    if (!fs.existsSync(dbPath)) {
      return { products: [], enquiries: [], bookings: [] };
    }
    const content = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading db.json:', error);
    return { products: [], enquiries: [], bookings: [] };
  }
}

// Helper to write database JSON
function saveDbData(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing db.json:', error);
    return false;
  }
}

// Health Check Route
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    message: 'Hi Quality Silencers Express API Server is Running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', environment: process.env.NODE_ENV || 'production' });
});

// GET /api/products -> Fetch all products
app.get('/api/products', (req, res) => {
  const data = getDbData();
  res.json({
    success: true,
    count: data.products.length,
    products: data.products
  });
});

// POST /api/products -> Add new product
app.post('/api/products', (req, res) => {
  try {
    const { title, category, desc, image, spec } = req.body;
    if (!title || !desc) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    const data = getDbData();
    const newProduct = {
      id: `prod-${Date.now()}`,
      title: title.toUpperCase(),
      image: image || '/images/prod_passenger_car.png',
      category: category || 'General Silencer',
      desc,
      spec: spec || 'OEM Specification'
    };

    data.products.push(newProduct);
    saveDbData(data);

    res.status(201).json({
      success: true,
      message: 'Product added successfully!',
      product: newProduct
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/enquiries -> Get all contact enquiries
app.get('/api/enquiries', (req, res) => {
  const data = getDbData();
  res.json({
    success: true,
    count: data.enquiries.length,
    enquiries: data.enquiries
  });
});

// POST /api/enquiries -> Submit new customer enquiry
app.post('/api/enquiries', (req, res) => {
  try {
    const { name, phone, email, message, product } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const data = getDbData();
    const newEnquiry = {
      id: `enq-${Date.now()}`,
      name: name || 'Customer',
      phone,
      email: email || '',
      message: message || '',
      product: product || 'General Enquiry',
      createdAt: new Date().toISOString()
    };

    data.enquiries.push(newEnquiry);
    saveDbData(data);

    res.status(201).json({
      success: true,
      message: 'Enquiry received! We will contact you shortly.',
      enquiry: newEnquiry
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to process enquiry' });
  }
});

// POST /api/admin/login -> Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const validEmail = email === 'highqualityadmin.com' || email === 'highqualityadmin@gmail.com';
  const validPassword = password === 'highqualityadmin12345';

  if (!validEmail || !validPassword) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  res.json({ success: true, message: 'Admin login successful', token: `admin-token-${Date.now()}` });
});

// GET /api/blogs -> Fetch all blog posts
app.get('/api/blogs', (req, res) => {
  const includeHidden = req.query.all === 'true';
  const data = getDbData();
  let blogs = data.blogs || [];
  if (!includeHidden) {
    blogs = blogs.filter(b => b.visibility === 'visible');
  }
  res.json({ success: true, count: blogs.length, blogs });
});

// POST /api/blogs -> Create new blog post
app.post('/api/blogs', (req, res) => {
  try {
    const { title, content, excerpt, featuredImage, visibility, seoTitle, seoDescription, keywords, category, faqs } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    const data = getDbData();
    if (!data.blogs) data.blogs = [];

    const slug = title.toLowerCase().trim().replace(/[\s\W-]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
    const newBlog = {
      id: `blog-${Date.now()}`,
      _id: `blog-${Date.now()}`,
      title,
      slug,
      content,
      excerpt: excerpt || title,
      featuredImage: featuredImage || '/images/bg.webp',
      visibility: visibility || 'visible',
      publishDate: new Date().toISOString(),
      seoTitle: seoTitle || title,
      seoDescription: seoDescription || excerpt || title,
      keywords: keywords || '',
      category: category || 'DPF & Silencer Guides',
      faqs: Array.isArray(faqs) ? faqs : []
    };

    data.blogs.unshift(newBlog);
    saveDbData(data);

    res.status(201).json({ success: true, message: 'Blog post created', blog: newBlog });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create blog post' });
  }
});

// GET /api/bookings -> Get DPF service bookings
app.get('/api/bookings', (req, res) => {
  const data = getDbData();
  res.json({
    success: true,
    count: data.bookings.length,
    bookings: data.bookings
  });
});

// POST /api/bookings -> Book DPF cleaning appointment
app.post('/api/bookings', (req, res) => {
  try {
    const { customerName, phone, vehicleModel, preferredDate } = req.body;
    if (!phone || !vehicleModel) {
      return res.status(400).json({ success: false, error: 'Phone number and vehicle model are required' });
    }

    const data = getDbData();
    const newBooking = {
      id: `book-${Date.now()}`,
      customerName: customerName || 'Valued Customer',
      phone,
      vehicleModel,
      preferredDate: preferredDate || new Date().toISOString().split('T')[0],
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    data.bookings.push(newBooking);
    saveDbData(data);

    res.status(201).json({
      success: true,
      message: 'DPF Cleaning appointment booked successfully!',
      booking: newBooking
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Backend Express server running on port ${PORT}`);
});
