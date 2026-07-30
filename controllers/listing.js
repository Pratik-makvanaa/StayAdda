const Listing = require("../models/listing.js");
const { cloudinary } = require("../cloudConfig.js");

// GET /listings - Show all listings
module.exports.index = async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
};

// GET /listings/new - Render new listing form
module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};

// POST /listings - Create new listing
module.exports.createListing = async (req, res) => {
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;

    if (req.file) {
        newListing.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
    } else {
        // Default image if none provided
        newListing.image = {
            url: "https://images.unsplash.com/photo-1432552573762-be74b4f4a5e6?w=500",
            filename: "default",
        };
    }

    await newListing.save();
    req.flash("success", "New listing created successfully!");
    res.redirect("/listings");
};

// GET /listings/:id - Show a single listing
module.exports.showListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: { path: "author" },
        })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    res.render("listings/show.ejs", { listing });
};

// GET /listings/:id/edit - Render edit form
module.exports.editListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    res.render("listings/edit.ejs", { listing });
};

// PUT /listings/:id - Update a listing
module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    if (req.file) {
        // Delete old image from cloudinary if it's not the default
        if (listing.image && listing.image.filename && listing.image.filename !== "default") {
            await cloudinary.uploader.destroy(listing.image.filename);
        }
        listing.image = {
            url: req.file.path,
            filename: req.file.filename,
        };
        await listing.save();
    }

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
};

// DELETE /listings/:id - Delete a listing
module.exports.deleteListing = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndDelete(id);

    if (listing && listing.image && listing.image.filename && listing.image.filename !== "default") {
        await cloudinary.uploader.destroy(listing.image.filename);
    }

    req.flash("success", "Listing deleted successfully!");
    res.redirect("/listings");
};
