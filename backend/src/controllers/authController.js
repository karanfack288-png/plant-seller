const userModel = require('../model/userModel/user');
const bcryptjs = require('bcryptjs');
const { generateUniqueLinkWithToken, generateToken, generateSecureOTP } = require('../utils/generateToken');
const { confirmAccountSendEmail, resetPasswordSendEmail, sendOTP } = require('./smtp/emailController');
const jwt = require('jsonwebtoken');
const { decryptMessage } = require('../utils/cryptoUtil');
const user = require('../model/userModel/user');

//* POST Routes

exports.signUp = async (req, res, next) => {
    try {
        console.log("dsfjhjksfdsdf",req.body);
        const newUser = new userModel(req.body);
        await newUser.save();


        const info = {
            status: true,
            message: "User Account successfully created",
            result: {
                email: newUser.email
            }
        }

        return res.status(201).send(info);

    } catch (err) {
        next(err); 
    }
};

//* POST Routes

exports.signIn = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        //* Find the email 
        const result = await userModel.findOne({ email });

        console.log("sdfhsfada",result);
        //! If Email is not found
        if (!result) {
            const error = new Error("Login Failed");
            error.statusCode = 403;
            throw error;
        }

        //* Compare password 
        const isPassMatch = await bcryptjs.compare(password, result.password);

        console.log("fdshjshdfj",isPassMatch);
        //! Password not matched
        if (!isPassMatch) {
            const error = new Error("Login Failed");
            error.statusCode = 403;
            throw error;
        }

        // const token = await result.generateAuthToken();
        const payload = {
            id: result._id, // your user's unique ID
            email: result.email, // or any other info you want in token
          };
          const secret = process.env.SECRET_KEY; // must be defined in .env
          
          const token = jwt.sign(payload, secret, {
            expiresIn: "15d", // or "7d" etc.
          });

        const userInfo = { ...result._doc };

        //! Deleting the confidential data before sending
        delete userInfo.password;
        delete userInfo.tokens;
        delete userInfo.__v;

        const info = {
            status: true,
            message: "Login Successful",
            result: userInfo,
            token: {
                accessToken: token,
                refreshToken: "gghgjhghjhkjhkjhkjhjgjhgjhhjguh",
            }
        }

        res.status(200).send(info);
    } catch (error) {
        next(error); //! Pass the error to the global error middleware
    }
};

//* GET Routes

exports.logout = async (req, res, next) => {
    try {

        const info = {
            status: true,
            message: "Logout Successfully."
        };
        res.status(200).send(info);
    } catch (error) {
        next(error); //! Pass the error to the global error middleware
    }
};

//* GET Routes

exports.checkUser = async (req, res, next) => {
    try {
        // Find the user by their ID (which is stored in req.user)
        console.log("dsfjljdslfhsadfhfasd",req.body);
        const result = await userModel.findOne({ _id: req.user });

        // console.log("fdskkhkhsfd",result);
        // // If the user is not found, throw an error
        // if (!result) {
        //     const error = new Error("Authentication Failed");
        //     error.statusCode = 403;
        //     throw error;
        // }

        // Return a success response if the user exists
        const info = {
            status: true,
            message: "User Check Passed."
        };
        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the global error middleware
    }
};

exports.resetUserPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        //! Check if the email parameter is valid
        if (!email) {
            const error = new Error("Email is required");
            error.statusCode = 400;
            throw error;
        }

        //^ Find the user based on the email
        const user = await userModel.findOne({ email });

        if (!user) {
            const error = new Error("Email is not valid");
            error.statusCode = 400;
            throw error;
        }

        //* Generate unique token and link for email verification
        const { token, link } = generateUniqueLinkWithToken("account/ResetYourPassword");

        // Send Email with SMTP to reset password
        const isEmailSent = await resetPasswordSendEmail(user.email, user.name, link);

        if (!isEmailSent) {
            const error = new Error("Failed to send email verification");
            error.statusCode = 500;
            throw error;
        }

        const info = {
            status: true,
            message: "Password Reset Email Sent Successfully",
        }

        return res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the global error middleware
    }
}

exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            const error = new Error("Authentication failed!");
            error.statusCode = 403;
            throw error;
        }

        const decryptedToken = decryptMessage(refreshToken); // Decrypt without using `iv`

        if (!decryptedToken) {
            const error = new Error("Authentication failed!");
            error.statusCode = 403;
            throw error;
        }

        const verifyUser = jwt.verify(token,process.env.SECRET_KEY);

        if (!verifyUser) {
            const error = new Error("Authentication failed!");
            error.statusCode = 403;
            throw error;
        }

        const user = await userModel.findOne({ _id: verifyUser._id }).select({ tokens: 1 });

        if (!user) {
            const error = new Error("Authentication failed!");
            error.statusCode = 403;
            throw error;
        }

        //* Match the token with the database...
        if (!user.tokens.some(t => t.token === decryptedToken)) {
            const error = new Error("Authentication failed!");
            error.statusCode = 403;
            throw error;
        }

        user.tokens = user.tokens.filter(t => t.token !== decryptedToken);

        //* Generate Auth Token
        const token = await user.generateAuthToken();

        const info = {
            status: true,
            message: "New Token Generated!",
            token: {
                accessToken: token.accessToken,
                refreshToken: token.refreshToken // Return the generated refresh token
            }
        }

        return res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the global error middleware
    }
}

exports.validateOtp = async (req, res, next) => {
    const { token } = req.params;

    try {

        //! Token does not exist
        if (!token) {
            const error = new Error("Invalid Token Parameters");
            error.statusCode = 404;
            throw error;
        }

        //^ Find user based on the token directly in the database
        const otpData = await userModel.findOne({ 'tokens.token': token });

        //! User does not exist or the token expired
        if (!otpData) {
            const error = new Error("Token Expired or does not exist");
            error.statusCode = 404;
            throw error;
        }

        //* Getting Data from the form body
        const { otp } = req.body;

        if (!otp) {
            const error = new Error("Otp Parameter Missing");
            error.statusCode = 405;
            throw error;
        }

        if (otp.toString() !== otpData.otp.toString()) {
            const error = new Error("Otp does not match");
            error.statusCode = 405;
            throw error;
        }

        //^ Check if the user exists in the database
        const user = await userModel.findOne({ _id: otpData.userId });

        //! If user does not exist
        if (!user) {
            const error = new Error("You are not verified, you may need to re-try");
            error.statusCode = 403;
            throw error;
        }

        //* Extracting user data
        const userInfo = { ...user._doc };

        //! Deleting confidential data before sending it back
        delete userInfo.password;
        delete userInfo.tokens;
        delete userInfo.__v;

        //* Generate Auth Token
        const authToken = await user.generateAuthToken();

        const { encryptedMessage, iv } = authToken.refreshToken;

        if (!encryptedMessage || !iv) {
            const error = new Error("Failed to generate refresh token");
            error.statusCode = 500;
            throw error;
        }

        const info = {
            status: true,
            message: "Verification Completed successfully",
            result: userInfo,
            token: {
                accessToken: authToken.accessToken,
                refreshToken: encryptedMessage
            }
        }

        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
}

exports.validateOtpToken = async (req, res, next) => {
    const { token } = req.params;

    try {

        //! Token does not exist
        if (!token) {
            const error = new Error("Invalid Token Parameters");
            error.statusCode = 404;
            throw error;
        }

        //^ Find the user associated with the token
        const otpData = await user.findOne({ 'tokens.token': token });

        //! User does not exist or the token expired
        if (!otpData) {
            const error = new Error("Token Expired or does not exist");
            error.statusCode = 404;
            throw error;
        }

        const info = {
            status: true,
            message: "Valid TwoFactor Authentication Token",
        }

        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
}

exports.resendOtp = async (req, res, next) => {
    const { token } = req.params;

    try {
        //! Token does not exist
        if (!token) {
            const error = new Error("Invalid Token Parameters");
            error.statusCode = 404;
            throw error;
        }

        //^ Find the user associated with the token
        const otpData = await user.findOne({ 'tokens.token': token });

        //! User does not exist or the token expired
        if (!otpData) {
            const error = new Error("Token Expired or does not exist");
            error.statusCode = 404;
            throw error;
        }

        // Generate a new OTP
        const otp = generateSecureOTP();

        //* Send Email with SMTP to activate the user account
        const isEmailSent = await sendOTP(otpData.email, otpData.name, otp);

        if (!isEmailSent) {
            const error = new Error("Failed to send OTP email verification");
            error.statusCode = 500;
            throw error;
        }

        const info = {
            status: true,
            message: "OTP Resent Successfully",
            code: "TwoFactorAuth",
            token
        };

        return res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
}
