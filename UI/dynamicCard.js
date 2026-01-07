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
  const cardWidth = 1000;
  const cardHeight = 320;

  const canvas = createCanvas(cardWidth, cardHeight);
  const ctx = canvas.getContext("2d");

  if (fontPath) {
    await fontRegister(fontPath, "CustomFont");
  }

  // 🎨 Modern gradient background
  const gradient = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
  gradient.addColorStop(0, '#0a1929');
  gradient.addColorStop(0.5, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // 🌟 Subtle noise texture
  ctx.globalAlpha = 0.02;
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * cardWidth;
    const y = Math.random() * cardHeight;
    const size = Math.random() * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;

  // 🎵 Header with accent bar
  const accentGradient = ctx.createLinearGradient(0, 0, 200, 0);
  accentGradient.addColorStop(0, '#00d4ff');
  accentGradient.addColorStop(1, '#0099ff');

  ctx.fillStyle = accentGradient;
  ctx.fillRect(30, 30, 4, 40);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("NOW PLAYING", 50, 62);

  // 🖼️ Modern thumbnail design with shadow
  const thumbWidth = 220;
  const thumbHeight = 220;
  const thumbX = 40;
  const thumbY = 90;
  const cornerRadius = 16;

  // Shadow effect
  ctx.shadowColor = 'rgba(0, 212, 255, 0.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Gradient border
  const borderGradient = ctx.createLinearGradient(thumbX, thumbY, thumbX + thumbWidth, thumbY + thumbHeight);
  borderGradient.addColorStop(0, '#00d4ff');
  borderGradient.addColorStop(1, '#0099ff');

  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(thumbX, thumbY, thumbWidth, thumbHeight, cornerRadius);
  ctx.stroke();

  ctx.shadowColor = 'transparent'; // Reset shadow

  // Draw thumbnail
  try {
    const thumbnailImage = await loadImage(thumbnailURL);

    // Create clipping mask for rounded corners
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(thumbX + 4, thumbY + 4, thumbWidth - 8, thumbHeight - 8, cornerRadius - 2);
    ctx.clip();

    // Calculate image scaling to fill the area
    const imgAspect = thumbnailImage.width / thumbnailImage.height;
    const boxAspect = (thumbWidth - 8) / (thumbHeight - 8);

    let drawWidth, drawHeight, offsetX, offsetY;

    if (imgAspect > boxAspect) {
      // Image is wider
      drawHeight = thumbHeight - 8;
      drawWidth = drawHeight * imgAspect;
      offsetX = thumbX + 4 - (drawWidth - (thumbWidth - 8)) / 2;
      offsetY = thumbY + 4;
    } else {
      // Image is taller
      drawWidth = thumbWidth - 8;
      drawHeight = drawWidth / imgAspect;
      offsetX = thumbX + 4;
      offsetY = thumbY + 4 - (drawHeight - (thumbHeight - 8)) / 2;
    }

    ctx.drawImage(thumbnailImage, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();

    // Overlay gradient on thumbnail
    const overlayGradient = ctx.createLinearGradient(
      thumbX, thumbY,
      thumbX, thumbY + thumbHeight
    );
    overlayGradient.addColorStop(0, 'rgba(10, 25, 41, 0.3)');
    overlayGradient.addColorStop(1, 'rgba(10, 25, 41, 0.1)');

    ctx.fillStyle = overlayGradient;
    ctx.beginPath();
    ctx.roundRect(thumbX + 4, thumbY + 4, thumbWidth - 8, thumbHeight - 8, cornerRadius - 2);
    ctx.fill();
  } catch (err) {
    // Fallback design
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(thumbX + 4, thumbY + 4, thumbWidth - 8, thumbHeight - 8, cornerRadius - 2);
    ctx.fill();
  }

  // 📝 Song Info Section
  const textX = thumbX + thumbWidth + 40;

  // Song Title with gradient text
  ctx.fillStyle = "#ffffff";
  ctx.font = fontPath ? "bold 42px 'CustomFont'" : "bold 42px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";

  const maxTitleWidth = cardWidth - textX - 40;
  let displayTitle = songTitle;
  let titleWidth = ctx.measureText(displayTitle).width;

  if (titleWidth > maxTitleWidth) {
    while (titleWidth > maxTitleWidth && displayTitle.length > 3) {
      displayTitle = displayTitle.slice(0, -1);
      titleWidth = ctx.measureText(displayTitle + "...").width;
    }
    displayTitle += "...";
  }

  // Text shadow for better readability
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.fillText(displayTitle, textX, 140);

  // Reset shadow for other elements
  ctx.shadowColor = 'transparent';

  // Artist Name with icon
  ctx.fillStyle = "#00d4ff";
  ctx.font = "bold 16px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(textX, 180);

  ctx.fillStyle = "#b0b0b0";
  ctx.font = fontPath ? "24px 'CustomFont'" : "24px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(songArtist || "Unknown Artist", textX + 25, 180);

  // 📊 Track Details Grid
  const detailY = 220;
  const detailSpacing = 120;

  // Duration
  drawDetailItem(ctx, "Duration", duration || "0:00", textX, detailY, fontPath);

  // Platform
  drawDetailItem(ctx, "Platform", platform || "Unknown", textX + detailSpacing, detailY, fontPath);

  // Volume
  drawDetailItem(ctx, "Volume", `${volume || 100}%`, textX + detailSpacing * 2, detailY, fontPath);

  // Queue
  drawDetailItem(ctx, "Queue", `${queueLength || 0} tracks`, textX + detailSpacing * 3, detailY, fontPath);

  // 👤 Requester with modern badge
  const requesterText = `Requested by ${trackRequester}`;
  const requesterWidth = ctx.measureText(requesterText).width + 40;
  const requesterX = cardWidth - requesterWidth - 30;
  const requesterY = cardHeight - 45;

  // Badge background
  ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
  ctx.beginPath();
  ctx.roundRect(requesterX, requesterY, requesterWidth, 30, 15);
  ctx.fill();

  // Badge border
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(requesterX, requesterY, requesterWidth, 30, 15);
  ctx.stroke();

  // Requester text
  ctx.fillStyle = "#00d4ff";
  ctx.font = fontPath ? "italic 14px 'CustomFont'" : "italic 14px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(requesterText, requesterX + requesterWidth / 2, requesterY + 20);

  // 🎵 Visualizer Effect at bottom
  const visualizerY = cardHeight - 20;
  const barCount = 24;
  const barWidth = 8;
  const barSpacing = 6;
  const maxBarHeight = 15;

  ctx.fillStyle = "rgba(0, 212, 255, 0.6)";
  for (let i = 0; i < barCount; i++) {
    const barHeight = Math.sin(Date.now() / 500 + i * 0.3) * maxBarHeight + maxBarHeight;
    const barX = 30 + i * (barWidth + barSpacing);

    const barGradient = ctx.createLinearGradient(barX, visualizerY, barX, visualizerY - barHeight);
    barGradient.addColorStop(0, '#00d4ff');
    barGradient.addColorStop(1, '#0099ff');

    ctx.fillStyle = barGradient;
    ctx.fillRect(barX, visualizerY - barHeight, barWidth, barHeight);
  }

  return canvas.toBuffer("image/png");
}

// Helper function for detail items
function drawDetailItem(ctx, label, value, x, y, fontPath) {
  ctx.fillStyle = "#888888";
  ctx.font = fontPath ? "12px 'CustomFont'" : "12px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label.toUpperCase(), x, y);

  ctx.fillStyle = "#ffffff";
  ctx.font = fontPath ? "bold 18px 'CustomFont'" : "bold 18px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(value, x, y + 25);
}

export { dynamicCard };