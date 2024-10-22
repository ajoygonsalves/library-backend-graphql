const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    minlength: [4, "Author name must be at least 4 characters long"],
  },
  born: {
    type: Number,
  },
});

module.exports = mongoose.model("Author", schema);
