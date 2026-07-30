const User = require("../models/user.js");

// GET /signup - Render signup form
module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

// POST /signup - Register new user
module.exports.signup = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);

        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to StayAdda!");
            res.redirect("/listings");
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

// GET /login - Render login form
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

// POST /login - Login user
module.exports.login = async (req, res) => {
    req.flash("success", `Welcome back, ${req.user.username}!`);
    const redirectUrl = res.locals.redirectUrl || "/listings";
    delete req.session.redirectUrl;
    res.redirect(redirectUrl);
};

// GET /logout - Logout user
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You have been logged out.");
        res.redirect("/listings");
    });
};