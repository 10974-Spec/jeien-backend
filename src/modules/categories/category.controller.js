const mongoose = require('mongoose');
const Category = require('./category.model');
const Product = require('../products/product.model');
const { uploadSingleImage } = require('../../utils/upload.util');

// =============== DEBUG HELPER ===============
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data !== null) {
    console.log(`[${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
};
// ============================================

// CREATE CATEGORY
const createCategory = async (req, res) => {
  debugLog('=== CREATE CATEGORY STARTED ===');
  debugLog('Request body:', req.body);
  debugLog('Request file:', req.file ? req.file.originalname : 'No file');
  debugLog('Request user:', req.user);

  try {
    const { name, description, parent, commissionRate, featured, sortOrder, seo, filters } = req.body;

    // Validate required fields
    if (!name || name.trim().length < 2) {
      debugLog('ERROR: Invalid category name:', name);
      return res.status(400).json({ message: 'Category name is required and must be at least 2 characters' });
    }

    const trimmedName = name.trim();
    debugLog('Processing category name:', trimmedName);

    // Generate slug for checking
    const generatedSlug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    debugLog('Generated slug:', generatedSlug);

    // Check for existing category
    debugLog('Checking for existing category with same name or slug...');
    const existingCategory = await Category.findOne({
      $or: [
        { name: trimmedName },
        { slug: generatedSlug }
      ]
    });

    if (existingCategory) {
      debugLog('ERROR: Category already exists:', {
        existingId: existingCategory._id,
        existingName: existingCategory.name,
        existingSlug: existingCategory.slug
      });
      return res.status(400).json({ 
        message: 'Category name already exists',
        existingCategory: {
          _id: existingCategory._id,
          name: existingCategory.name,
          slug: existingCategory.slug
        }
      });
    }

    // Validate parent if provided
    let parentId = null;
    if (parent && parent !== 'null' && parent !== '') {
      debugLog('Validating parent category:', parent);
      
      if (!mongoose.Types.ObjectId.isValid(parent)) {
        debugLog('ERROR: Invalid parent category ID format:', parent);
        return res.status(400).json({ message: 'Invalid parent category ID format' });
      }
      
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        debugLog('ERROR: Parent category not found:', parent);
        return res.status(400).json({ message: 'Parent category not found' });
      }
      
      if (!parentCategory.active) {
        debugLog('ERROR: Parent category is not active');
        return res.status(400).json({ message: 'Parent category is not active' });
      }
      
      parentId = parent;
      debugLog('Parent category validated:', {
        id: parentCategory._id,
        name: parentCategory.name
      });
    }

    // Prepare category data
    const categoryData = {
      name: trimmedName,
      description: description?.trim() || '',
      parent: parentId,
      commissionRate: commissionRate ? parseFloat(commissionRate) : parseFloat(process.env.DEFAULT_COMMISSION_RATE || 10),
      featured: featured === 'true' || featured === true,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0
    };

    debugLog('Category data prepared:', categoryData);

    // Handle SEO data
    if (seo) {
      try {
        const seoData = typeof seo === 'string' ? JSON.parse(seo) : seo;
        categoryData.seo = seoData;
        debugLog('SEO data parsed:', seoData);
      } catch (e) {
        debugLog('ERROR parsing SEO data:', e.message);
        return res.status(400).json({ message: 'Invalid SEO data format' });
      }
    }

    // Handle filters data
    if (filters) {
      try {
        const filtersData = typeof filters === 'string' ? JSON.parse(filters) : filters;
        categoryData.filters = filtersData;
        debugLog('Filters data parsed:', filtersData);
      } catch (e) {
        debugLog('ERROR parsing filters data:', e.message);
        return res.status(400).json({ message: 'Invalid filters data format' });
      }
    }

    // Create category instance
    debugLog('Creating Category model instance...');
    const category = new Category(categoryData);
    debugLog('Category instance created with ID:', category._id);

    // Upload image if provided
    if (req.file) {
      debugLog('Uploading category image...');
      try {
        category.image = await uploadSingleImage(req.file, 'categories');
        debugLog('Image uploaded successfully:', category.image);
      } catch (uploadError) {
        debugLog('ERROR uploading image:', uploadError.message);
        return res.status(400).json({ message: 'Failed to upload image', error: uploadError.message });
      }
    }

    // Save category
    debugLog('Saving category to database...');
    await category.save();
    debugLog('Category saved successfully:', {
      id: category._id,
      name: category.name,
      slug: category.slug,
      parent: category.parent
    });

    debugLog('=== CREATE CATEGORY COMPLETED SUCCESSFULLY ===');
    
    res.status(201).json({
      message: 'Category created successfully',
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        parent: category.parent,
        commissionRate: category.commissionRate,
        featured: category.featured,
        active: category.active,
        image: category.image
      }
    });

  } catch (error) {
    debugLog('=== CREATE CATEGORY ERROR ===');
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
        message: 'Category validation failed',
        errors: validationErrors,
        receivedData: {
          name: req.body.name,
          parent: req.body.parent
        }
      });
    }
    
    if (error.name === 'MongoError' && error.code === 11000) {
      debugLog('Duplicate key error:', error.keyValue);
      return res.status(400).json({
        message: 'Duplicate category detected',
        field: Object.keys(error.keyValue)[0],
        value: Object.values(error.keyValue)[0]
      });
    }

    res.status(500).json({ 
      message: 'Failed to create category',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// GET ALL CATEGORIES
const getAllCategories = async (req, res) => {
  debugLog('=== GET ALL CATEGORIES ===');
  debugLog('Query parameters:', req.query);

  try {
    const {
      page = 1,
      limit = 50,
      parent,
      featured,
      active,
      search,
      sortBy = 'sortOrder',
      sortOrder = 'asc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const filter = {};

    debugLog('Filter parameters:', {
      parent,
      featured,
      active,
      search,
      sortBy,
      sortOrder
    });

    // Handle parent category filters
    if (parent === 'null' || parent === '') {
      filter.parent = null;
      debugLog('Filter: parent is null (root categories)');
    } else if (parent && parent !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(parent)) {
        debugLog('ERROR: Invalid parent category ID:', parent);
        return res.status(400).json({ message: 'Invalid parent category ID' });
      }
      filter.parent = parent;
      debugLog('Filter: parent is', parent);
    }

    if (featured !== undefined) {
      filter.featured = featured === 'true';
      debugLog('Filter: featured =', filter.featured);
    }
    
    if (active !== undefined) {
      filter.active = active === 'true';
      debugLog('Filter: active =', filter.active);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
      debugLog('Filter: search =', search);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortDirection;
    debugLog('Sort options:', sortOptions);

    debugLog('Executing category query...');
    const categories = await Category.find(filter)
      .populate('parent', 'name slug')
      .populate('children', 'name slug image stats')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Category.countDocuments(filter);
    
    debugLog('Categories found:', categories.length);
    debugLog('Total categories:', total);

    // Calculate stats for each category
    debugLog('Calculating category stats...');
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        const categoryIds = [category._id];
        const children = await Category.find({ parent: category._id }).select('_id');
        children.forEach(child => categoryIds.push(child._id));

        const productsCount = await Product.countDocuments({
          category: { $in: categoryIds },
          approved: true
        });
        
        const vendorsCount = await Product.distinct('vendor', {
          category: { $in: categoryIds },
          approved: true
        });

        return {
          ...category.toObject(),
          stats: {
            totalProducts: productsCount,
            totalVendors: vendorsCount.length,
            totalSales: category.stats?.totalSales || 0
          }
        };
      })
    );

    debugLog('=== GET ALL CATEGORIES COMPLETED ===');
    
    res.json({
      categories: categoriesWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    debugLog('Get all categories error:', error.message);
    res.status(500).json({ 
      message: 'Failed to get categories', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// GET CATEGORY BY ID
const getCategoryById = async (req, res) => {
  debugLog('=== GET CATEGORY BY ID ===');
  debugLog('Category ID:', req.params.id);

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('ERROR: Invalid category ID format:', id);
      return res.status(400).json({ message: 'Invalid category ID format' });
    }

    debugLog('Looking for category...');
    const category = await Category.findById(id)
      .populate('parent', 'name slug')
      .populate({
        path: 'children',
        match: { active: true },
        options: { sort: { sortOrder: 1 } }
      });

    if (!category) {
      debugLog('ERROR: Category not found for ID:', id);
      return res.status(404).json({ message: 'Category not found' });
    }

    debugLog('Category found:', {
      id: category._id,
      name: category.name,
      active: category.active,
      parent: category.parent?._id
    });

    // Update stats
    debugLog('Updating category stats...');
    const categoryIds = [category._id];
    const children = await Category.find({ parent: category._id, active: true }).select('_id');
    children.forEach(child => categoryIds.push(child._id));

    const [productsCount, vendorsCount] = await Promise.all([
      Product.countDocuments({
        category: { $in: categoryIds },
        approved: true,
        stock: { $gt: 0 }
      }),
      Product.distinct('vendor', {
        category: { $in: categoryIds },
        approved: true
      })
    ]);

    category.stats.totalProducts = productsCount;
    category.stats.totalVendors = vendorsCount.length;
    await category.save();

    debugLog('Category stats updated:', {
      totalProducts: productsCount,
      totalVendors: vendorsCount.length
    });

    res.json({
      category: {
        ...category.toObject(),
        stats: {
          totalProducts: productsCount,
          totalVendors: vendorsCount.length,
          totalSales: category.stats.totalSales
        }
      }
    });

  } catch (error) {
    debugLog('Get category error:', error.message);
    res.status(500).json({ 
      message: 'Failed to get category', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// UPDATE CATEGORY
const updateCategory = async (req, res) => {
  debugLog('=== UPDATE CATEGORY ===');
  debugLog('Category ID:', req.params.id);
  debugLog('Updates:', req.body);
  debugLog('Request file:', req.file ? req.file.originalname : 'No file');
  debugLog('Request user:', req.user);

  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('ERROR: Invalid category ID format:', id);
      return res.status(400).json({ message: 'Invalid category ID format' });
    }

    debugLog('Looking for category to update...');
    const category = await Category.findById(id);
    if (!category) {
      debugLog('ERROR: Category not found for ID:', id);
      return res.status(404).json({ message: 'Category not found' });
    }

    debugLog('Category found:', {
      id: category._id,
      name: category.name,
      active: category.active
    });

    const allowedUpdates = [
      'name',
      'description',
      'parent',
      'commissionRate',
      'featured',
      'active',
      'sortOrder',
      'seo',
      'filters'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        debugLog(`Updating field "${field}":`, updates[field]);
        
        if (field === 'name') {
          category[field] = updates[field].trim();
        } else if (field === 'parent') {
          if (updates[field] === '' || updates[field] === 'null') {
            category[field] = null;
            debugLog('Setting parent to null');
          } else {
            // Validate parent exists
            if (!mongoose.Types.ObjectId.isValid(updates[field])) {
              throw new Error(`Invalid parent category ID: ${updates[field]}`);
            }
            category[field] = updates[field];
          }
        } else if (field === 'seo' || field === 'filters') {
          try {
            const data = typeof updates[field] === 'string' ? JSON.parse(updates[field]) : updates[field];
            category[field] = { ...category[field], ...data };
          } catch (e) {
            throw new Error(`Invalid ${field} data format: ${e.message}`);
          }
        } else {
          category[field] = updates[field];
        }
      }
    });

    // Handle image upload
    if (req.file) {
      debugLog('Uploading new category image...');
      try {
        category.image = await uploadSingleImage(req.file, 'categories');
        debugLog('New image uploaded:', category.image);
      } catch (uploadError) {
        debugLog('ERROR uploading image:', uploadError.message);
        return res.status(400).json({ message: 'Failed to upload image', error: uploadError.message });
      }
    } else if (updates.removeImage === 'true') {
      debugLog('Removing category image as requested');
      category.image = null;
    }

    debugLog('Saving updated category...');
    await category.save();
    debugLog('Category updated successfully');

    res.json({
      message: 'Category updated successfully',
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        parent: category.parent,
        active: category.active,
        featured: category.featured,
        image: category.image
      }
    });

  } catch (error) {
    debugLog('Update category error:', error.message);
    res.status(500).json({ 
      message: 'Failed to update category', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// DELETE CATEGORY
const deleteCategory = async (req, res) => {
  debugLog('=== DELETE CATEGORY ===');
  debugLog('Category ID:', req.params.id);
  debugLog('Request user:', req.user);

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('ERROR: Invalid category ID format:', id);
      return res.status(400).json({ message: 'Invalid category ID format' });
    }

    debugLog('Looking for category to delete...');
    const category = await Category.findById(id);
    if (!category) {
      debugLog('ERROR: Category not found for ID:', id);
      return res.status(404).json({ message: 'Category not found' });
    }

    debugLog('Category found:', {
      id: category._id,
      name: category.name
    });

    // Check for children
    debugLog('Checking for child categories...');
    const hasChildren = await Category.exists({ parent: id });
    if (hasChildren) {
      debugLog('ERROR: Category has child categories');
      const childCount = await Category.countDocuments({ parent: id });
      return res.status(400).json({ 
        message: 'Cannot delete category with subcategories.',
        childCount
      });
    }

    // Check for products
    debugLog('Checking for products in this category...');
    const hasProducts = await Product.exists({ category: id });
    if (hasProducts) {
      debugLog('ERROR: Category has associated products');
      const productCount = await Product.countDocuments({ category: id });
      return res.status(400).json({ 
        message: 'Cannot delete category with products.',
        productCount
      });
    }

    debugLog('Deleting category...');
    await Category.findByIdAndDelete(id);
    debugLog('Category deleted successfully');

    res.json({ 
      message: 'Category deleted successfully',
      deletedCategory: {
        id: category._id,
        name: category.name
      }
    });

  } catch (error) {
    debugLog('Delete category error:', error.message);
    res.status(500).json({ 
      message: 'Failed to delete category', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// GET CATEGORY PRODUCTS
const getCategoryProducts = async (req, res) => {
  debugLog('=== GET CATEGORY PRODUCTS ===');
  debugLog('Category ID:', req.params.id);
  debugLog('Query parameters:', req.query);

  try {
    const { id } = req.params; // can be "all"
    const { page = 1, limit = 20, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc', attributes } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    let filter = { approved: true, stock: { $gt: 0 } };
    let category = null;

    if (id && id !== 'all') {
      debugLog('Getting products for specific category:', id);
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        debugLog('ERROR: Invalid category ID format:', id);
        return res.status(400).json({ message: 'Invalid category ID format' });
      }

      category = await Category.findById(id);
      if (!category || !category.active) {
        debugLog('ERROR: Category not found or not active:', id);
        return res.status(404).json({ message: 'Category not found' });
      }

      const categoryIds = [id];
      const children = await Category.find({ parent: id, active: true }).select('_id');
      children.forEach(child => categoryIds.push(child._id));

      filter.category = { $in: categoryIds };
      debugLog('Category IDs filter:', categoryIds);
    } else {
      debugLog('Getting products for all categories');
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

    if (attributes) {
      try {
        const attrFilters = JSON.parse(attributes);
        Object.keys(attrFilters).forEach(key => {
          filter[`attributes.${key}`] = attrFilters[key];
        });
        debugLog('Attributes filter:', attrFilters);
      } catch (e) {
        debugLog('ERROR parsing attributes:', e.message);
        return res.status(400).json({ message: 'Invalid attributes format' });
      }
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortDirection;
    debugLog('Sort options:', sortOptions);

    debugLog('Finding products with filter:', filter);
    const products = await Product.find(filter)
      .populate('vendor', 'storeName storeLogo verified')
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(filter);
    debugLog('Products found:', products.length);
    debugLog('Total products:', total);

    res.json({
      category: id === 'all' ? null : {
        _id: category._id,
        name: category.name,
        slug: category.slug
      },
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    debugLog('Get category products error:', error.message);
    res.status(500).json({ 
      message: 'Failed to get category products', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// UPDATE CATEGORY STATS
const updateCategoryStats = async (req, res) => {
  debugLog('=== UPDATE CATEGORY STATS ===');
  debugLog('Request user:', req.user);

  try {
    debugLog('Finding all categories...');
    const categories = await Category.find({});
    debugLog(`Found ${categories.length} categories`);

    const statsUpdatePromises = categories.map(async (category, index) => {
      debugLog(`Processing category ${index + 1}/${categories.length}: ${category.name}`);
      
      const categoryIds = [category._id];
      const children = await Category.find({ parent: category._id }).select('_id');
      children.forEach(child => categoryIds.push(child._id));

      debugLog(`Category ${category.name} has ${children.length} children`);

      const [productsCount, vendorsCount, salesCount] = await Promise.all([
        Product.countDocuments({ category: { $in: categoryIds }, approved: true }),
        Product.distinct('vendor', { category: { $in: categoryIds }, approved: true }),
        Product.aggregate([
          { $match: { category: { $in: categoryIds } } },
          { $group: { _id: null, totalSales: { $sum: '$stats.sales' } } }
        ])
      ]);

      const totalSales = salesCount[0]?.totalSales || 0;
      
      debugLog(`Category ${category.name} stats:`, {
        productsCount,
        vendorsCount: vendorsCount.length,
        totalSales
      });

      category.stats.totalProducts = productsCount;
      category.stats.totalVendors = vendorsCount.length;
      category.stats.totalSales = totalSales;

      await category.save();
      debugLog(`Saved stats for category: ${category.name}`);
    });

    await Promise.all(statsUpdatePromises);

    debugLog('=== CATEGORY STATS UPDATE COMPLETED ===');
    res.json({ 
      message: 'Category stats updated successfully',
      categoriesUpdated: categories.length
    });

  } catch (error) {
    debugLog('Update category stats error:', error.message);
    res.status(500).json({ 
      message: 'Failed to update category stats', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// GET FEATURED CATEGORIES
const getFeaturedCategories = async (req, res) => {
  debugLog('=== GET FEATURED CATEGORIES ===');

  try {
    debugLog('Finding featured categories...');
    const categories = await Category.find({
      featured: true,
      active: true,
      image: { $ne: null }
    })
      .sort({ sortOrder: 1, name: 1 })
      .limit(10)
      .select('name slug image description stats');

    debugLog(`Found ${categories.length} featured categories`);

    // Add product counts
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const categoryIds = [category._id];
        const children = await Category.find({ parent: category._id, active: true }).select('_id');
        children.forEach(child => categoryIds.push(child._id));

        const productsCount = await Product.countDocuments({
          category: { $in: categoryIds },
          approved: true,
          stock: { $gt: 0 }
        });

        return {
          ...category.toObject(),
          stats: {
            ...category.stats,
            totalProducts: productsCount
          }
        };
      })
    );

    debugLog('Featured categories with counts:', categoriesWithCounts.map(c => ({
      name: c.name,
      products: c.stats.totalProducts
    })));

    res.json(categoriesWithCounts);

  } catch (error) {
    debugLog('Get featured categories error:', error.message);
    res.status(500).json({ 
      message: 'Failed to get featured categories', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryProducts,
  updateCategoryStats,
  getFeaturedCategories
};