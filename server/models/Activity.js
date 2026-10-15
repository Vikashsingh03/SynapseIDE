const mongoose = require('mongoose');





const activitySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['run', 'room_join', 'room_create', 'login'],
      required: true,
      index: true,
    },
    language: { type: String, default: null }, 
    languageId: { type: Number, default: null },
    linesOfCode: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    roomId: { type: String, default: null },
    
    day: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

activitySchema.index({ userId: 1, day: 1 });
activitySchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
