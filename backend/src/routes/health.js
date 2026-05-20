'use strict';

// Registers the health-check route for the API.
const { Router } = require('express');
const { healthCheck } = require('../controllers/healthController');

const router = Router();

// Basic endpoint used to confirm that the backend is reachable.
router.get('/', healthCheck);

module.exports = router;
