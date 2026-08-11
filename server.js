const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'zkgbtcke',
  api_key: process.env.CLOUDINARY_API_KEY || '976169123815675',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'C2xiAGARCxSJTImhnoKwNAr_PR8'
});

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend domain & local testing
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Subfolder base path middleware for cPanel deployments
// Strips /hiquality/admin, /admin/api or /hiquality prefix so all /api/* routes work correctly
app.use((req, res, next) => {
  if (req.url.startsWith('/hiquality/admin/api')) {
    req.url = req.url.replace('/hiquality/admin/api', '/api');
  } else if (req.url.startsWith('/hiquality/admin')) {
    req.url = req.url.replace('/hiquality/admin', '') || '/';
  } else if (req.url.startsWith('/hiquality/api')) {
    req.url = req.url.replace('/hiquality/api', '/api');
  } else if (req.url.startsWith('/hiquality')) {
    req.url = req.url.replace('/hiquality', '') || '/';
  } else if (req.url.startsWith('/admin/api')) {
    req.url = req.url.replace('/admin/api', '/api');
  }
  next();
});

// Serve static admin dashboard from /admin
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Explicit handler for /admin route
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Debug route to inspect cPanel filesystem paths
app.get('/api/debug', (req, res) => {
  const adminPath = path.join(__dirname, 'public', 'admin', 'index.html');
  const adminExists = fs.existsSync(adminPath);
  let publicFiles = [];
  try {
    publicFiles = fs.readdirSync(path.join(__dirname, 'public'));
  } catch(e) { publicFiles = e.message; }

  res.json({
    dirname: __dirname,
    adminPath,
    adminExists,
    publicFiles,
    reqUrl: req.url,
    originalUrl: req.originalUrl
  });
});

const dbPath = path.join(__dirname, 'data', 'db.json');

// Helper to read database JSON
function getDbData() {
  try {
    if (!fs.existsSync(dbPath)) {
      return { products: [], services: [], blogs: [], enquiries: [], bookings: [], reviews: [] };
    }
    const content = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(content);
    return {
      products: parsed.products || [],
      services: parsed.services || [],
      blogs: parsed.blogs || [],
      enquiries: parsed.enquiries || [],
      bookings: parsed.bookings || [],
      reviews: parsed.reviews || []
    };
  } catch (error) {
    console.error('Error reading db.json:', error);
    return { products: [], services: [], blogs: [], enquiries: [], bookings: [], reviews: [] };
  }
}

// Helper to write database JSON
function saveDbData(data) {
  try {
    const dirPath = path.dirname(dbPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing db.json:', error);
    return false;
  }
}

// Root & Admin Route Handler - Serves Admin Portal UI directly
app.get(['/', '/admin', '/admin/*', '/admin/login'], (req, res) => {
  const adminPath = path.join(__dirname, 'public', 'admin', 'index.html');
  if (fs.existsSync(adminPath)) {
    return res.sendFile(adminPath);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send('<h1>Hi-Quality API Server Online</h1>');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', environment: process.env.NODE_ENV || 'production' });
});

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const validEmail = email === 'highqualityadmin.com' || email === 'highqualityadmin@gmail.com' || email === 'admin@hiquality.com';
  const validPassword = password === 'highqualityadmin12345' || password === 'admin123';

  if (!validEmail || !validPassword) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }


  res.json({
    success: true,
    message: 'Admin login successful',
    token: `admin-token-${Date.now()}`,
    user: { email, name: 'Hi-Quality Admin' }
  });
});

// ==========================================
// IMAGE UPLOAD TO CLOUDINARY
// ==========================================
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'hitech_products',
        format: 'webp',
        quality: 'auto',
        fetch_format: 'webp'
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary error:', error);
          return res.status(500).json({ success: false, error: 'Cloudinary upload failed' });
        }
        res.json({
          success: true,
          message: 'Image uploaded successfully!',
          url: result.secure_url,
          publicId: result.public_id
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to upload image' });
  }
});

// ==========================================
// DYNAMIC SERVICES ENDPOINTS
// ==========================================

// GET /api/services -> Fetch all services
app.get('/api/services', (req, res) => {
  const data = getDbData();
  const includeHidden = req.query.all === 'true';
  let services = data.services || [];
  if (!includeHidden) {
    services = services.filter(s => s.visible !== false);
  }
  services.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({
    success: true,
    count: services.length,
    services
  });
});

// POST /api/services -> Add new service
app.post('/api/services', (req, res) => {
  try {
    const { title, desc, icon, link, order, visible } = req.body;
    if (!title || !desc) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    const data = getDbData();
    const newService = {
      id: `svc-${Date.now()}`,
      title,
      desc,
      icon: icon || 'FaWrench',
      link: link || '#contact',
      order: Number(order) || (data.services.length + 1),
      visible: visible !== undefined ? Boolean(visible) : true
    };

    data.services.push(newService);
    saveDbData(data);

    res.status(201).json({
      success: true,
      message: 'Service added successfully!',
      service: newService
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add service' });
  }
});

// PUT /api/services/:id -> Update existing service
app.put('/api/services/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    const index = data.services.findIndex(s => s.id === id || s._id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    data.services[index] = {
      ...data.services[index],
      ...req.body,
      id: data.services[index].id
    };

    saveDbData(data);

    res.json({
      success: true,
      message: 'Service updated successfully!',
      service: data.services[index]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update service' });
  }
});

// DELETE /api/services/:id -> Delete service
app.delete('/api/services/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    const initialLen = data.services.length;
    data.services = data.services.filter(s => s.id !== id && s._id !== id);

    if (data.services.length === initialLen) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    saveDbData(data);

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete service' });
  }
});

// ==========================================
// PRODUCTS ENDPOINTS
// ==========================================

// GET /api/products -> Fetch all products
app.get('/api/products', (req, res) => {
  const data = getDbData();
  res.json({
    success: true,
    count: data.products.length,
    products: data.products
  });
});

// GET /api/products/:id -> Fetch single product details
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const data = getDbData();
  const product = (data.products || []).find(p => p.id === id || p._id === id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, product });
});

// POST /api/products -> Add new product
app.post('/api/products', (req, res) => {
  try {
    const { title, category, desc, shortDesc, fullDesc, image, spec } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Product title is required' });
    }

    const data = getDbData();
    const newProduct = {
      id: `prod-${Date.now()}`,
      _id: `prod-${Date.now()}`,
      title: title.toUpperCase(),
      image: image || '/images/prod_passenger_car.png',
      category: category || 'General Silencer',
      spec: spec || 'OEM Specification',
      shortDesc: shortDesc || desc || 'High performance OEM specification silencer built for maximum durability and flow efficiency.',
      fullDesc: fullDesc || desc || shortDesc || 'High performance OEM specification silencer engineered with precision acoustic dampening and corrosion-resistant stainless steel alloys. Designed to deliver optimal backpressure reduction, enhanced engine efficiency, and quiet exhaust notes for demanding driving conditions.',
      desc: desc || shortDesc || 'High performance OEM specification silencer built for maximum durability.'
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

// PUT /api/products/:id -> Update product
app.put('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    const index = data.products.findIndex(p => p.id === id || p._id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    data.products[index] = {
      ...data.products[index],
      ...req.body,
      id: data.products[index].id
    };

    saveDbData(data);

    res.json({
      success: true,
      message: 'Product updated successfully!',
      product: data.products[index]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id -> Delete product
app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    const initialLen = data.products.length;
    data.products = data.products.filter(p => p.id !== id && p._id !== id);

    if (data.products.length === initialLen) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    saveDbData(data);

    res.json({
      success: true,
      message: 'Product deleted successfully!'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

// ==========================================
// BLOGS ENDPOINTS
// ==========================================

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

// GET /api/blogs/:idOrSlug -> Fetch single blog post by ID or Slug
app.get('/api/blogs/:idOrSlug', (req, res) => {
  const { idOrSlug } = req.params;
  const data = getDbData();
  const blog = (data.blogs || []).find(b => b.id === idOrSlug || b._id === idOrSlug || b.slug === idOrSlug);
  if (!blog) {
    return res.status(404).json({ success: false, error: 'Blog post not found' });
  }
  res.json({ success: true, blog });
});

// POST /api/blogs -> Create new blog post
app.post('/api/blogs', (req, res) => {
  try {
    const { title, content, excerpt, featuredImage, referenceImages, visibility, seoTitle, seoDescription, keywords, category, faqs } = req.body;
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
      excerpt: excerpt || title.substring(0, 160),
      featuredImage: featuredImage || '/images/bg.webp',
      referenceImages: Array.isArray(referenceImages) ? referenceImages : [],
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

// PUT /api/blogs/:id -> Update blog post
app.put('/api/blogs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    const index = data.blogs.findIndex(b => b.id === id || b._id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    data.blogs[index] = {
      ...data.blogs[index],
      ...req.body,
      id: data.blogs[index].id,
      _id: data.blogs[index]._id
    };

    saveDbData(data);

    res.json({ success: true, message: 'Blog post updated', blog: data.blogs[index] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update blog post' });
  }
});

// DELETE /api/blogs/:id -> Delete blog post
app.delete('/api/blogs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    data.blogs = data.blogs.filter(b => b.id !== id && b._id !== id);
    saveDbData(data);
    res.json({ success: true, message: 'Blog post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete blog post' });
  }
});

// ==========================================
// ENQUIRIES & BOOKINGS
// ==========================================

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

    data.enquiries.unshift(newEnquiry);
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

// DELETE /api/enquiries/:id
app.delete('/api/enquiries/:id', (req, res) => {
  const { id } = req.params;
  const data = getDbData();
  data.enquiries = data.enquiries.filter(e => e.id !== id);
  saveDbData(data);
  res.json({ success: true, message: 'Enquiry deleted' });
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

    data.bookings.unshift(newBooking);
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

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  const data = getDbData();
  data.bookings = data.bookings.filter(b => b.id !== id);
  saveDbData(data);
  res.json({ success: true, message: 'Booking deleted' });
});

// ==========================================
// REVIEWS ENDPOINTS (ADMIN + USER SIDE)
// ==========================================

// GET /api/reviews -> Fetch all customer reviews
app.get('/api/reviews', (req, res) => {
  const includeHidden = req.query.all === 'true';
  const data = getDbData();
  let reviews = data.reviews || [];
  if (!includeHidden) {
    reviews = reviews.filter(r => r.active !== false);
  }
  reviews.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({
    success: true,
    count: reviews.length,
    reviews
  });
});

// POST /api/reviews -> Create new customer review
app.post('/api/reviews', (req, res) => {
  try {
    const { customerName, customerImage, rating, reviewText, relativeTime, googleReviewLink, order, active } = req.body;
    if (!customerName || !reviewText) {
      return res.status(400).json({ success: false, error: 'Customer name and review text are required' });
    }

    const data = getDbData();
    if (!data.reviews) data.reviews = [];

    const newReview = {
      id: `rev-${Date.now()}`,
      customerName: customerName.trim(),
      customerImage: customerImage || '',
      rating: Number(rating) || 5,
      reviewText: reviewText.trim(),
      relativeTime: relativeTime || 'recently',
      googleReviewLink: googleReviewLink || '',
      order: Number(order) || (data.reviews.length + 1),
      active: active !== undefined ? Boolean(active) : true,
      createdAt: new Date().toISOString()
    };

    data.reviews.push(newReview);
    saveDbData(data);

    res.status(201).json({
      success: true,
      message: 'Review added successfully!',
      review: newReview
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add review' });
  }
});

// PUT /api/reviews/:id -> Edit existing review
app.put('/api/reviews/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    const index = (data.reviews || []).findIndex(r => r.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    data.reviews[index] = {
      ...data.reviews[index],
      ...req.body,
      id: data.reviews[index].id
    };

    saveDbData(data);

    res.json({
      success: true,
      message: 'Review updated successfully!',
      review: data.reviews[index]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update review' });
  }
});

// DELETE /api/reviews/:id -> Delete review
app.delete('/api/reviews/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = getDbData();
    const initialLen = (data.reviews || []).length;
    data.reviews = (data.reviews || []).filter(r => r.id !== id);

    if (data.reviews.length === initialLen) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    saveDbData(data);

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
});

// Start Express Server
const serverPort = process.env.PORT || 5000;
app.listen(serverPort, () => {
  console.log(`Backend Express server running on port ${serverPort}`);
  console.log(`Admin portal available at http://localhost:${serverPort}/admin`);
});

module.exports = app;
