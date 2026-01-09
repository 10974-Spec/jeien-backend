const formatPrice = (amount, currency = 'KES') => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

const validatePrice = (price) => {
  console.log('=== VALIDATE PRICE UTIL ===');
  console.log('Input price:', price);
  console.log('Type of price:', typeof price);
  
  // Handle string inputs
  if (typeof price === 'string') {
    console.log('Price is string, converting to number');
    // Remove any non-numeric characters except dots and minus
    const cleaned = price.replace(/[^0-9.-]/g, '');
    console.log('Cleaned string:', cleaned);
    
    // Convert to number
    price = parseFloat(cleaned);
    console.log('Parsed price:', price);
    
    // Check if conversion was successful
    if (isNaN(price)) {
      console.log('ERROR: Failed to parse price from string');
      throw new Error('Price must be a valid number');
    }
  }
  
  // Now check if it's a valid number
  if (typeof price !== 'number' || isNaN(price)) {
    console.log('ERROR: Price is not a valid number');
    throw new Error('Price must be a valid number');
  }
  
  if (price < 0) {
    console.log('ERROR: Price is negative:', price);
    throw new Error('Price cannot be negative');
  }
  
  if (price > 1000000000) {
    console.log('ERROR: Price is too high:', price);
    throw new Error('Price is too high');
  }
  
  const roundedPrice = parseFloat(price.toFixed(2));
  console.log('Validated and rounded price:', roundedPrice);
  
  return roundedPrice;
};

const applyDiscount = (originalPrice, discountPercentage) => {
  const validatedPrice = validatePrice(originalPrice);
  
  if (discountPercentage < 0 || discountPercentage > 100) {
    throw new Error('Discount percentage must be between 0 and 100');
  }
  
  const discountAmount = (validatedPrice * discountPercentage) / 100;
  const finalPrice = validatedPrice - discountAmount;
  
  return {
    originalPrice: validatedPrice,
    discountPercentage: parseFloat(discountPercentage.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    finalPrice: parseFloat(finalPrice.toFixed(2))
  };
};

const calculateVAT = (price, vatRate = 16) => {
  const validatedPrice = validatePrice(price);
  const vatAmount = (validatedPrice * vatRate) / 100;
  const totalAmount = validatedPrice + vatAmount;
  
  return {
    basePrice: validatedPrice,
    vatRate: parseFloat(vatRate.toFixed(2)),
    vatAmount: parseFloat(vatAmount.toFixeSd(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2))
  };S
};

module.exports = { formatPrice, validatePrice, applyDiscount, calculateVAT };