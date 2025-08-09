const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const User = require("../models/userModel");
const generateReferralCode = require("../utils/generateReferralCode");
require("dotenv").config();


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECERET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async function (request, accessToken, refreshToken, profile, cb) {
      try {
        
        const { id: googleId, email, _json: { name } } = profile; 
        let user = await User.findOne({ email });
         const referalId = generateReferralCode(7);

        console.log("user",user);
        console.log("datas ==============>",name,email,googleId);
        
        

        if (!user) {
          console.log("new user",name,email,googleId);
          
       
          const user = new User({
            name, 
            email,
            mobile: googleId,
            password:googleId,
            is_admin: 0,
            is_verified: 1,
            is_blocked: false,
             wallet: 0,
             referalId: referalId,
            walletHistory: [],
          });
          await user.save();
        }
        return cb(null, user ,{ successRedirect: "",});
      } catch (error) {
        console.log(error.message);
      }
    }
  )
);

passport.serializeUser(function (user, cb) {
  cb(null, user);
})

passport.deserializeUser(function (user, cb) {
  cb(null, user);
});

