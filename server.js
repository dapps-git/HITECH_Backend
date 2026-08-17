require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const mongoose = require('mongoose');

const Product = require('./models/Product');
const Service = require('./models/Service');
const BlogPost = require('./models/BlogPost');
const Review = require('./models/Review');
const Admin = require('./models/Admin');

const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'zkgbtcke',
  api_key: process.env.CLOUDINARY_API_KEY || '976169123815675',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'C2xiAGARCxSJTImhnoKwNAr_PR8'
});

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hitech_db_user:hitech234@cluster0.hdxwklk.mongodb.net/hitech_db?retryWrites=true&w=majority';
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
}).then(() => {
  console.log('Successfully connected to MongoDB Atlas!');
}).catch(err => {
  console.error('MongoDB Atlas connection error:', err.message);
});

// Enable CORS for frontend domain & local testing
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Subfolder base path middleware for cPanel deployments
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
    mongoState: mongoose.connection.readyState,
    reqUrl: req.url,
    originalUrl: req.originalUrl
  });
});

const dbPath = path.join(__dirname, 'data', 'db.json');

// Helper to read database JSON fallback
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

// Helper to write database JSON fallback
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
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'production',
    mongoConnection: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED'
  });
});

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================
app.post('/api/admin/login', async (req, res) => {
  try {
    const emailInput = (req.body.email || '').trim().toLowerCase();
    const passwordInput = (req.body.password || '').trim();

    let authenticated = false;
    let adminName = 'Hi-Quality Admin';

    // 1. Check MongoDB Atlas Admin collection
    if (mongoose.connection.readyState === 1) {
      const adminDoc = await Admin.findOne({ email: emailInput }).lean();
      if (adminDoc && adminDoc.password === passwordInput) {
        authenticated = true;
        adminName = adminDoc.name || adminName;
      }
    }

    // 2. Fallback check exclusively for highqualityadmin@gmail.com
    if (!authenticated) {
      if (emailInput === 'highqualityadmin@gmail.com' && passwordInput === 'highqualityadmin12345') {
        authenticated = true;
      }
    }

    if (!authenticated) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    res.json({
      success: true,
      message: 'Admin login successful',
      token: `admin-token-${Date.now()}`,
      user: { email: emailInput, name: adminName }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Admin login failed' });
  }
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
app.get('/api/services', async (req, res) => {
  try {
    const includeHidden = req.query.all === 'true';
    let services = [];
    if (mongoose.connection.readyState === 1) {
      const query = includeHidden ? {} : { visible: { $ne: false } };
      services = await Service.find(query).sort({ order: 1 }).lean();
    } else {
      const data = getDbData();
      services = data.services || [];
      if (!includeHidden) {
        services = services.filter(s => s.visible !== false);
      }
      services.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch services' });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const { title, desc, icon, link, order, visible } = req.body;
    if (!title || !desc) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    const serviceData = {
      id: `svc-${Date.now()}`,
      title,
      desc,
      icon: icon || 'FaWrench',
      link: link || '#contact',
      order: Number(order) || 1,
      visible: visible !== undefined ? Boolean(visible) : true
    };

    let newService = serviceData;
    if (mongoose.connection.readyState === 1) {
      newService = await Service.create(serviceData);
    }
    
    const data = getDbData();
    data.services.push(serviceData);
    saveDbData(data);

    res.status(201).json({
      success: true,
      message: 'Service added successfully!',
      service: newService
    });
  } catch (err) {
    console.error('Error adding service:', err);
    res.status(500).json({ success: false, error: 'Failed to add service' });
  }
});

app.put('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let updatedService = null;

    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      updatedService = await Service.findOneAndUpdate(query, req.body, { returnDocument: 'after' }).lean();
    }

    const data = getDbData();
    const index = data.services.findIndex(s => s.id === id || s._id === id);
    if (index !== -1) {
      data.services[index] = { ...data.services[index], ...req.body };
      if (!updatedService) updatedService = data.services[index];
      saveDbData(data);
    }

    if (!updatedService) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    res.json({
      success: true,
      message: 'Service updated successfully!',
      service: updatedService
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update service' });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = false;

    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      const result = await Service.findOneAndDelete(query);
      if (result) deleted = true;
    }

    const data = getDbData();
    const initialLen = data.services.length;
    data.services = data.services.filter(s => s.id !== id && s._id !== id);
    if (data.services.length < initialLen) deleted = true;
    saveDbData(data);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

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
app.get('/api/products', async (req, res) => {
  try {
    let products = [];
    if (mongoose.connection.readyState === 1) {
      products = await Product.find().lean();
    } else {
      const data = getDbData();
      products = data.products || [];
    }
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;
    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      product = await Product.findOne(query).lean();
    }
    if (!product) {
      const data = getDbData();
      product = (data.products || []).find(p => p.id === id || p._id === id);
    }
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { title, category, desc, shortDesc, fullDesc, image, spec } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Product title is required' });
    }

    const prodId = `prod-${Date.now()}`;
    const productData = {
      id: prodId,
      title: title.toUpperCase(),
      image: image || '/images/prod_passenger_car.png',
      category: category || 'General Silencer',
      spec: spec || 'OEM Specification',
      shortDesc: shortDesc || desc || 'High performance OEM specification silencer built for maximum durability.',
      fullDesc: fullDesc || desc || shortDesc || 'High performance OEM specification silencer engineered with precision acoustic dampening.',
      desc: desc || shortDesc || 'High performance OEM specification silencer built for maximum durability.'
    };

    let newProduct = productData;
    if (mongoose.connection.readyState === 1) {
      newProduct = await Product.create(productData);
    }

    const data = getDbData();
    data.products.push(productData);
    saveDbData(data);

    res.status(201).json({
      success: true,
      message: 'Product added successfully!',
      product: newProduct
    });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let updatedProduct = null;

    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      updatedProduct = await Product.findOneAndUpdate(query, req.body, { returnDocument: 'after' }).lean();
    }

    const data = getDbData();
    const index = data.products.findIndex(p => p.id === id || p._id === id);
    if (index !== -1) {
      data.products[index] = { ...data.products[index], ...req.body };
      if (!updatedProduct) updatedProduct = data.products[index];
      saveDbData(data);
    }

    if (!updatedProduct) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({
      success: true,
      message: 'Product updated successfully!',
      product: updatedProduct
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = false;

    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      const result = await Product.findOneAndDelete(query);
      if (result) deleted = true;
    }

    const data = getDbData();
    const initialLen = data.products.length;
    data.products = data.products.filter(p => p.id !== id && p._id !== id);
    if (data.products.length < initialLen) deleted = true;
    saveDbData(data);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

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
app.get('/api/blogs', async (req, res) => {
  try {
    const includeHidden = req.query.all === 'true';
    let blogs = [];
    if (mongoose.connection.readyState === 1) {
      const query = includeHidden ? {} : { visibility: 'visible' };
      blogs = await BlogPost.find(query).sort({ publishDate: -1 }).lean();
    } else {
      const data = getDbData();
      blogs = data.blogs || [];
      if (!includeHidden) {
        blogs = blogs.filter(b => b.visibility === 'visible');
      }
    }
    res.json({ success: true, count: blogs.length, blogs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch blog posts' });
  }
});

app.get('/api/blogs/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let blog = null;
    if (mongoose.connection.readyState === 1) {
      const query = {
        $or: [
          { slug: idOrSlug },
          { id: idOrSlug },
          { _id: mongoose.Types.ObjectId.isValid(idOrSlug) ? idOrSlug : null }
        ]
      };
      blog = await BlogPost.findOne(query).lean();
    }
    if (!blog) {
      const data = getDbData();
      blog = (data.blogs || []).find(b => b.id === idOrSlug || b._id === idOrSlug || b.slug === idOrSlug);
    }
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog post not found' });
    }
    res.json({ success: true, blog });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch blog post' });
  }
});

app.post('/api/blogs', async (req, res) => {
  try {
    const { title, content, excerpt, featuredImage, referenceImages, visibility, seoTitle, seoDescription, keywords, category, faqs } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    const blogId = `blog-${Date.now()}`;
    const slug = title.toLowerCase().trim().replace(/[\s\W-]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
    const blogData = {
      id: blogId,
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

    let newBlog = blogData;
    if (mongoose.connection.readyState === 1) {
      newBlog = await BlogPost.create(blogData);
    }

    const data = getDbData();
    if (!data.blogs) data.blogs = [];
    data.blogs.unshift(blogData);
    saveDbData(data);

    res.status(201).json({ success: true, message: 'Blog post created', blog: newBlog });
  } catch (err) {
    console.error('Error creating blog:', err);
    res.status(500).json({ success: false, error: 'Failed to create blog post' });
  }
});

app.put('/api/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let updatedBlog = null;

    if (mongoose.connection.readyState === 1) {
      const query = {
        $or: [
          { id },
          { slug: id },
          { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }
        ]
      };
      updatedBlog = await BlogPost.findOneAndUpdate(query, req.body, { returnDocument: 'after' }).lean();
    }

    const data = getDbData();
    const index = (data.blogs || []).findIndex(b => b.id === id || b._id === id || b.slug === id);
    if (index !== -1) {
      data.blogs[index] = { ...data.blogs[index], ...req.body };
      if (!updatedBlog) updatedBlog = data.blogs[index];
      saveDbData(data);
    }

    if (!updatedBlog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    res.json({ success: true, message: 'Blog post updated', blog: updatedBlog });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update blog post' });
  }
});

app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = false;

    if (mongoose.connection.readyState === 1) {
      const query = {
        $or: [
          { id },
          { slug: id },
          { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }
        ]
      };
      const result = await BlogPost.findOneAndDelete(query);
      if (result) deleted = true;
    }

    const data = getDbData();
    const initialLen = (data.blogs || []).length;
    data.blogs = (data.blogs || []).filter(b => b.id !== id && b._id !== id && b.slug !== id);
    if (data.blogs.length < initialLen) deleted = true;
    saveDbData(data);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Blog post not found' });
    }

    res.json({ success: true, message: 'Blog post deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete blog post' });
  }
});

// ==========================================
// ENQUIRIES & BOOKINGS
// ==========================================
app.get('/api/enquiries', async (req, res) => {
  try {
    let enquiries = [];
    if (mongoose.connection.readyState === 1) {
      enquiries = await Enquiry.find().sort({ createdAt: -1 }).lean();
    } else {
      const data = getDbData();
      enquiries = data.enquiries || [];
    }
    res.json({ success: true, count: enquiries.length, enquiries });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch enquiries' });
  }
});

app.post('/api/enquiries', async (req, res) => {
  try {
    const { name, phone, email, message, product } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const enqData = {
      id: `enq-${Date.now()}`,
      name: name || 'Customer',
      phone,
      email: email || '',
      message: message || '',
      product: product || 'General Enquiry',
      createdAt: new Date().toISOString()
    };

    let newEnquiry = enqData;
    if (mongoose.connection.readyState === 1) {
      newEnquiry = await Enquiry.create(enqData);
    }

    const data = getDbData();
    data.enquiries.unshift(enqData);
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

app.delete('/api/enquiries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = false;
    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      const result = await Enquiry.findOneAndDelete(query);
      if (result) deleted = true;
    }
    const data = getDbData();
    const initialLen = data.enquiries.length;
    data.enquiries = data.enquiries.filter(e => e.id !== id && e._id !== id);
    if (data.enquiries.length < initialLen) deleted = true;
    saveDbData(data);

    res.json({ success: true, message: 'Enquiry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete enquiry' });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    let bookings = [];
    if (mongoose.connection.readyState === 1) {
      bookings = await Booking.find().sort({ createdAt: -1 }).lean();
    } else {
      const data = getDbData();
      bookings = data.bookings || [];
    }
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { customerName, phone, vehicleModel, preferredDate } = req.body;
    if (!phone || !vehicleModel) {
      return res.status(400).json({ success: false, error: 'Phone number and vehicle model are required' });
    }

    const bookData = {
      id: `book-${Date.now()}`,
      customerName: customerName || 'Valued Customer',
      phone,
      vehicleModel,
      preferredDate: preferredDate || new Date().toISOString().split('T')[0],
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    let newBooking = bookData;
    if (mongoose.connection.readyState === 1) {
      newBooking = await Booking.create(bookData);
    }

    const data = getDbData();
    data.bookings.unshift(bookData);
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

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = false;
    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      const result = await Booking.findOneAndDelete(query);
      if (result) deleted = true;
    }
    const data = getDbData();
    const initialLen = data.bookings.length;
    data.bookings = data.bookings.filter(b => b.id !== id && b._id !== id);
    if (data.bookings.length < initialLen) deleted = true;
    saveDbData(data);

    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete booking' });
  }
});

// ==========================================
// REVIEWS ENDPOINTS
// ==========================================
app.get('/api/reviews', async (req, res) => {
  try {
    const includeHidden = req.query.all === 'true';
    let reviews = [];
    if (mongoose.connection.readyState === 1) {
      const query = includeHidden ? {} : { active: { $ne: false } };
      reviews = await Review.find(query).sort({ order: 1 }).lean();
    } else {
      const data = getDbData();
      reviews = data.reviews || [];
      if (!includeHidden) {
        reviews = reviews.filter(r => r.active !== false);
      }
      reviews.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    res.json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { customerName, customerImage, rating, reviewText, relativeTime, googleReviewLink, order, active } = req.body;
    if (!customerName || !reviewText) {
      return res.status(400).json({ success: false, error: 'Customer name and review text are required' });
    }

    const revData = {
      id: `rev-${Date.now()}`,
      customerName: customerName.trim(),
      customerImage: customerImage || '',
      rating: Number(rating) || 5,
      reviewText: reviewText.trim(),
      relativeTime: relativeTime || 'recently',
      googleReviewLink: googleReviewLink || '',
      order: Number(order) || 1,
      active: active !== undefined ? Boolean(active) : true,
      createdAt: new Date().toISOString()
    };

    let newReview = revData;
    if (mongoose.connection.readyState === 1) {
      newReview = await Review.create(revData);
    }

    const data = getDbData();
    if (!data.reviews) data.reviews = [];
    data.reviews.push(revData);
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

app.put('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let updatedReview = null;

    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      updatedReview = await Review.findOneAndUpdate(query, req.body, { returnDocument: 'after' }).lean();
    }

    const data = getDbData();
    const index = (data.reviews || []).findIndex(r => r.id === id || r._id === id);
    if (index !== -1) {
      data.reviews[index] = { ...data.reviews[index], ...req.body };
      if (!updatedReview) updatedReview = data.reviews[index];
      saveDbData(data);
    }

    if (!updatedReview) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({
      success: true,
      message: 'Review updated successfully!',
      review: updatedReview
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update review' });
  }
});

app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = false;

    if (mongoose.connection.readyState === 1) {
      const query = { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] };
      const result = await Review.findOneAndDelete(query);
      if (result) deleted = true;
    }

    const data = getDbData();
    const initialLen = (data.reviews || []).length;
    data.reviews = (data.reviews || []).filter(r => r.id !== id && r._id !== id);
    if (data.reviews.length < initialLen) deleted = true;
    saveDbData(data);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
});

// Start Express Server
if (require.main === module) {
  const serverPort = process.env.PORT || 5000;
  app.listen(serverPort, () => {
    console.log(`Backend Express server running on port ${serverPort}`);
    console.log(`Admin portal available at http://localhost:${serverPort}/admin`);
  });
}

module.exports = app;
