const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const router = express.Router();
const { registerUser, loginUser, getUserProfile, updateProfile, forgotPassword, resetPassword } = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');
const generateToken = require('../utils/generateToken');
const User = require('../models/User');

// Configure Google OAuth Strategy (only if credentials are present)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`,
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ email: profile.emails[0].value });
            if (!user) {
                user = await User.create({
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    password: `google_${profile.id}`,
                    phone: `google_${profile.id}`, // placeholder
                    role: 'user',
                    isVerified: true,
                });
            }
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
}

// Standard auth routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);


// Google OAuth routes
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        // On success: redirect to frontend with JWT token
        const token = generateToken(req.user._id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        res.redirect(`${frontendUrl}/auth/callback?token=${token}&name=${encodeURIComponent(req.user.name)}&role=${req.user.role}&id=${req.user._id}`);
    }
);

module.exports = router;
