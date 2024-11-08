const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const userModel = require("../Model/userModel");



passport.use(
    new GoogleStrategy(
        {
            clientID: "596197797319-9s2vkul8bl9l43h0noiti432o77uj2kq.apps.googleusercontent.com",
            clientSecret:"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",
            callbackURL: "/auth/google/callback"
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await userModel.findOne({ googleId: profile.id });
                if (user) {
                    return done(null, user);
                } else {
                    user = new userModel({
                        username: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id,
                        status: 'true',
                    });
                    await user.save();
                    return done(null, user);
                }
            } catch (error) {
                console.log("Error in Google authentication:", error);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
   userModel.findById(id)
   .then(user=>{
    done(null,user)
   })
   .catch(err=>{
    done(err,null)
   })
});



module.exports = passport