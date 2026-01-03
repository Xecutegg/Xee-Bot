import { Schema, model } from 'mongoose';

const memberSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  warnings: { type: Number, default: 0 },
  warningHistory: [{
    reason: { type: String, required: true },
    moderator: {
      id: { type: String, required: true },
      username: { type: String, required: true }
    },
    timestamp: { type: Date, default: Date.now },
    removed: { type: Boolean, default: false },
    removedBy: {
      id: { type: String, default: null },
      username: { type: String, default: null }
    },
    removedAt: { type: Date, default: null }
  }]
}, {
  timestamps: true
});

// Index for faster queries
memberSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const Member = model('Member', memberSchema);

/**
 * Get or create member data
 * @param {string} guildId 
 * @param {string} userId 
 */
export const getMember = async (guildId, userId) => {
  let member = await Member.findOne({ guildId, userId });
  if (!member) {
    member = new Member({
      guildId,
      userId,
      warnings: 0,
      warningHistory: []
    });
    await member.save();
  }
  return member;
};

/**
 * Add warning to member
 * @param {string} guildId 
 * @param {string} userId 
 * @param {string} reason 
 * @param {Object} moderator 
 */
export const addWarning = async (guildId, userId, reason, moderator) => {
  const member = await getMember(guildId, userId);
  member.warnings += 1;
  member.warningHistory.push({
    reason,
    moderator: {
      id: moderator.id,
      username: moderator.username
    }
  });
  await member.save();
  return member;
};

/**
 * Remove warning by index
 * @param {string} guildId 
 * @param {string} userId 
 * @param {number} warningIndex 
 * @param {Object} moderator 
 */
export const removeWarningByIndex = async (guildId, userId, warningIndex, moderator) => {
  const member = await getMember(guildId, userId);
  
  if (warningIndex < 1 || warningIndex > member.warningHistory.length) {
    throw new Error('Invalid warning index');
  }
  
  const warning = member.warningHistory[warningIndex - 1];
  if (warning.removed) {
    throw new Error('Warning already removed');
  }
  
  warning.removed = true;
  warning.removedBy = {
    id: moderator.id,
    username: moderator.username
  };
  warning.removedAt = new Date();
  
  member.warnings = Math.max(0, member.warnings - 1);
  await member.save();
  return member;
};

/**
 * Clear all warnings for member
 * @param {string} guildId 
 * @param {string} userId 
 */
export const clearWarnings = async (guildId, userId) => {
  const member = await getMember(guildId, userId);
  member.warnings = 0;
  member.warningHistory = [];
  await member.save();
  return member;
};

/**
 * Get warning logs for a member
 * @param {string} guildId 
 * @param {string} userId 
 */
export const getWarningLogs = async (guildId, userId) => {
  const member = await getMember(guildId, userId);
  return member.warningHistory.filter(w => !w.removed);
};

/**
 * Clear warning logs for a member
 * @param {string} guildId 
 * @param {string} userId 
 */
export const clearWarningLogs = async (guildId, userId) => {
  const member = await getMember(guildId, userId);
  member.warnings = 0;
  member.warningHistory = [];
  await member.save();
  return member;
};

export default Member;
