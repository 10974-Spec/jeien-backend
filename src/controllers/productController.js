const Product = require('../models/Product');

// @desc    Fetch all products (public — only approved and active)
// @route   GET /api/products
const getProducts = async (req, res) => {
    try {
        const filter = { isApproved: true, isActive: true };

        // Handle global search query (q or keyword)
        const searchRaw = req.query.q || req.query.keyword;
        if (searchRaw) {
            filter.$or = [
                { name: { $regex: searchRaw, $options: 'i' } },
                { description: { $regex: searchRaw, $options: 'i' } },
                { tags: { $regex: searchRaw, $options: 'i' } },
                { category: { $regex: searchRaw, $options: 'i' } }
            ];
        }

        // Handle exact category filter if clicked from sidebar/grid
        if (req.query.category) {
            filter.category = req.query.category;
        }

        if (req.query.salesType) {
            // If filtering by wholesale, also include products that do 'both'
            if (req.query.salesType === 'wholesale') {
                filter.salesType = { $in: ['wholesale', 'both'] };
            } else {
                filter.salesType = req.query.salesType;
            }
        }

        const pageSize = req.query.limit ? Number(req.query.limit) : 1000;
        const page = Number(req.query.pageNumber) || 1;
        const count = await Product.countDocuments(filter);
        const products = await Product.find(filter)
            .populate('vendor', 'name storeName')
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({ products, page, pages: Math.ceil(count / pageSize) });
    } catch (e) { res.status(500).json({ message: e.message }); }

};

// @desc    Fetch all products (vendor sees own products regardless of approval)
// @route   GET /api/products/mine
const getMyProducts = async (req, res) => {
    try {
        const products = await Product.find({ vendor: req.user._id }).sort({ createdAt: -1 });
        res.json(products);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('vendor', 'name storeName storeLogo profileImage followersCount');
        if (product) res.json(product);
        else res.status(404).json({ message: 'Product not found' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// @desc    Create a product
// @route   POST /api/products
const createProduct = async (req, res) => {
    try {
        const { name, price, description, category, stock, originalPrice, sizes, colors, tags, salesType, wholesalePrice, wholesaleMinQty } = req.body;
        let images = [];
        if (req.files) images = req.files.map(f => f.path);

        const product = await Product.create({
            name, price, description, category,
            stock: stock || 0,
            originalPrice,
            images,
            sizes: sizes ? (Array.isArray(sizes) ? sizes : sizes.split(',').map(s => s.trim())) : [],
            colors: colors ? (Array.isArray(colors) ? colors : colors.split(',').map(s => s.trim())) : [],
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(s => s.trim())) : [],
            salesType: salesType || 'retail',
            wholesalePrice,
            wholesaleMinQty: wholesaleMinQty || 5,
            vendor: req.user._id,
            isApproved: false, // Requires admin approval
        });

        res.status(201).json(product);
    } catch (e) { res.status(400).json({ message: e.message }); }
};


// @desc    Update a product  
// @route   PUT /api/products/:id
const updateProduct = async (req, res) => {
    try {
        const { name, price, description, category, stock, originalPrice, isActive, sizes, colors, tags, salesType, wholesalePrice, wholesaleMinQty } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        if (product.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        product.name = name || product.name;
        product.price = price !== undefined ? price : product.price;
        product.description = description || product.description;
        product.category = category || product.category;
        product.stock = stock !== undefined ? stock : product.stock;
        product.originalPrice = originalPrice !== undefined ? originalPrice : product.originalPrice;
        if (isActive !== undefined) product.isActive = isActive;
        if (sizes) product.sizes = Array.isArray(sizes) ? sizes : sizes.split(',').map(s => s.trim());
        if (colors) product.colors = Array.isArray(colors) ? colors : colors.split(',').map(s => s.trim());
        if (tags) product.tags = Array.isArray(tags) ? tags : tags.split(',').map(s => s.trim());
        if (salesType) product.salesType = salesType;
        if (wholesalePrice !== undefined) product.wholesalePrice = wholesalePrice;
        if (wholesaleMinQty !== undefined) product.wholesaleMinQty = wholesaleMinQty;

        // If new images uploaded, append (or replace)
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(f => f.path);
            product.images = req.body.replaceImages ? newImages : [...product.images, ...newImages];
        }

        // Editing resets approval for vendor edits (not admin edits)
        if (req.user.role !== 'admin') product.isApproved = false;

        const updated = await product.save();
        res.json(updated);
    } catch (e) { res.status(400).json({ message: e.message }); }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        if (product.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }
        await Product.deleteOne({ _id: req.params.id });
        res.json({ message: 'Product removed' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = { getProducts, getMyProducts, getProductById, createProduct, updateProduct, deleteProduct };
