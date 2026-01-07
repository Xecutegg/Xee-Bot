import { createCanvas, loadImage } from "@napi-rs/canvas";
import { fontRegister } from "./fonts/fontRegister.js";
import path from "path";
import data from "./banners/musicard.js";

async function dynamicCard({
  thumbnailURL,
  songTitle,
  songArtist,
  trackRequester,
  duration,
  queueLength,
  volume,
  platform,
  fontPath,
}) {
  const cardWidth = 900;
  const cardHeight = 300;

  const canvas = createCanvas(cardWidth, cardHeight);
  const ctx = canvas.getContext("2d");

  if (fontPath) {
    await fontRegister(fontPath, "CustomFont");
  }

  // 🎨 Select a random background image
  const randomBgPath =
    data.backgroundImages[Math.floor(Math.random() * data.backgroundImages.length)];

  try {
    const backgroundImage = await loadImage(randomBgPath);
    // ✅ Draw background image scaled to fit
    ctx.drawImage(backgroundImage, 0, 0, cardWidth, cardHeight);
  } catch (err) {
    // Fallback gradient if no background image
    const gradient = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
    gradient.addColorStop(0, '#0d4d4d');
    gradient.addColorStop(0.5, '#1a3a3a');
    gradient.addColorStop(1, '#0a2a2a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cardWidth, cardHeight);
  }

  // 🔥 Add a semi-transparent overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // 🎵 Header text - "Xee Music"
  ctx.fillStyle = "#ffffff";
  ctx.font = "italic bold 42px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("Xee Music", cardWidth / 2, 55);

  // 🖼️ Load and draw the thumbnail with rounded corners
  const thumbnailSize = 160;
  const thumbX = 40;
  const thumbY = 85;
  const cornerRadius = 15;

  try {
    const thumbnailImage = await loadImage(thumbnailURL);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(thumbX + cornerRadius, thumbY);
    ctx.lineTo(thumbX + thumbnailSize - cornerRadius, thumbY);
    ctx.arcTo(thumbX + thumbnailSize, thumbY, thumbX + thumbnailSize, thumbY + cornerRadius, cornerRadius);
    ctx.lineTo(thumbX + thumbnailSize, thumbY + thumbnailSize - cornerRadius);
    ctx.arcTo(thumbX + thumbnailSize, thumbY + thumbnailSize, thumbX + thumbnailSize - cornerRadius, thumbY + thumbnailSize, cornerRadius);
    ctx.lineTo(thumbX + cornerRadius, thumbY + thumbnailSize);
    ctx.arcTo(thumbX, thumbY + thumbnailSize, thumbX, thumbY + thumbnailSize - cornerRadius, cornerRadius);
    ctx.lineTo(thumbX, thumbY + cornerRadius);
    ctx.arcTo(thumbX, thumbY, thumbX + cornerRadius, thumbY, cornerRadius);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(thumbnailImage, thumbX, thumbY, thumbnailSize, thumbnailSize);
    ctx.restore();

    // Add border to thumbnail
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(thumbX, thumbY, thumbnailSize, thumbnailSize, cornerRadius);
    ctx.stroke();
  } catch (err) {
    // Draw placeholder if thumbnail fails
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.roundRect(thumbX, thumbY, thumbnailSize, thumbnailSize, cornerRadius);
    ctx.fill();
  }

  // 📝 Song Title
  const textX = thumbX + thumbnailSize + 30;
  ctx.fillStyle = "#ffffff";
  ctx.font = fontPath ? "bold 32px 'CustomFont'" : "bold 32px Arial, sans-serif";
  ctx.textAlign = "left";

  // Truncate title if too long
  const maxTitleWidth = cardWidth - textX - 40;
  let truncatedTitle = songTitle;
  while (ctx.measureText(truncatedTitle).width > maxTitleWidth && truncatedTitle.length > 0) {
    truncatedTitle = truncatedTitle.slice(0, -1);
  }
  if (truncatedTitle.length < songTitle.length) {
    truncatedTitle = truncatedTitle.slice(0, -3) + "...";
  }
  ctx.fillText(truncatedTitle, textX, 115);

  // 🎤 Artist Name
  ctx.fillStyle = "#b0b0b0";
  ctx.font = fontPath ? "24px 'CustomFont'" : "24px Arial, sans-serif";
  ctx.fillText(songArtist || "Unknown Artist", textX, 155);

  // 🎧 Track Info (Duration, Volume, Platform, Queue)
  ctx.fillStyle = "#00ff88";
  ctx.font = fontPath ? "18px 'CustomFont'" : "18px Arial, sans-serif";
  const infoText = `🎧  ${duration || "0:00"} • ${platform || "YouTube"} • Vol: ${volume || 100}% • Queue: ${queueLength || 0} tracks`;
  ctx.fillText(infoText, textX, 195);

  // 👤 Requester at bottom
  ctx.fillStyle = "#00ff88";
  ctx.font = fontPath ? "italic 20px 'CustomFont'" : "italic 20px Arial, sans-serif";
  ctx.fillText(`Requester: ${trackRequester}`, 40, cardHeight - 30);

  // ✨ Decorative elements - small dots
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  for (let i = 0; i < 5; i++) {
    const dotX = cardWidth - 50 - (i * 30);
    const dotY = cardHeight - 35;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toBuffer("image/png");
}

export { dynamicCard };
