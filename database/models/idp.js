import { Schema, model } from 'mongoose';

const idpSchema = new Schema({
 channelID: { type: String, required: false },
  guildID: { type: String, required: false },
  message: { type: String, required: false },
  title: { type: String, required: false },
  startTime: {
    type: String,
    required: false
  },
  roleID: { type: String, required: false },  
  map: { type: String, required: false },
  embedMsg: { type: String, required: false },
  
});

const Idp = model('Idp', idpSchema);
export default Idp;
