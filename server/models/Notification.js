const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['mention', 'room_join', 'voice_call', 'system'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      default: '',
    },
    roomId: {
      type: String,
      default: null,
      index: true,
    },
    fromUser: {
      userId: { type: String, default: null },
      name: { type: String, default: '' },
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    link: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast "unread for user" queries, newest first
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
