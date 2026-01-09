/**
 * Exponential backoff retry utility
 */
const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  baseDelay = 1000,
  shouldRetry = (error) => {
    // Retry on network errors, 429, 5xx
    return !error.response || 
           error.response.status === 429 || 
           error.response.status >= 500;
  }
) => {
  let lastError;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
      const totalDelay = delay + jitter;

      console.log(`Retry attempt ${attempt}/${maxRetries} after ${Math.round(totalDelay)}ms. Error: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError;
};

/**
 * Sequential execution with delays
 */
const executeSequentially = async (tasks, delayBetween = 500) => {
  const results = [];
  
  for (let i = 0; i < tasks.length; i++) {
    try {
      const result = await tasks[i]();
      results.push(result);
      
      // Add delay between tasks
      if (i < tasks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetween));
      }
    } catch (error) {
      console.error(`Task ${i + 1} failed:`, error.message);
      results.push({ error: error.message });
    }
  }
  
  return results;
};

/**
 * Batch processing
 */
const processInBatches = async (items, processor, batchSize = 5, delayBetweenBatches = 1000) => {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );
    
    results.push(...batchResults);
    
    // Add delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
};

module.exports = {
  retryWithBackoff,
  executeSequentially,
  processInBatches
};