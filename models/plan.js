const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const planShema = new Schema({
  // _owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: {
    type: String,
    required: true,
    default: "Masternode hosting service"
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: String,
    required: true,
    default: "10000"
  },
  interval: {
    type: String,
    required: true,
    default: "month"
  },
  currency: {
    type: String,
    required: true,
    default: "usd"
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  stripePlan: {
    type: Object,
    required: true
  },
  _user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
}, {
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
});

const Plan = mongoose.model("Plan", planShema);

module.exports = Plan;
