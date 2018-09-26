const mongoose = require("mongoose");
const Schema   = mongoose.Schema;

const productShema = new Schema({
    // Product is a coin?
    // _owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }, 
    name: {type: String, required: true, default: "Masternode hosting service"},
    type: {type: String, required: true, default: "service"},
    description: {type: String, required: true},
    stripeProduct: { type: Object, required: true},
}, {
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
});

const Product = mongoose.model("Product", productShema);

module.exports = Product;