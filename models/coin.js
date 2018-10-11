const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const coinSchema = new Schema({
  coinName: {
    type: String,
    required: true,
    unique: true
  },
  coinTicker: {
    type: String,
    required: true,
    unique: true
  },
  plan: {
    type: Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  supported: {
    type: Boolean,
    default: false
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

const Coin = mongoose.model("Coin", coinSchema);

module.exports = Coin;
