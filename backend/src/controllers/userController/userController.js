const { default: mongoose } = require('mongoose');
const { deleteResourcesByPrefix, deleteFolder, uploadImage } = require('../../utils/uploadImages');
const bcryptjs = require('bcryptjs');

const userModel = require('../../model/userModel/user');
const nurseryStoreTabs = require('../../model/nurseryModel/nurseryStoreTabs');
const nurseryStoreTemplates = require('../../model/nurseryModel/nurseryStoreTemplates');
const nurseryStoreBlocks = require('../../model/nurseryModel/nurseryStoreBlocks');
const plantModel = require('../../model/nurseryModel/plants');
const nurseryModel = require('../../model/nurseryModel/nursery');
const addressModel = require('../../model/userModel/address');
const cartModel = require('../../model/checkoutModel/cart');
const orderModel = require('../../model/checkoutModel/orders');
const nurseryStoreContact = require('../../model/nurseryModel/nurseryStoreContact');

exports.getUserProfile = async (req, res, next) => {
    try {
        const result = await userModel.findOne({ _id: req.user }).select({ password: 0, tokens: 0, __v: 0 });

        //! If the user does not exist
        if (!result) {
            const error = new Error("User not found");
            error.statusCode = 404; // Changed to 404 to indicate user is not found
            throw error;
        }

        const info = {
            status: true,
            message: "User profile data retrieved successfully.",
            result
        };

        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
};

exports.updateUserProfile = async (req, res, next) => {
    try {
        const { _id, name, phone, gender, age } = req.body;

        if (_id.toString() !== req.user.toString()) {
            const error = new Error("Authentication Failed");
            error.statusCode = 403;
            throw error;
        }

        const updates = {};
        if (name !== null && name !== undefined) updates.name = name;
        if (phone !== null && phone !== undefined) updates.phone = phone;
        if (gender !== null && gender !== undefined) updates.gender = gender;
        if (age !== null && age !== undefined) updates.age = age;

        const result = await userModel.findOneAndUpdate({ _id: req.user }, {
            $set: updates
        }, {
            new: true
        }).select({ password: 0, tokens: 0, __v: 0 });

        if (!result) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        const info = {
            status: true,
            message: "User profile updated successfully",
            result
        };

        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
};


exports.deleteUserProfile = async (req, res, next) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const userId = req.user;

        // Delete user from the database
        const deletedUser = await userModel.findOneAndDelete({ _id: userId }, { session });

        if (!deletedUser) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        // Delete related data from other collections
        await addressModel.deleteMany({ user: req.user }, { session });
        await cartModel.deleteMany({ user: req.user }, { session });
        await orderModel.deleteMany({ user: req.user }, { session });
        await nurseryStoreContact.deleteMany({ user: req.user }, { session });

        if (req.nursery) {
            await nurseryModel.findOneAndDelete({ _id: req.nursery, user: req.user }, { session });
            await nurseryStoreTabs.deleteMany({ user: req.user, nursery: req.nursery }, { session });
            await nurseryStoreTemplates.deleteMany({ user: req.user, nursery: req.nursery }, { session });
            await nurseryStoreBlocks.deleteMany({ user: req.user, nursery: req.nursery }, { session });
            await nurseryStoreContact.deleteMany({ nursery: req.nursery }, { session });
            await plantModel.deleteMany({ user: req.user, nursery: req.nursery }, { session });

            // TODO: Handle other related deletions (order data, review, wishlist, etc.)

            // Example: Deleting files or resources related to the user (if needed)
            await deleteResourcesByPrefix(`PlantSeller/user/${req.user}`, {
                type: 'upload',
                resource_type: 'image',
                invalidate: true
            });

            await deleteFolder(`PlantSeller/user/${req.user}`);
        }

        // Send response after deletion
        const info = {
            status: true,
            message: "User profile deleted successfully",
        };

        await session.commitTransaction();
        res.status(200).send(info);
    } catch (error) {
        await session.abortTransaction();
        next(error); //! Pass the error to the error handling middleware
    } finally {
        await session.endSession();
    }
};


exports.validateVerificationToken = async (req, res, next) => {
    const { token } = req.params;

    try {
        //! Token does not exist
        if (!token) {
            const error = new Error("Invalid Token Parameters");
            error.statusCode = 404;
            throw error;
        }

        // Get the user from the database directly using the token (assume you have a token verification mechanism)
        const user = await userModel.findOne({ verificationToken: token });

        //! User does not exist or the token does not match
        if (!user) {
            const error = new Error("Token Expired or does not exist");
            error.statusCode = 404;
            throw error;
        }

        const info = {
            status: true,
            message: "Token is valid",
        }

        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
}

exports.validatePasswordRestToken = async (req, res, next) => {
    const { token } = req.params;

    try {
        //! Token does not exist
        if (!token) {
            const error = new Error("Invalid Token Parameters");
            error.statusCode = 404;
            throw error;
        }

        // Get the user from the database directly using the resetPasswordToken (assume you have a token verification mechanism)
        const user = await userModel.findOne({ resetPasswordToken: token });

        //! User does not exist or the token does not match
        if (!user) {
            const error = new Error("Token Expired or does not exist");
            error.statusCode = 404;
            throw error;
        }

        const info = {
            status: true,
            message: "Token is valid",
        }

        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
}


exports.ResetPassword = async (req, res, next) => {
    const { token } = req.params;
    try {

        //! Token does not exist
        if (!token) {
            const error = new Error("Invalid Token Parameters");
            error.statusCode = 404;
            throw error;
        }

        //^ Check if token exists in the database (Assuming you store reset tokens in the User model or another collection)
        const user = await userModel.findOne({ resetPasswordToken: token });

        //! If user does not exist or token is invalid
        if (!user) {
            const error = new Error("Token Expired or does not exist");
            error.statusCode = 404;
            throw error;
        }

        //* Getting Data from the form body
        const { password, confirmPassword } = req.body;

        if (!password || !confirmPassword) {
            const error = new Error("Password Parameter Missing");
            error.statusCode = 405;
            throw error;
        }

        if (password !== confirmPassword) {
            const error = new Error("Password and Confirm Password does not match");
            error.statusCode = 405;
            throw error;
        }

        //* Updating the user's password
        user.password = password;
        user.resetPasswordToken = undefined; // Remove the reset token after successful password change
        await user.save();

        const info = {
            status: true,
            message: "Password Changed successfully",
        }

        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
}


exports.verifyUser = async (req, res, next) => {
    const { token } = req.params;
    try {

        //! Token does not exist
        if (!token) {
            const error = new Error("Invalid Token Parameters");
            error.statusCode = 404;
            throw error;
        }

        //^ Check if token exists in the database (Assuming you store verification tokens in the User model or another collection)
        const user = await userModel.findOne({ verificationToken: token });

        //! If user does not exist or token is invalid
        if (!user) {
            const error = new Error("Token Expired or does not exist");
            error.statusCode = 404;
            throw error;
        }

        //* Getting Data from the form body
        const { isUserVerified } = req.body;

        if (!isUserVerified) {
            const error = new Error("User not verified");
            error.statusCode = 405;
            throw error;
        }

        //* Updating the user's verification status
        user.isUserVerified = true;
        user.verificationToken = undefined; // Clear the verification token after successful verification
        await user.save();

        const info = {
            status: true,
            message: "User Verification completed!",
        }

        res.status(200).send(info);

    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
}


exports.uploadProfileImage = async (req, res, next) => {
    try {
        // Check if a file is uploaded
        if (!req.files) {
            const error = new Error("Invalid Images to upload.");
            error.statusCode = 400;
            throw error;
        }

        let image;
        
        // Ensure the correct file type (avatar in this case)
        if (req.body.type === "avatar") {
            image = req.files.avatar;
        } else {
            const error = new Error("Invalid File Upload.");
            error.statusCode = 400;
            throw error;
        }

        // Upload the image to cloud storage (Cloudinary or similar service)
        const upload = await uploadImage(image, {
            folder: `PlantSeller/user/${req.user}/profile`,
            tags: req.body.type,
        });

        const { public_id, secure_url } = upload;

        // Prepare image data to save in the database
        image = {
            public_id,
            url: secure_url
        };

        // Update the user's avatar and avatarList in the database
        const result = await userModel.findOneAndUpdate({ _id: req.user }, {
            $set: {
                avatar: image // Set the new avatar
            },
            $push: {
                avatarList: image // Push to avatar history
            }
        }, {
            new: true // Return the updated document
        });

        // If user not found, return an error
        if (!result) {
            const error = new Error("Failed to update image.");
            error.statusCode = 400;
            throw error;
        }

        // Success response with the updated user information
        const info = {
            status: true,
            message: "Image updated successfully.",
            result
        };

        res.status(200).send(info);
    } catch (error) {
        next(error); // Pass error to the error handler middleware
    }
};


exports.ChangePassword = async (req, res, next) => {
    try {
        //* Get the user ID from the request (assumes auth middleware adds it)
        const userId = req.user;

        //! If user ID does not exist
        if (!userId) {
            const error = new Error("Unauthorized access");
            error.statusCode = 403;
            throw error;
        }

        //* Fetch the user from the database
        const user = await userModel.findById(userId);

        //! If the user does not exist
        if (!user) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        //* Extracting passwords from request body
        const { previousPassword, password, confirmPassword } = req.body;

        //! Ensure all password fields are provided
        if (!previousPassword || !password || !confirmPassword) {
            const error = new Error("All password fields are required (previousPassword, password, confirmPassword)");
            error.statusCode = 400;
            throw error;
        }

        //* Verify that the previous password matches the current one
        const isMatch = await bcryptjs.compare(previousPassword, user.password);
        if (!isMatch) {
            const error = new Error("Previous password is incorrect");
            error.statusCode = 403;
            throw error;
        }

        //! Check if the new password and confirm password match
        if (password !== confirmPassword) {
            const error = new Error("New password and confirm password do not match");
            error.statusCode = 400;
            throw error;
        }

        //* Update the password (hashing should happen in the pre-save hook of the model)
        user.password = password;
        await user.save();

        //* Send success response
        const info = {
            status: true,
            message: "Password updated successfully",
        };

        res.status(200).send(info);
    } catch (error) {
        next(error); // Pass the error to the error handling middleware
    }
};


exports.EnableDisableTwoFactorAuthentication = async (req, res, next) => {
    try {
        //* Getting user from the request object (assuming authentication middleware adds user info to `req.user`)
        const userId = req.user;

        //! User ID does not exist
        if (!userId) {
            const error = new Error("Unauthorized access");
            error.statusCode = 403;
            throw error;
        }

        const { isTwoFactorAuthEnabled } = req.body;

        if(isTwoFactorAuthEnabled === undefined || isTwoFactorAuthEnabled === null) {
            const error = new Error("Two Factor Authentication Parameter is required");
            error.statusCode = 400;
            throw error;
        }

        //* Fetch user from the database and update two-factor authentication status
        const user = await userModel.findOneAndUpdate({_id: userId}, {
            $set: {
                isTwoFactorAuthEnabled
            }
        }, {
            new: true
        }).select({ password: 0, tokens: 0, __v: 0 });

        //! If user does not exist
        if (!user) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        //* Respond to the client
        const info = {
            status: true,
            message: "Two Factor Authentication status updated successfully",
            result: user
        };

        res.status(200).send(info);
    } catch (error) {
        next(error); //! Pass the error to the error handling middleware
    }
}
