const calculateCommission = (totalAmount, commissionRate) => {
  const commission = (totalAmount * commissionRate) / 100;
  const netAmount = totalAmount - commission;
  
  return {
    commissionAmount: parseFloat(commission.toFixed(2)),
    netAmount: parseFloat(netAmount.toFixed(2)),
    commissionRate: parseFloat(commissionRate.toFixed(2))
  };
};

const getCategoryCommissionRate = async (categoryId, Category) => {
  try {
    const category = await Category.findById(categoryId);
    
    if (category && category.commissionRate !== undefined) {
      return category.commissionRate;
    }
    
    return parseFloat(process.env.DEFAULT_COMMISSION_RATE || 10);
  } catch (error) {
    console.error('Error getting commission rate:', error);
    return parseFloat(process.env.DEFAULT_COMMISSION_RATE || 10);
  }
};

const processOrderCommission = async (order, Category) => {
  let totalCommission = 0;
  let vendorPayments = {};
  
  for (const item of order.items) {
    const commissionRate = await getCategoryCommissionRate(item.category, Category);
    const itemCommission = (item.price * item.quantity * commissionRate) / 100;
    totalCommission += itemCommission;
    
    if (!vendorPayments[item.vendor]) {
      vendorPayments[item.vendor] = {
        totalAmount: 0,
        commissionAmount: 0,
        netAmount: 0
      };
    }
    
    vendorPayments[item.vendor].totalAmount += item.price * item.quantity;
    vendorPayments[item.vendor].commissionAmount += itemCommission;
    vendorPayments[item.vendor].netAmount += (item.price * item.quantity) - itemCommission;
  }
  
  return {
    totalCommission: parseFloat(totalCommission.toFixed(2)),
    vendorPayments
  };
};

module.exports = { calculateCommission, getCategoryCommissionRate, processOrderCommission };