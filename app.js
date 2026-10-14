if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

if (process.env.NODE_ENV === "production" && !process.env.SECRET) {
    throw new Error("SECRET is required in production");
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const ExpressError = require("./utils/ExpressError.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/bookings.js");
const listingsRouter = require("./routes/listings.js");
const aiRouter = require("./routes/ai.js");
const tripPlannerRouter = require("./routes/tripPlanner.js");

// const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/stayadda";
const dbUrl =
    process.env.ATLASDB_URL ||
    (process.env.NODE_ENV !== "production"
        ? "mongodb://127.0.0.1:27017/stayadda"
        : null);

if (!dbUrl) {
    throw new Error("ATLASDB_URL is required in production");
}

// async function main() {
//     await mongoose.connect(dbUrl);
//     console.log("Connected to MongoDB");
// }
// main().catch((err) => console.log(err));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: { secret: process.env.SECRET },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("SESSION STORE ERROR", err);
});


if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

const sessionOptions = {
    store,
    secret: process.env.SECRET || "local-development-only-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    },
};


app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Global middleware for flash messages and current user
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// Home route
app.get("/", (req, res) => {
    res.render("listings/home.ejs");
});

// Routes
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/bookings", bookingRouter);
app.use("/ai", aiRouter);
app.use("/trip-planner", tripPlannerRouter);

// 404 handler
app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"));
});

// Error handler
app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong!" } = err;
    res.status(statusCode).render("error.ejs", { message });
});

// const PORT = process.env.PORT || 8080;
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });


const PORT = process.env.PORT || 8080;

async function startServer() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Connected to MongoDB");

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start application:", err);
        process.exit(1);
    }
}

startServer();
