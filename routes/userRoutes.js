const express = require('express');
const User = require('../models/user.modal');
const generateToken = require('../utils/generateToken');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  const { username, password, isAdmin } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ username });

  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  // Create a new user
  const user = await User.create({
    username,
    password,
    isAdmin: isAdmin || false, // Set admin status if provided, else default to false
  });

  if (user) {
    const token = generateToken(user._id);
    user.token = token;
    await user.save(); // Save token in the database

    res.status(201).json({
      _id: user._id,
      username: user.username,
      token: token,
      isAdmin: user.isAdmin, // Return admin status
      hasFound:true,
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (user && (await user.matchPassword(password))) {
    const token = generateToken(user._id);
    user.token = token;
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      token: token,
      isAdmin: user.isAdmin, // Return admin status
      hasFound: true, // Indicate user found and authenticated
    });
  } else {
    res.status(401).json({
      message: 'Invalid username or password',
      hasFound: false, // Indicate authentication failure
    });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided', isLoggedOut: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (user) {
      user.token = '';
      await user.save();
      return res.json({ isLoggedOut: true });
    } else {
      return res.status(404).json({ message: 'User not found', isLoggedOut: false });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error or invalid token', isLoggedOut: false });
  }
});

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Admin-only middleware
const adminProtect = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

// Example protected routes
router.get('/protected', protect, (req, res) => {
  res.json({ message: 'This is a protected route, and you are authorized!' });
});

router.get('/admin', protect, adminProtect, (req, res) => {
  res.json({ message: 'Welcome to the admin-only route!' });
});

module.exports = router;
