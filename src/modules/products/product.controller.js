const Product = require('./product.model');
const Vendor = require('../vendors/vendor.model');
const Category = require('../categories/category.model');
const mongoose = require('mongoose');
const { uploadMultipleImages, deleteMultipleImages } = require('../../utils/upload.util');
const { validatePrice } = require('../../utils/price.util');

// =============== DEBUG HELPER ===============
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data !== null) {
    console.log(`[${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
};
// ============================================

const createProduct = async (req, res) => {
  debugLog('=== CREATE PRODUCT STARTED ===');
  debugLog('Request user:', req.user);
  debugLog('Request body keys:', Object.keys(req.body));
  debugLog('Request files count:', req.files ? req.files.length : 0);

  try {
    // Debug request body
    debugLog('Full request body:', req.body);

    // Find vendor
    debugLog('Finding vendor for user:', req.user.id);
    const vendor = await Vendor.findOne({ user: req.user.id });
    debugLog('Vendor found:', vendor ? vendor._id : 'NOT FOUND');
    
    if (!vendor) {
      debugLog('ERROR: Vendor not found for user:', req.user.id);
      return res.status(404).json({ message: 'Vendor not found' });
    }

    debugLog('Vendor status:', { 
      active: vendor.active,
      storeName: vendor.storeName,
      _id: vendor._id 
    });

    if (!vendor.active) {
      debugLog('ERROR: Vendor account is not active');
      return res.status(403).json({ message: 'Vendor account is not active' });
    }

    const { title, description, price, stock, category, attributes, specifications, tags, shipping, variants, sku, comparePrice } = req.body;

    // Debug all received fields
    debugLog('Product data received:', {
      title: title?.substring(0, 50) + (title?.length > 50 ? '...' : ''),
      description: description?.substring(0, 50) + (description?.length > 50 ? '...' : ''),
      price,
      stock,
      category,
      sku,
      comparePrice,
      hasAttributes: !!attributes,
      hasSpecifications: !!specifications,
      hasTags: !!tags,
      hasShipping: !!shipping,
      hasVariants: !!variants
    });

    // =============== CRITICAL: CATEGORY DEBUGGING ===============
    debugLog('=== CATEGORY VALIDATION START ===');
    debugLog('Category value:', category);
    debugLog('Category type:', typeof category);
    debugLog('Category trimmed:', category?.trim());
    
    if (!category) {
      debugLog('ERROR: Category is missing from request');
      return res.status(400).json({ message: 'Category is required' });
    }

    // Validate ObjectId format
    const trimmedCategory = category.toString().trim();
    debugLog('Trimmed category:', trimmedCategory);
    
    if (!mongoose.Types.ObjectId.isValid(trimmedCategory)) {
      debugLog('ERROR: Invalid ObjectId format', trimmedCategory);
      // List all available categories for debugging
      const allCategories = await Category.find({}, '_id name active').limit(10);
      debugLog('Available categories (first 10):', allCategories);
      
      return res.status(400).json({ 
        message: 'Invalid category ID format',
        error: 'Invalid ObjectId format',
        receivedCategory: trimmedCategory,
        availableCategories: allCategories.map(c => ({ _id: c._id, name: c.name, active: c.active }))
      });
    }

    // Find category
    debugLog('Looking for category with ID:', trimmedCategory);
    const categoryExists = await Category.findById(trimmedCategory);
    
    if (!categoryExists) {
      debugLog('ERROR: Category not found in database');
      
      // Get all categories to show what's available
      const allCategories = await Category.find({}, '_id name active');
      debugLog('All categories in database:', allCategories);
      
      return res.status(400).json({ 
        message: 'Invalid category - category not found',
        receivedCategory: trimmedCategory,
        availableCategories: allCategories.map(c => ({ _id: c._id.toString(), name: c.name, active: c.active }))
      });
    }

    debugLog('Category found:', {
      _id: categoryExists._id,
      name: categoryExists.name,
      active: categoryExists.active,
      slug: categoryExists.slug
    });

    if (!categoryExists.active) {
      debugLog('ERROR: Category is not active');
      return res.status(400).json({ 
        message: 'Category is not active',
        categoryName: categoryExists.name
      });
    }
    // =============== END CATEGORY DEBUGGING ===============

    // Validate required images
    debugLog('Checking for product images...');
    if (!req.files || req.files.length === 0) {
      debugLog('ERROR: No product images provided');
      return res.status(400).json({ message: 'At least one product image is required' });
    }
    debugLog(`Number of image files: ${req.files.length}`);

    // Validate price
    debugLog('Validating price:', price);
    const validatedPrice = validatePrice(price);
    debugLog('Validated price:', validatedPrice);

    // Prepare product data
    const productData = {
      title: title?.trim() || '',
      description: description?.trim() || '',
      price: validatedPrice,
      stock: parseInt(stock) || 0,
      category: categoryExists._id,
      vendor: vendor._id,
      approved: req.user.role === 'ADMIN' || (vendor.settings?.autoApproveProducts) || false,
      attributes: attributes ? JSON.parse(attributes) : [],
      specifications: specifications ? JSON.parse(specifications) : [],
      tags: tags ? JSON.parse(tags).map(tag => tag.trim().toLowerCase()) : []
    };

    // Add optional fields if they exist
    if (sku && sku.trim()) {
      productData.sku = sku.trim().toUpperCase();
      debugLog('SKU set:', productData.sku);
    }
    
    if (comparePrice && comparePrice.trim()) {
      productData.comparePrice = validatePrice(comparePrice);
      debugLog('Compare price set:', productData.comparePrice);
    }

    debugLog('Base product data prepared:', {
      ...productData,
      description: productData.description.substring(0, 100) + (productData.description.length > 100 ? '...' : '')
    });

    // Optional fields
    if (req.body.costPrice) {
      productData.costPrice = validatePrice(req.body.costPrice);
      debugLog('Cost price set:', productData.costPrice);
    }

    if (req.body.shortDescription) {
      productData.shortDescription = req.body.shortDescription.trim();
      debugLog('Short description set (first 50 chars):', productData.shortDescription.substring(0, 50));
    }

    if (req.body.brand) {
      productData.brand = req.body.brand.trim();
      debugLog('Brand set:', productData.brand);
    }

    if (shipping) {
      try {
        productData.shipping = JSON.parse(shipping);
        debugLog('Shipping data set');
      } catch (e) {
        debugLog('Error parsing shipping:', e.message);
      }
    }

    if (variants) {
      try {
        productData.variants = JSON.parse(variants).map(variant => ({
          ...variant,
          price: validatePrice(variant.price),
          stock: parseInt(variant.stock) || 0
        }));
        debugLog('Variants set:', productData.variants.length);
      } catch (e) {
        debugLog('Error parsing variants:', e.message);
      }
    }

    // Create product instance
    debugLog('Creating Product model instance...');
    const product = new Product(productData);
    debugLog('Product instance created with ID:', product._id);

    // Upload images
    debugLog('Starting image upload...');
    const uploadedImages = await uploadMultipleImages(req.files, 'products');
    debugLog(`Images uploaded successfully: ${uploadedImages.length} images`);
    debugLog('Image URLs:', uploadedImages);
    
    product.images = uploadedImages;

    // Save product
    debugLog('Saving product to database...');
    await product.save();
    debugLog('Product saved successfully:', {
      id: product._id,
      title: product.title,
      category: product.category,
      vendor: product.vendor,
      approved: product.approved
    });

    // Update vendor stats
    debugLog('Updating vendor stats...');
    await Vendor.findByIdAndUpdate(vendor._id, {
      $inc: { 'stats.totalProducts': 1 }
    });
    debugLog('Vendor stats updated');

    // Send response
    const responseMessage = req.user.role === 'ADMIN' ? 
      'Product created successfully' : 
      'Product created. Waiting for approval.';
    
    debugLog('=== CREATE PRODUCT COMPLETED SUCCESSFULLY ===');
    
    res.status(201).json({
      message: responseMessage,
      product: {
        _id: product._id,
        title: product.title,
        price: product.price,
        category: product.category,
        approved: product.approved,
        images: product.images
      }
    });

  } catch (error) {
    debugLog('=== CREATE PRODUCT ERROR ===');
    debugLog('Error name:', error.name);
    debugLog('Error message:', error.message);
    debugLog('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      debugLog('Mongoose Validation Errors:', error.errors);
      const validationErrors = {};
      Object.keys(error.errors).forEach(key => {
        validationErrors[key] = error.errors[key].message;
      });
      
      return res.status(400).json({
        message: 'Product validation failed',
        errors: validationErrors,
        receivedData: {
          category: req.body.category,
          title: req.body.title,
          price: req.body.price,
          stock: req.body.stock
        }
      });
    }
    
    if (error.name === 'MongoError' && error.code === 11000) {
      debugLog('Duplicate key error:', error.keyValue);
      return res.status(400).json({
        message: 'Duplicate product detected',
        field: Object.keys(error.keyValue)[0],
        value: Object.values(error.keyValue)[0]
      });
    }

    res.status(500).json({ 
      message: 'Failed to create product',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const getAllProducts = async (req, res) => {
  debugLog('=== GET ALL PRODUCTS ===');
  debugLog('Query parameters:', req.query);
  
  try {
    const { 
      page = 1, 
      limit = 20,
      category,
      vendor,
      minPrice,
      maxPrice,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      approved,
      featured,
      inStock,
      tags,
      attributes,
      admin // New parameter for admin view
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = {};

    // If admin parameter is true, show all products regardless of published status
    if (admin === 'true' && req.user && req.user.role === 'ADMIN') {
      debugLog('Admin view - showing all products');
      // Don't filter by published for admin
    } else {
      filter.published = true;
    }

    // Add approved filter - only show approved products by default for non-admin
    if (approved !== undefined) {
      filter.approved = approved === 'true';
    } else {
      // Default: only show approved products unless admin
      if (!req.user || req.user.role !== 'ADMIN') {
        filter.approved = true;
      }
    }
    
    debugLog('Approved filter:', filter.approved);

    if (category) {
      debugLog('Filtering by category:', category);
      
      // Handle "all" category special case
      if (category === 'all') {
        debugLog('"all" category - no category filter applied');
      } else if (mongoose.Types.ObjectId.isValid(category)) {
        // Check if category exists and get its children
        const categoryDoc = await Category.findById(category);
        if (categoryDoc) {
          const categoryIds = [categoryDoc._id];
          const children = await Category.find({ parent: categoryDoc._id }).select('_id');
          children.forEach(child => categoryIds.push(child._id));
          filter.category = { $in: categoryIds };
          debugLog('Category filter applied with children:', categoryIds);
        } else {
          debugLog('Category not found:', category);
        }
      } else {
        debugLog('Invalid category ID in query:', category);
      }
    }

    if (vendor) {
      debugLog('Filtering by vendor:', vendor);
      filter.vendor = vendor;
    }
    
    if (featured !== undefined) {
      filter.featured = featured === 'true';
      debugLog('Featured filter:', filter.featured);
    }
    
    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
      debugLog('In stock filter: true');
    } else if (inStock === 'false') {
      filter.stock = { $lte: 0 };
      debugLog('In stock filter: false');
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) {
        filter.price.$gte = parseFloat(minPrice);
        debugLog('Min price filter:', minPrice);
      }
      if (maxPrice !== undefined) {
        filter.price.$lte = parseFloat(maxPrice);
        debugLog('Max price filter:', maxPrice);
      }
    }

    if (search) {
      debugLog('Search filter:', search);
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase());
      filter.tags = { $in: tagArray };
      debugLog('Tags filter:', tagArray);
    }

    if (attributes) {
      try {
        const attrFilters = JSON.parse(attributes);
        Object.keys(attrFilters).forEach(key => {
          filter[`attributes.${key}`] = attrFilters[key];
        });
        debugLog('Attributes filter:', attrFilters);
      } catch (e) {
        debugLog('Error parsing attributes:', e.message);
      }
    }

    // Handle sortBy properly
    const sortOptions = {};
    // Map frontend sort parameters to actual database fields
    switch(sortBy) {
      case 'newest':
      case 'createdAt':
        sortOptions.createdAt = sortDirection;
        break;
      case 'price':
        sortOptions.price = sortDirection;
        break;
      case 'sales':
        sortOptions['stats.sales'] = sortDirection;
        break;
      case 'rating':
        sortOptions['stats.averageRating'] = sortDirection;
        break;
      case 'popularity':
      case 'trending':
      case 'views':
        sortOptions['stats.views'] = sortDirection;
        break;
      case 'featured':
        sortOptions.featured = -1; // Always show featured first
        sortOptions.createdAt = sortDirection;
        break;
      default:
        sortOptions.createdAt = sortDirection;
    }

    debugLog('Final filter:', filter);
    debugLog('Sort options:', sortOptions);
    debugLog('Pagination:', { skip, limit: parseInt(limit) });

    // Build query with proper field selection
    let query = Product.find(filter)
      .populate('vendor', 'storeName storeLogo verified')
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Select fields including stats for frontend
    query = query.select('title price images stock category vendor featured approved published createdAt updatedAt stats.views stats.sales stats.averageRating stats.totalReviews sku');

    const products = await query;
    const total = await Product.countDocuments(filter);

    debugLog('Products found:', products.length);
    debugLog('Total products matching filter:', total);

    // Get price range for filters
    const priceRangeAgg = await Product.aggregate([
      { $match: { ...filter } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ]);

    const priceRange = priceRangeAgg[0] || { minPrice: 0, maxPrice: 0 };

    res.json({
      success: true,
      products,
      filters: {
        priceRange
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    debugLog('Get all products error:', error.message);
    debugLog('Error stack:', error.stack);
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to get products', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const getProductById = async (req, res) => {
  debugLog('=== GET PRODUCT BY ID ===');
  debugLog('Product ID:', req.params.id);
  
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('Invalid product ID format:', id);
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    debugLog('Finding product...');
    const product = await Product.findById(id)
      .populate('vendor', 'storeName storeLogo storeBanner description verified stats')
      .populate('category', 'name slug commissionRate')
      .populate('relatedProducts', 'title price images slug');

    if (!product) {
      debugLog('Product not found for ID:', id);
      return res.status(404).json({ message: 'Product not found' });
    }

    debugLog('Product found:', {
      id: product._id,
      title: product.title,
      approved: product.approved,
      vendor: product.vendor?._id
    });

    // Check authorization
    if (!product.approved && req.user?.role !== 'ADMIN' && (!req.user || req.user.id !== product.vendor.user.toString())) {
      debugLog('Access denied - product not approved:', {
        userRole: req.user?.role,
        userId: req.user?.id,
        vendorUserId: product.vendor.user.toString()
      });
      return res.status(403).json({ message: 'Product not approved yet' });
    }

    // Increment view count if not owner
    if (req.user && req.user.id !== product.vendor.user.toString()) {
      debugLog('Incrementing view count...');
      await Product.findByIdAndUpdate(id, {
        $inc: { 'stats.views': 1 }
      });
    }

    // Find similar products
    debugLog('Finding similar products...');
    const similarProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      approved: true,
      published: true,
      stock: { $gt: 0 }
    })
    .limit(8)
    .select('title price images slug stats.averageRating stats.views stats.sales')
    .populate('vendor', 'storeName');

    // Find vendor's other products
    const vendorOtherProducts = await Product.find({
      vendor: product.vendor._id,
      _id: { $ne: product._id },
      approved: true,
      published: true,
      stock: { $gt: 0 }
    })
    .limit(6)
    .select('title price images slug')
    .populate('category', 'name');

    debugLog('Similar products found:', similarProducts.length);
    debugLog('Vendor other products found:', vendorOtherProducts.length);

    res.json({
      success: true,
      product,
      similarProducts,
      vendorOtherProducts
    });

  } catch (error) {
    debugLog('Get product error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get product', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const updateProduct = async (req, res) => {
  debugLog('=== UPDATE PRODUCT ===');
  debugLog('Product ID:', req.params.id);
  debugLog('Request user:', req.user);
  debugLog('Updates:', req.body);
  debugLog('Files count:', req.files ? req.files.length : 0);

  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('Invalid product ID format:', id);
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    debugLog('Finding product to update...');
    const product = await Product.findById(id).populate('vendor', 'user');
    if (!product) {
      debugLog('Product not found for ID:', id);
      return res.status(404).json({ message: 'Product not found' });
    }

    debugLog('Product found:', {
      id: product._id,
      title: product.title,
      vendorUser: product.vendor.user.toString(),
      currentUser: req.user.id,
      userRole: req.user.role
    });

    // Authorization check
    if (req.user.role !== 'ADMIN' && product.vendor.user.toString() !== req.user.id) {
      debugLog('Authorization failed:', {
        isAdmin: req.user.role === 'ADMIN',
        isOwner: product.vendor.user.toString() === req.user.id
      });
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    debugLog('Authorization successful, applying updates...');

    const allowedUpdates = [
      'title',
      'description',
      'shortDescription',
      'price',
      'comparePrice',
      'costPrice',
      'stock',
      'category',
      'brand',
      'sku',
      'barcode',
      'attributes',
      'specifications',
      'tags',
      'published',
      'featured',
      'shipping',
      'variants',
      'seo',
      'returnPolicy',
      'warranty',
      'weight',
      'dimensions'
    ];

    // Apply updates one by one with validation
    for (const field of allowedUpdates) {
      if (updates[field] !== undefined && updates[field] !== null) {
        debugLog(`Updating field "${field}":`, updates[field]);
        
        try {
          if (field === 'price' || field === 'comparePrice' || field === 'costPrice') {
            product[field] = validatePrice(updates[field]);
          } else if (field === 'stock') {
            product[field] = parseInt(updates[field]) || 0;
          } else if (field === 'attributes' || field === 'specifications' || field === 'variants') {
            product[field] = JSON.parse(updates[field]);
          } else if (field === 'tags') {
            product[field] = JSON.parse(updates[field]).map(tag => tag.trim().toLowerCase());
          } else if (field === 'shipping' || field === 'seo' || field === 'returnPolicy' || field === 'warranty' || field === 'dimensions') {
            product[field] = JSON.parse(updates[field]);
          } else if (field === 'title') {
            product[field] = updates[field].trim();
          } else if (field === 'description' || field === 'shortDescription') {
            product[field] = updates[field] ? updates[field].trim() : '';
          } else if (field === 'category') {
            // Validate category if being updated
            const categoryId = updates[field];
            if (categoryId && categoryId.trim()) {
              if (!mongoose.Types.ObjectId.isValid(categoryId)) {
                throw new Error(`Invalid category ID: ${categoryId}`);
              }
              const categoryExists = await Category.findById(categoryId);
              if (!categoryExists) {
                throw new Error(`Category not found: ${categoryId}`);
              }
              product[field] = categoryId;
            }
          } else {
            product[field] = updates[field];
          }
        } catch (parseError) {
          debugLog(`Error parsing field "${field}":`, parseError.message);
          throw new Error(`Invalid format for ${field}: ${parseError.message}`);
        }
      }
    }

    // Handle new images
    if (req.files && req.files.length > 0) {
      debugLog(`Uploading ${req.files.length} new images...`);
      const newImages = await uploadMultipleImages(req.files, 'products');
      product.images = [...product.images, ...newImages].slice(0, 10); // Limit to 10 images
      debugLog('Total images after upload:', product.images.length);
    }

    // Handle image removal
    if (updates.removeImages) {
      try {
        const imagesToRemove = JSON.parse(updates.removeImages);
        debugLog('Removing images:', imagesToRemove);
        await deleteMultipleImages(imagesToRemove);
        product.images = product.images.filter(img => !imagesToRemove.includes(img));
        debugLog('Images after removal:', product.images.length);
      } catch (parseError) {
        debugLog('Error parsing removeImages:', parseError.message);
      }
    }

    // Admin-only: approval status
    if (updates.approved !== undefined && req.user.role === 'ADMIN') {
      product.approved = updates.approved === 'true';
      debugLog('Admin updated approval status:', product.approved);
    }

    debugLog('Saving updated product...');
    await product.save();
    debugLog('Product updated successfully');

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: {
        _id: product._id,
        title: product.title,
        price: product.price,
        approved: product.approved,
        published: product.published,
        images: product.images
      }
    });

  } catch (error) {
    debugLog('Update product error:', error.message);
    debugLog('Error stack:', error.stack);
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to update product', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const deleteProduct = async (req, res) => {
  debugLog('=== DELETE PRODUCT ===');
  debugLog('Product ID:', req.params.id);
  debugLog('Request user:', req.user);

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('Invalid product ID format:', id);
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    debugLog('Finding product to delete...');
    const product = await Product.findById(id).populate('vendor', 'user');
    if (!product) {
      debugLog('Product not found for ID:', id);
      return res.status(404).json({ message: 'Product not found' });
    }

    debugLog('Product found:', {
      id: product._id,
      title: product.title,
      vendorUser: product.vendor.user.toString(),
      currentUser: req.user.id,
      userRole: req.user.role
    });

    // Authorization check
    if (req.user.role !== 'ADMIN' && product.vendor.user.toString() !== req.user.id) {
      debugLog('Authorization failed:', {
        isAdmin: req.user.role === 'ADMIN',
        isOwner: product.vendor.user.toString() === req.user.id
      });
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    debugLog('Deleting product images...');
    await deleteMultipleImages(product.images);

    debugLog('Deleting product from database...');
    await Product.findByIdAndDelete(id);

    debugLog('Updating vendor stats...');
    await Vendor.findByIdAndUpdate(product.vendor._id, {
      $inc: { 'stats.totalProducts': -1 }
    });

    debugLog('Product deleted successfully');
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    debugLog('Delete product error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete product', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const getVendorProducts = async (req, res) => {
  debugLog('=== GET VENDOR PRODUCTS ===');
  debugLog('Request user:', req.user);
  debugLog('Query parameters:', req.query);

  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      debugLog('Vendor not found for user:', req.user.id);
      return res.status(404).json({ message: 'Vendor not found' });
    }

    debugLog('Vendor found:', {
      id: vendor._id,
      storeName: vendor.storeName,
      totalProducts: vendor.stats?.totalProducts
    });

    const { 
      page = 1, 
      limit = 20,
      approved,
      published,
      lowStock,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = { vendor: vendor._id };
    debugLog('Base filter:', filter);

    if (approved !== undefined) {
      filter.approved = approved === 'true';
      debugLog('Approved filter:', filter.approved);
    }
    
    if (published !== undefined) {
      filter.published = published === 'true';
      debugLog('Published filter:', filter.published);
    }
    
    if (lowStock === 'true') {
      const threshold = vendor.settings?.lowStockThreshold || 10;
      filter.stock = { $gt: 0, $lte: threshold };
      debugLog('Low stock filter (threshold:', threshold, '):', filter.stock);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
      debugLog('Search filter:', search);
    }

    // Map sortBy to actual database fields
    const sortOptions = {};
    switch(sortBy) {
      case 'sales':
        sortOptions['stats.sales'] = sortDirection;
        break;
      case 'views':
        sortOptions['stats.views'] = sortDirection;
        break;
      case 'rating':
        sortOptions['stats.averageRating'] = sortDirection;
        break;
      default:
        sortOptions[sortBy] = sortDirection;
    }

    debugLog('Final filter:', filter);
    debugLog('Sort options:', sortOptions);
    debugLog('Pagination:', { skip, limit: parseInt(limit) });

    const products = await Product.find(filter)
      .populate('category', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('title price images stock category featured stats.sales stats.views stats.averageRating');

    const total = await Product.countDocuments(filter);
    debugLog('Products found:', products.length);
    debugLog('Total products:', total);

    const stats = await Product.aggregate([
      { $match: { vendor: vendor._id } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalApproved: { $sum: { $cond: [{ $eq: ['$approved', true] }, 1, 0] } },
          totalPublished: { $sum: { $cond: [{ $eq: ['$published', true] }, 1, 0] } },
          totalStock: { $sum: '$stock' },
          lowStock: {
            $sum: {
              $cond: [
                { $and: [
                  { $gt: ['$stock', 0] },
                  { $lte: ['$stock', vendor.settings?.lowStockThreshold || 10] }
                ]},
                1,
                0
              ]
            }
          },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } }
        }
      }
    ]);

    const statsResult = stats[0] || {
      totalProducts: 0,
      totalApproved: 0,
      totalPublished: 0,
      totalStock: 0,
      lowStock: 0,
      outOfStock: 0
    };

    debugLog('Vendor stats:', statsResult);

    res.json({
      success: true,
      products,
      stats: statsResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    debugLog('Get vendor products error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get vendor products', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const updateProductStock = async (req, res) => {
  debugLog('=== UPDATE PRODUCT STOCK ===');
  debugLog('Product ID:', req.params.id);
  debugLog('Stock update data:', req.body);

  try {
    const { id } = req.params;
    const { stock, action, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('Invalid product ID format:', id);
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const product = await Product.findById(id).populate('vendor', 'user');
    if (!product) {
      debugLog('Product not found for ID:', id);
      return res.status(404).json({ message: 'Product not found' });
    }

    debugLog('Product found:', {
      id: product._id,
      title: product.title,
      currentStock: product.stock,
      vendorUser: product.vendor.user.toString(),
      currentUser: req.user.id
    });

    if (req.user.role !== 'ADMIN' && product.vendor.user.toString() !== req.user.id) {
      debugLog('Authorization failed:', {
        isAdmin: req.user.role === 'ADMIN',
        isOwner: product.vendor.user.toString() === req.user.id
      });
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    if (stock !== undefined) {
      const newStock = parseInt(stock);
      debugLog(`Setting stock to ${newStock} (was ${product.stock})`);
      if (newStock < 0) {
        debugLog('Invalid stock value:', newStock);
        return res.status(400).json({ message: 'Stock cannot be negative' });
      }
      product.stock = newStock;
    } else if (action && quantity) {
      const qty = parseInt(quantity);
      debugLog(`Action: ${action}, Quantity: ${qty}, Current stock: ${product.stock}`);
      
      if (action === 'increase') {
        product.stock += qty;
        debugLog(`Increased stock to ${product.stock}`);
      } else if (action === 'decrease') {
        if (product.stock < qty) {
          debugLog(`Insufficient stock: ${product.stock} < ${qty}`);
          return res.status(400).json({ message: 'Insufficient stock' });
        }
        product.stock -= qty;
        debugLog(`Decreased stock to ${product.stock}`);
      } else if (action === 'set') {
        if (qty < 0) {
          debugLog('Invalid stock value:', qty);
          return res.status(400).json({ message: 'Stock cannot be negative' });
        }
        product.stock = qty;
        debugLog(`Set stock to ${product.stock}`);
      } else {
        debugLog('Invalid action:', action);
        return res.status(400).json({ message: 'Invalid action' });
      }
    } else {
      debugLog('Missing stock update parameters');
      return res.status(400).json({ message: 'Stock, action, or quantity is required' });
    }

    debugLog('Saving product with new stock...');
    await product.save();
    debugLog('Stock updated successfully');

    res.json({
      success: true,
      message: 'Product stock updated successfully',
      stock: product.stock,
      productId: product._id
    });

  } catch (error) {
    debugLog('Update product stock error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update product stock', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const bulkUpdateProducts = async (req, res) => {
  debugLog('=== BULK UPDATE PRODUCTS ===');
  debugLog('Product IDs:', req.body.ids);
  debugLog('Updates:', req.body.updates);
  debugLog('Request user:', req.user);

  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      debugLog('No product IDs provided');
      return res.status(400).json({ message: 'Product IDs are required' });
    }

    // Validate all IDs
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      debugLog('Invalid product IDs:', invalidIds);
      return res.status(400).json({ 
        message: 'Invalid product ID format(s)', 
        invalidIds 
      });
    }

    debugLog(`Processing ${ids.length} products...`);
    const products = await Product.find({ _id: { $in: ids } }).populate('vendor', 'user');
    
    const unauthorized = products.filter(p => 
      req.user.role !== 'ADMIN' && p.vendor.user.toString() !== req.user.id
    );

    if (unauthorized.length > 0) {
      debugLog('Unauthorized products found:', unauthorized.map(p => p._id));
      return res.status(403).json({ 
        message: 'Not authorized to update some products',
        unauthorized: unauthorized.map(p => p._id)
      });
    }

    const allowedUpdates = ['published', 'featured', 'price', 'comparePrice', 'stock'];
    const updateData = {};

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        debugLog(`Setting bulk update for "${field}":`, updates[field]);
        if (field === 'price' || field === 'comparePrice') {
          updateData[field] = validatePrice(updates[field]);
        } else if (field === 'stock') {
          updateData[field] = parseInt(updates[field]);
        } else {
          updateData[field] = updates[field];
        }
      }
    });

    if (req.user.role === 'ADMIN' && updates.approved !== undefined) {
      updateData.approved = updates.approved;
      debugLog('Admin setting approval status:', updateData.approved);
    }

    debugLog('Bulk update data:', updateData);
    
    const result = await Product.updateMany(
      { _id: { $in: ids } },
      { $set: updateData }
    );

    debugLog('Bulk update result:', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });

    res.json({
      success: true,
      message: 'Products updated successfully',
      count: result.modifiedCount,
      details: {
        matched: result.matchedCount,
        modified: result.modifiedCount
      }
    });

  } catch (error) {
    debugLog('Bulk update products error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to bulk update products', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const searchProducts = async (req, res) => {
  debugLog('=== SEARCH PRODUCTS ===');
  debugLog('Search query:', req.query.q);
  debugLog('Limit:', req.query.limit);

  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 1) {
      debugLog('Empty search query');
      return res.status(400).json({ message: 'Search query is required' });
    }

    const query = q.trim();
    debugLog('Searching for:', query);

    const products = await Product.find(
      { 
        $text: { $search: query }, 
        approved: true, 
        published: true, 
        stock: { $gt: 0 } 
      },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(parseInt(limit))
    .select('title price images slug category vendor stats.averageRating stats.sales stats.views')
    .populate('category', 'name')
    .populate('vendor', 'storeName');

    const categories = await Category.find(
      { $text: { $search: query }, active: true },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(5)
    .select('name slug image');

    debugLog('Search results:', {
      products: products.length,
      categories: categories.length
    });

    res.json({
      success: true,
      products,
      categories,
      query
    });

  } catch (error) {
    debugLog('Search products error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to search products', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  updateProductStock,
  bulkUpdateProducts,
  searchProducts
};