const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    minlength: [2, "Title must be at least 2 characters long"],
  },
  published: {
    type: Number,
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Author",
    required: true,
  },
  genres: [{ type: String }],
});

module.exports = mongoose.model("Book", schema);
