const express = require('express');

const routesController = require('../Controllers/routesController');

const router = module.exports = express.Router();

router.get(process.env.FETCH_URL,routesController.apiCALL)