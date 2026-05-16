const mongoose = require("mongoose");

mongoose.set("strictQuery", false);

// console.log(process.env.COLLECTION_NAME);
const DB = process.env.DATABASEURI;
mongoose
  .connect(DB, {
    useNewUrlParser: true,
  })
  .then(() => {
    console.log("connection successful!...");
  })
  .catch((err) => {
    console.log(`connection failed!.... ${err}`);
  });
