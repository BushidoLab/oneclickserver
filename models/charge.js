const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const chargeShema = new Schema({
  _owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  _stripeCharge: {
    type: Object,
    required: true
  },
}, {
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
});

const Charge = mongoose.model("Charge", chargeShema);

module.exports = Charge;
