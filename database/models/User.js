import mongoose from "mongoose";
import config from "../../config.js";
import FixedSizeMap from "fixedsize-map";

const { CACHE_SIZE } = config;
const cache = new FixedSizeMap(1000);

const userSchema = new mongoose.Schema(
  {
    _id: String,
    username: String,
    discriminator: String,
    logged: Boolean,
    noPrefix: { type: Boolean, default: false },
    likedSongs: {
      type: [
        {
          title: String,
          author: String,
          url: String,
          thumbnail: String,
          duration: Number,
          likedAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

const User = mongoose.model("user", userSchema);

/**
 * Get user from database or create new one
 * @param {import('discord.js').User} user
 */
export const getUser = async (user) => {
  if (!user) throw new Error("User is required.");
  if (!user.id) throw new Error("User Id is required.");

  const cached = cache.get(user.id);
  if (cached) return cached;

  let userDb = await User.findById(user.id);
  if (!userDb) {
    userDb = new User({
      _id: user.id,
      username: user.username,
      discriminator: user.discriminator,
    });
  }

  // Temporary fix for users who where added to DB before v5.0.0
  // Update username and discriminator in previous DB
  else if (!userDb.username || !userDb.discriminator) {
    userDb.username = user.username;
    userDb.discriminator = user.discriminator;
  }

  cache.add(user.id, userDb);
  return userDb;
};

/**
 * Get reputation leaderboard
 * @param {number} limit - Number of users to return
 */
export const getReputationLb = async (limit = 10) => {
  return User.find({ "reputation.received": { $gt: 0 } })
    .sort({ "reputation.received": -1, "reputation.given": 1 })
    .limit(limit)
    .lean();
};

export default User;
