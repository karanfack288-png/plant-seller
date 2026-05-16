const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const userModel = require("../../model/userModel/user");
const addressModel = require("../../model/userModel/address");
const cartModel = require("../../model/checkoutModel/cart");

exports.createOrderSession = async (req, res, next) => {
  try {
    const userId = req.user;
    const { cartOrProducts, shippingInfo, pricing } = req.body;

    const token = jwt.sign(
      { userId: userId.toString() },
      process.env.SECRET_KEY,
      { expiresIn: "30m" }
    );

    const info = {
      status: true,
      message: "Successfully created the order session.",
      orderToken: token,
    };
    res.status(200).send(info);
  } catch (error) {
    next(error); // Pass the error to the global error handling middleware
  }
};

exports.getOrderSession = async (req, res, next) => {
  try {
    // Send success response if order session is active
    console.log("dsfuhadsjkgasgfgadsfas", req.body);
    const info = {
      status: true,
      message: "Order Session is active!",
    };
    res.status(200).send(info);
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
};

exports.addShippingInfo = async (req, res, next) => {
  try {
    const userId = req.orderUser;
    const shipping = req.body;

    // Example: Save shipping info directly in the database
    const user = await userModel.findById(userId);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Assuming 'shippingInfo' is an array or field in the user schema
    user.shippingInfo = shipping;

    // Save updated user information
    await user.save();

    // Create response object
    const info = {
      status: true,
      message: "Successfully added the Shipping info.",
    };

    // Send response
    res.status(200).send(info);
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
};

exports.getShippingInfo = async (req, res, next) => {
  try {
    const userId = req.orderUser;

    // Retrieve shipping information from the database
    const user = await userModel.findById(userId);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if the user has shipping information
    if (!user.shippingInfo) {
      const error = new Error("Shipping information not found.");
      error.statusCode = 404;
      throw error;
    }

    // Create response object if shipping information is available
    const info = {
      status: true,
      message: "Shipping information retrieved successfully.",
      result: user.shippingInfo,
    };

    // Send success response
    res.status(200).send(info);
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
};

exports.confirmOrder = async (req, res, next) => {
  try {
    console.log("fddsakjhsfd............................", req.orderUser);
    const userId = req.orderUser;

    // Retrieve order details directly from the database
    const user = await userModel.findById(userId);

    console.log("dsfkhhsadkhksahd", user._id);
    const addressInfo = await addressModel.findOne({ user: user._id });
    const cartInfo = await cartModel
      .find({ user: user._id })
      .populate("plant", "_id plantName images price discount")
      .populate("nursery", "nurseryName _id");

    const pricingFromCart = cartInfo.map((cart) => {
      const price = cart.pricing.priceWithoutDiscount;
      const discountPrice = cart.pricing.discountPrice;
      const actualPrice = cart.pricing.priceAfterDiscount;

      return {
        price,
        discountPrice,
        actualPrice,
      };
    });


   
    const totalPricing = cartInfo.reduce((acc, cart) => {
      const price = cart.pricing.priceWithoutDiscount;
      const discount = cart.pricing.discountPrice;
      const actual = cart.pricing.priceAfterDiscount;
    
      acc.totalPriceWithoutDiscount += price;
      acc.discountPrice += discount;
      acc.actualPriceAfterDiscount += actual;
      return acc;
    }, { 
      totalPriceWithoutDiscount: 0, 
      discountPrice: 0, 
      actualPriceAfterDiscount: 0, 
      deliveryPrice: 0 
    });
    
    // finally, calculate totalPrice
    totalPricing.totalPrice = totalPricing.actualPriceAfterDiscount + totalPricing.deliveryPrice;
    
    console.log(totalPricing);
    

    const pricing = {
      totalPriceWithoutDiscount:totalPricing.totalPriceWithoutDiscount, 
      discountPrice : totalPricing.discountPrice,
      actualPriceAfterDiscount : totalPricing.actualPriceAfterDiscount,
      deliveryPrice :  30,
      totalPrice :totalPricing.totalPrice,

    };
    const addressDetail = {
      name: addressInfo.name,
      address: addressInfo.address,
      city: addressInfo.city,
      state: addressInfo.state,
      pinCode: addressInfo.pinCode,
      phone: addressInfo.phone,
    };

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const info = {
      status: true,
      message: "Order Session is active.",
      result: {
        address: addressDetail,
        cartOrProducts: cartInfo,
        pricing: pricing,
      },
    };

    // Send success response
    res.status(200).send(info);
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
};

exports.processPayment = async (req, res, next) => {
  try {
    const userId = req.orderUser;
    
    // Retrieve shipping information and pricing from the database
    const user = await userModel.findById(userId);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    
    const addressInfo = await addressModel.findOne({ user: user._id });
    const cartInfo = await cartModel
      .find({ user: user._id })
      .populate("plant", "_id plantName images price discount")
      .populate("nursery", "nurseryName _id");

    const pricingFromCart = cartInfo.map((cart) => {
      const price = cart.pricing.priceWithoutDiscount;
      const discountPrice = cart.pricing.discountPrice;
      const actualPrice = cart.pricing.priceAfterDiscount;

      return {
        price,
        discountPrice,
        actualPrice,
      };
    });


   
    const totalPricing = cartInfo.reduce((acc, cart) => {
      const price = cart.pricing.priceWithoutDiscount;
      const discount = cart.pricing.discountPrice;
      const actual = cart.pricing.priceAfterDiscount;
    
      acc.totalPriceWithoutDiscount += price;
      acc.discountPrice += discount;
      acc.actualPriceAfterDiscount += actual;
      return acc;
    }, { 
      totalPriceWithoutDiscount: 0, 
      discountPrice: 0, 
      actualPriceAfterDiscount: 0, 
      deliveryPrice: 0 
    });
    
    // finally, calculate totalPrice
    totalPricing.totalPrice = totalPricing.actualPriceAfterDiscount + totalPricing.deliveryPrice;
    
    console.log(totalPricing);
    

    const pricing = {
      totalPriceWithoutDiscount:totalPricing.totalPriceWithoutDiscount, 
      discountPrice : totalPricing.discountPrice,
      actualPriceAfterDiscount : totalPricing.actualPriceAfterDiscount,
      deliveryPrice :  10,
      totalPrice :totalPricing.totalPrice,

    };
    const addressDetail = {
      name: addressInfo.name,
      address: addressInfo.address,
      city: addressInfo.city,
      state: addressInfo.state,
      pinCode: addressInfo.pinCode,
      phone: addressInfo.phone,
    };


    // Check if payment info already exists in the database
    if (user.paymentInfo) {
      const info = {
        status: true,
        message: "Payment already created.",
        result: user.paymentInfo,
      };
      return res.status(200).send(info);
    }

    // Create payment intent with shipping info and pricing
    const myPayment = await stripe.paymentIntents.create({
      description: "Plant Selling website",
      shipping: {
        name: addressInfo.name,
        address: {
          line1: addressInfo.address,
          postal_code:addressInfo.pinCode,
          city: addressInfo.city,
          state: addressInfo.state,
          country: "India", // Setting the default country.
        },
      },
      amount:totalPricing.totalPrice * 100,
      currency: "inr",
      metadata: {
        company: "PlantSeller",
        user: addressInfo.name,
      },
    });

    const paymentData = {
      paymentId: myPayment.id,
      client_secret: myPayment.client_secret,
      amount: totalPricing.totalPrice * 100,
      paymentMethods: myPayment.payment_method_types[0],
    };

    // Store the payment data in the user's record in the database
    user.paymentInfo = paymentData;
    await user.save();

    // Send payment response
    if (myPayment) {
      const info = {
        status: true,
        message: "Payment intent created.",
        result: paymentData,
      };
      return res.status(200).send(info);
    } else {
      const info = {
        status: false,
        message: "Payment not completed.",
      };
      return res.status(400).send(info);
    }
  } catch (error) {
    // Pass error to error handling middleware
    next(error);
  }
};

exports.getStripePublicKey = async (req, res, next) => {
  try {
    if (req.orderUser) {
      const stripeApiKey = process.env.STRIPE_PUBLISHABLE_KEY;

      if (!stripeApiKey) {
        const error = new Error("Stripe public key is not configured");
        error.statusCode = 500;
        throw error;
      }

      const info = {
        status: true,
        message: "Sending the stripe public key.",
        result: { stripeApiKey },
      };

      res.status(200).send(info);
    } else {
      const info = {
        status: false,
        message: "Authentication Failed",
      };
      res.status(403).send(info);
    }
  } catch (error) {
    next(error); //! Pass the error to the global error middleware
  }
};
