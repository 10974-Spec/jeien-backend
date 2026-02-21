const express = require('express');
const router = express.Router();
const { sendMessage, getMyMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendMessage);
router.get('/', protect, getMyMessages);

module.exports = router;
