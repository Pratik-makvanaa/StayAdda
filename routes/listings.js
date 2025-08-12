const express = require('express');
const router = express.Router();
const Listing = require('../models/listing');
const { isLoggedIn, isOwner } = require('../middleware');

// Index Route
router.get('/', async (req, res) => {
    try {
        const listings = await Listing.find({});
        res.render('listings/index', { listings });
    } catch (error) {
        console.error('Error fetching listings:', error);
        req.flash('error', 'Error fetching listings');
        res.redirect('/');
    }
});

// Search Route - Must be before the :id route
router.get('/search', async (req, res) => {
    try {
        const { searchQuery } = req.query;
        
        if (!searchQuery) {
            return res.redirect('/listings');
        }

        // Create a case-insensitive search query
        const searchRegex = new RegExp(searchQuery, 'i');
        
        // Search in both title and location fields
        const listings = await Listing.find({
            $or: [
                { title: searchRegex },
                { location: searchRegex }
            ]
        });

        res.render('listings/search', { 
            listings,
            searchQuery,
            title: 'Search Results'
        });
    } catch (error) {
        console.error('Search error:', error);
        req.flash('error', 'Error performing search');
        res.redirect('/listings');
    }
});

// Show Route
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id)
            .populate({
                path: 'reviews',
                populate: {
                    path: 'author'
                }
            })
            .populate('owner');
        
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }
        
        res.render('listings/show', { listing });
    } catch (error) {
        console.error('Error fetching listing:', error);
        req.flash('error', 'Error fetching listing');
        res.redirect('/listings');
    }
});

// ... rest of your routes ...

module.exports = router; 